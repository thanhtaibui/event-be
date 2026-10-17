import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';
import { PermissionCode } from '../../common/constants/permission-codes';
import { Membership } from '../membership/entities/membership.entity';
import { Order } from '../order/entities/order.entity';
import { Organization } from '../organization/entities/organization.entity';
import {
  OrganizationStatus,
  OrderStatus,
  PaymentStatus,
  TicketStatus,
} from '../../shared/enum/enum';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { Payment } from './entities/payment.entity';
import { OrganizationPaymentAccount } from './entities/organization-payment-account.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { UpsertOrganizationPaymentAccountDto } from './dto/upsert-organization-payment-account.dto';
import { PaymentCryptoService } from './services/payment-crypto.service';
import { VietQrService } from './services/vietqr.service';
import { randomBytes } from 'crypto';
import { VerifiedBankTransfer } from './payment-verification.provider';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(OrganizationPaymentAccount)
    private readonly accountRepo: Repository<OrganizationPaymentAccount>,
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly crypto: PaymentCryptoService,
    private readonly vietQr: VietQrService,
  ) {}

  async upsertOrganizationAccount(
    organizationId: string,
    dto: UpsertOrganizationPaymentAccountDto,
    currentUser: any,
  ): Promise<ApiResponse<any>> {
    await this.assertCanManageOrganization(organizationId, currentUser);
    const organization = await this.organizationRepo.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    if (
      [
        OrganizationStatus.SUSPENDED,
        OrganizationStatus.ARCHIVED,
        OrganizationStatus.REJECTED,
      ].includes(organization.status)
    ) {
      throw new BadRequestException(
        'This organization cannot configure receiving payments',
      );
    }
    const pendingPaymentCount = await this.paymentRepo.count({
      where: {
        organization: { id: organizationId },
        status: In([
          PaymentStatus.PENDING,
          PaymentStatus.UNDERPAID,
          PaymentStatus.OVERPAID,
        ]),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (pendingPaymentCount) {
      throw new BadRequestException(
        'Cannot change receiving account while payments are pending',
      );
    }
    const encrypted = this.crypto.encrypt(dto.accountNumber);
    let account = await this.accountRepo.findOne({
      where: { organization: { id: organizationId } },
    });
    account = this.accountRepo.create({
      ...(account || {}),
      organization,
      bankBin: dto.bankBin,
      bankName: dto.bankName.trim(),
      accountName: dto.accountName.trim(),
      accountNumberEncrypted: encrypted.encrypted,
      accountNumberIv: encrypted.iv,
      accountNumberTag: encrypted.tag,
    });
    const saved = await this.accountRepo.save(account);
    return Response(
      200,
      'Organization payment account saved successfully',
      this.toMaskedAccount(saved),
    );
  }

  async getOrganizationAccount(
    organizationId: string,
    currentUser: any,
  ): Promise<ApiResponse<any>> {
    await this.assertCanManageOrganization(organizationId, currentUser);
    const account = await this.accountRepo.findOne({
      where: { organization: { id: organizationId } },
    });
    if (!account)
      throw new NotFoundException(
        'Organization payment account is not configured',
      );
    return Response(
      200,
      'Get organization payment account successfully',
      this.toMaskedAccount(account),
    );
  }

  async createForOrder(
    orderId: string,
    currentUser: any,
  ): Promise<ApiResponse<any>> {
    const qrAndPayment = await this.dataSource.transaction(async (manager) => {
      const lockedOrder = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();
      if (!lockedOrder) throw new NotFoundException('Order not found');
      const order = await manager.getRepository(Order).findOne({
        where: { id: orderId },
        relations: [
          'user',
          'organization',
          'items',
          'items.ticketType',
          'items.ticketType.event',
          'items.ticketType.event.organization',
        ],
      });
      if (!order) throw new NotFoundException('Order not found');
      this.assertCanAccessOrder(order, currentUser);
      if (
        order.status !== OrderStatus.PENDING_PAYMENT ||
        !order.expiresAt ||
        order.expiresAt <= new Date()
      ) {
        throw new BadRequestException('Order is not payable or has expired');
      }
      if (!order.items?.length || !order.organization) {
        throw new BadRequestException(
          'Order has no payable items or organization',
        );
      }
      if (
        order.items.some(
          (item) =>
            item.ticketType?.event?.organization?.id !== order.organization.id,
        )
      ) {
        throw new BadRequestException(
          'Order contains ticket types from multiple organizations',
        );
      }
      if (order.organization.status !== OrganizationStatus.ACTIVE) {
        throw new BadRequestException('Organization is not active');
      }
      const existing = await manager
        .getRepository(Payment)
        .findOne({ where: { order: { id: order.id } } });
      if (existing) {
        if (
          existing.status !== PaymentStatus.PENDING ||
          (existing.expiresAt && existing.expiresAt <= new Date())
        ) {
          throw new BadRequestException(
            'Payment is not payable or has expired',
          );
        }
        return {
          payment: existing,
          accountNumber: this.decryptAccount(existing),
        };
      }
      const account = await manager
        .getRepository(OrganizationPaymentAccount)
        .findOne({
          where: { organization: { id: order.organization.id } },
        });
      if (!account)
        throw new BadRequestException(
          'Organization receiving bank account is not configured',
        );
      const accountNumber = this.crypto.decrypt(
        account.accountNumberEncrypted,
        account.accountNumberIv,
        account.accountNumberTag,
      );
      const amount = Number(order.totalPrice);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new BadRequestException(
          'Order total must be a positive integer in VND',
        );
      }
      const reference = `EVT${randomBytes(6).toString('hex').toUpperCase()}`;
      const payment = manager.create(Payment, {
        order,
        organization: order.organization,
        amount,
        currency: 'VND',
        method: 'VIETQR',
        reference,
        status: PaymentStatus.PENDING,
        provider: null,
        providerTransactionId: null,
        verifiedAt: null,
        expiresAt: order.expiresAt,
        bankBin: account.bankBin,
        bankName: account.bankName,
        accountName: account.accountName,
        accountNumberEncrypted: account.accountNumberEncrypted,
        accountNumberIv: account.accountNumberIv,
        accountNumberTag: account.accountNumberTag,
      });
      return { payment: await manager.save(payment), accountNumber };
    });

    const payment = qrAndPayment.payment;
    const qrCode = await this.vietQr.createQrDataUrl({
      bankBin: payment.bankBin,
      accountNumber: qrAndPayment.accountNumber,
      accountName: payment.accountName,
      amount: Number(payment.amount),
      reference: payment.reference,
    });
    return Response(201, 'Payment initialized successfully', {
      paymentId: payment.id,
      orderId,
      organizationId: payment.organization.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.method,
      reference: payment.reference,
      transferContent: payment.reference,
      bank: {
        name: payment.bankName,
        bin: payment.bankBin,
        accountName: payment.accountName,
        accountNumber: this.maskAccountNumber(qrAndPayment.accountNumber),
      },
      qrCode,
      status: payment.status,
      expiresAt: payment.expiresAt,
    });
  }

  async getPayment(
    paymentId: string,
    currentUser: any,
  ): Promise<ApiResponse<any>> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['order', 'order.user', 'organization'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    this.assertCanAccessOrder(payment.order, currentUser);
    if (
      [PaymentStatus.PENDING, PaymentStatus.UNDERPAID].includes(
        payment.status,
      ) &&
      payment.expiresAt &&
      payment.expiresAt <= new Date()
    ) {
      await this.paymentRepo.update(payment.id, {
        status: PaymentStatus.EXPIRED,
      });
      await this.orderRepo.update(payment.order.id, {
        status: OrderStatus.EXPIRED,
      });
      payment.status = PaymentStatus.EXPIRED;
    }
    return Response(200, 'Get payment successfully', {
      id: payment.id,
      orderId: payment.order.id,
      organizationId: payment.organization.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.method,
      reference: payment.reference,
      status: payment.status,
      providerTransactionId: payment.providerTransactionId,
      createdAt: payment.createdAt,
      verifiedAt: payment.verifiedAt,
      expiresAt: payment.expiresAt,
    });
  }

  /** Called only after a configured bank adapter has authenticated and verified its notification. */
  async processVerifiedTransfer(
    providerName: string,
    transfer: VerifiedBankTransfer,
  ): Promise<ApiResponse<any>> {
    if (
      !providerName ||
      !transfer?.transactionId ||
      !transfer.reference ||
      !Number.isSafeInteger(transfer.amount) ||
      transfer.amount <= 0 ||
      !transfer.receivingAccountNumber ||
      !(transfer.occurredAt instanceof Date)
    ) {
      throw new BadRequestException('Invalid verified transfer data');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(Payment)
        .createQueryBuilder('payment')
        .innerJoinAndSelect('payment.order', 'order')
        .setLock('pessimistic_write')
        .where('payment.reference = :reference', {
          reference: transfer.reference,
        })
        .getOne();
      if (!payment) throw new NotFoundException('Payment reference not found');

      const duplicate = await manager
        .getRepository(PaymentTransaction)
        .findOne({
          where: { providerTransactionId: transfer.transactionId },
          relations: ['payment'],
        });
      if (duplicate) {
        if (duplicate.payment?.id === payment.id) {
          return { payment, duplicate: true };
        }
        throw new BadRequestException(
          'Bank transaction has already been processed',
        );
      }
      if (payment.status === PaymentStatus.PAID) {
        throw new BadRequestException('Payment has already been completed');
      }
      if (
        ![PaymentStatus.PENDING, PaymentStatus.UNDERPAID].includes(
          payment.status,
        ) ||
        !payment.expiresAt ||
        payment.expiresAt < new Date() ||
        transfer.occurredAt > payment.expiresAt
      ) {
        throw new BadRequestException('Payment is not pending or has expired');
      }
      const expectedAccount = this.decryptAccount(payment);
      if (transfer.receivingAccountNumber !== expectedAccount) {
        throw new BadRequestException('Receiving bank account does not match');
      }
      const transaction = manager.create(PaymentTransaction, {
        payment,
        providerTransactionId: transfer.transactionId,
        provider: providerName,
        amount: transfer.amount,
        receivingAccountLast4: expectedAccount.slice(-4),
        occurredAt: transfer.occurredAt,
      });
      const existingTransactions = await manager
        .getRepository(PaymentTransaction)
        .createQueryBuilder('transaction')
        .innerJoin('transaction.payment', 'payment')
        .select('COALESCE(SUM(transaction.amount), 0)', 'total')
        .where('payment.id = :paymentId', { paymentId: payment.id })
        .getRawOne<{ total: string }>();
      const receivedAmount =
        Number(existingTransactions?.total || 0) + transfer.amount;
      await manager.save(PaymentTransaction, transaction);
      if (receivedAmount !== Number(payment.amount)) {
        payment.status =
          receivedAmount < Number(payment.amount)
            ? PaymentStatus.UNDERPAID
            : PaymentStatus.OVERPAID;
        await manager.save(payment);
        return { payment, amountMismatch: true };
      }

      const lockedOrder = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId: payment.order.id })
        .getOne();
      const order = lockedOrder
        ? await manager.getRepository(Order).findOne({
            where: { id: payment.order.id },
            relations: ['user', 'items', 'items.ticketType'],
          })
        : null;
      if (!order || order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException('Order is no longer payable');
      }
      if (
        !order.items?.length ||
        order.items.some((item) => !item.ticketType?.id)
      ) {
        throw new BadRequestException('Order has no valid ticket items');
      }
      const ticketTypeIds = [
        ...new Set(order.items.map((item) => item.ticketType.id)),
      ].sort();
      const lockedTicketTypes = await manager
        .getRepository(TicketType)
        .createQueryBuilder('ticketType')
        .setLock('pessimistic_write')
        .where('ticketType.id IN (:...ticketTypeIds)', { ticketTypeIds })
        .orderBy('ticketType.id', 'ASC')
        .getMany();
      if (lockedTicketTypes.length !== ticketTypeIds.length) {
        throw new BadRequestException(
          'Order contains an unavailable ticket type',
        );
      }
      const alreadyHasTickets = await manager.getRepository(Ticket).count({
        where: { order: { id: order.id } },
      });
      if (alreadyHasTickets)
        throw new BadRequestException('Order tickets were already issued');

      payment.status = PaymentStatus.PAID;
      payment.provider = providerName;
      payment.providerTransactionId = transfer.transactionId;
      payment.verifiedAt = new Date();
      order.status = OrderStatus.PAID;
      await manager.save([payment, order]);
      const tickets = order.items.flatMap((item) =>
        Array.from({ length: item.quantity }, () =>
          manager.create(Ticket, {
            user: order.user,
            ticketType: item.ticketType,
            order,
            status: TicketStatus.VALID,
            usedAt: null,
          }),
        ),
      );
      if (tickets.length) await manager.save(Ticket, tickets);
      return { payment, order, issuedTickets: tickets.length };
    });

    if ('amountMismatch' in result) {
      return Response(
        202,
        `Transfer recorded; payment status is ${result.payment.status}`,
        {
          paymentId: result.payment.id,
          status: result.payment.status,
        },
      );
    }
    return Response(
      200,
      result.duplicate
        ? 'Payment notification already processed'
        : 'Payment verified successfully',
      {
        paymentId: result.payment.id,
        orderId: result.payment.order.id,
        status: result.payment.status,
        verifiedAt: result.payment.verifiedAt,
        ...(result.duplicate ? {} : { issuedTickets: result.issuedTickets }),
      },
    );
  }

  private decryptAccount(
    account: Pick<
      Payment,
      'accountNumberEncrypted' | 'accountNumberIv' | 'accountNumberTag'
    >,
  ): string {
    return this.crypto.decrypt(
      account.accountNumberEncrypted,
      account.accountNumberIv,
      account.accountNumberTag,
    );
  }

  private toMaskedAccount(account: OrganizationPaymentAccount) {
    const accountNumber = this.crypto.decrypt(
      account.accountNumberEncrypted,
      account.accountNumberIv,
      account.accountNumberTag,
    );
    return {
      bankBin: account.bankBin,
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: this.maskAccountNumber(accountNumber),
    };
  }

  private maskAccountNumber(value: string): string {
    return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
  }

  private assertCanAccessOrder(order: Order, currentUser: any): void {
    if (
      currentUser?.role?.isSuperAdmin ||
      order.user?.id === currentUser?.userId
    )
      return;
    throw new ForbiddenException(
      'You do not have permission to access this payment',
    );
  }

  private async assertCanManageOrganization(
    organizationId: string,
    currentUser: any,
  ): Promise<void> {
    if (currentUser?.role?.isSuperAdmin) return;
    if (!currentUser?.userId)
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: currentUser.userId },
        organization: { id: organizationId },
        isActive: true,
      },
      relations: ['role', 'role.permissions'],
    });
    const allowed = membership?.role?.permissions?.some(
      (permission) =>
        permission.permission_code === PermissionCode.ORGANIZATION_UPDATE,
    );
    if (!allowed)
      throw new ForbiddenException('Insufficient organization permission');
  }
}
