import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { Order } from '../order/entities/order.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { OrderStatus, PaymentStatus } from '../../shared/enum/enum';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionCode } from '../../common/constants/permission-codes';
import {
  OrganizationPaymentAccount,
  PaymentAccountVerificationStatus,
} from './entities/organization-payment-account.entity';
import { OrganizationStatus } from '../../shared/enum/enum';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertOrganizationPaymentAccountDto } from './dto/upsert-organization-payment-account.dto';

describe('PaymentService verified transfer processing', () => {
  const makeHarness = () => {
    const payment: any = {
      id: 'payment-1',
      orderId: 'order-1',
      order: { id: 'order-1' },
      status: PaymentStatus.PENDING,
      amount: 150000,
      expiresAt: new Date(Date.now() + 60_000),
      accountNumberEncrypted: 'encrypted',
      accountNumberIv: 'iv',
      accountNumberTag: 'tag',
      reference: 'EVT123456',
    };
    const order: any = {
      id: 'order-1',
      status: OrderStatus.PENDING_PAYMENT,
      user: { id: 'buyer-1' },
      items: [{ quantity: 1, ticketType: { id: 'type-1' } }],
    };
    let savedTransaction: any;
    const builder = (getOne: () => any) => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn(getOne),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'type-1' }]),
    });
    const paymentRepo: any = {
      createQueryBuilder: jest.fn(() => builder(() => payment)),
    };
    const transactionRepo: any = {
      findOne: jest.fn(async () => savedTransaction || null),
      createQueryBuilder: jest.fn(() => builder(() => null)),
    };
    const orderRepo: any = {
      createQueryBuilder: jest.fn(() => builder(() => order)),
      findOne: jest.fn(async () => order),
    };
    const ticketRepo: any = { count: jest.fn().mockResolvedValue(0) };
    const manager: any = {
      getRepository: (entity: any) => {
        if (entity === Payment) return paymentRepo;
        if (entity === PaymentTransaction) return transactionRepo;
        if (entity === Order) return orderRepo;
        if (entity === Ticket) return ticketRepo;
        if (entity === TicketType)
          return { createQueryBuilder: jest.fn(() => builder(() => null)) };
        throw new Error('Unexpected entity');
      },
      create: (_entity: any, values: any) => values,
      save: jest.fn(async (entity: any, values: any) => {
        if (entity === PaymentTransaction)
          savedTransaction = { ...values, payment };
        return values;
      }),
    };
    const dataSource: any = {
      transaction: jest.fn((callback: (manager: any) => unknown) =>
        callback(manager),
      ),
    };
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource,
      { decrypt: jest.fn().mockReturnValue('0123456789') } as any,
      {} as any,
      {} as any,
    );
    return {
      service,
      payment,
      order,
      manager,
      ticketRepo,
      getSavedTransaction: () => savedTransaction,
    };
  };

  it('marks exact verified payment paid and issues tickets once', async () => {
    const h = makeHarness();
    const transfer = {
      transactionId: 'bank-tx-1',
      reference: 'EVT123456',
      amount: 150000,
      receivingAccountNumber: '0123456789',
      occurredAt: new Date(),
      transferType: 'in',
    };
    const first = await h.service.processVerifiedTransfer(
      'test-adapter',
      transfer,
    );
    expect(h.payment.status).toBe(PaymentStatus.PAID);
    expect(h.order.status).toBe(OrderStatus.PAID);
    expect(h.manager.save).toHaveBeenCalledWith(Ticket, expect.any(Array));
    expect(first.statusCode).toBe(200);

    const second = await h.service.processVerifiedTransfer(
      'test-adapter',
      transfer,
    );
    expect(second.message).toContain('already processed');
    expect(
      h.manager.save.mock.calls.filter(([entity]: any[]) => entity === Ticket),
    ).toHaveLength(1);
    expect(h.getSavedTransaction().providerTransactionId).toBe('bank-tx-1');
  });

  it('records underpayment without changing the order or issuing tickets', async () => {
    const h = makeHarness();
    const result = await h.service.processVerifiedTransfer('test-adapter', {
      transactionId: 'bank-tx-partial',
      reference: 'EVT123456',
      amount: 50000,
      receivingAccountNumber: '0123456789',
      occurredAt: new Date(),
      transferType: 'in',
    });
    expect(h.payment.status).toBe(PaymentStatus.UNDERPAID);
    expect(h.order.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(result.statusCode).toBe(202);
    expect(h.manager.save).not.toHaveBeenCalledWith(Ticket, expect.anything());
  });

  it('rejects a transfer to a different receiving account without issuing tickets', async () => {
    const h = makeHarness();
    await expect(
      h.service.processVerifiedTransfer('test-adapter', {
        transactionId: 'bank-tx-wrong-account',
        reference: 'EVT123456',
        amount: 150000,
        receivingAccountNumber: '9999999999',
        occurredAt: new Date(),
        transferType: 'in',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.payment.status).toBe(PaymentStatus.PENDING);
    expect(h.manager.save).not.toHaveBeenCalledWith(Ticket, expect.anything());
  });

  it('requires organization-scoped permission to manage receiving account', async () => {
    const membershipRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      membershipRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      (service as any).assertCanManageOrganization('org-a', {
        userId: 'user-a',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(membershipRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization: { id: 'org-a' } }),
      }),
    );

    membershipRepo.findOne.mockResolvedValue({
      role: {
        permissions: [{ permission_code: PermissionCode.ORGANIZATION_UPDATE }],
      },
    });
    await expect(
      (service as any).assertCanManageOrganization('org-a', {
        userId: 'user-a',
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    PaymentAccountVerificationStatus.PENDING,
    PaymentAccountVerificationStatus.FAILED,
  ])('blocks QR payment when account verification is %s', (status) => {
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(() =>
      (service as any).assertPaymentAccountVerified({
        verificationStatus: status,
      } as OrganizationPaymentAccount),
    ).toThrow('must be verified');
  });

  it('allows QR payment only for a verified account', () => {
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(() =>
      (service as any).assertPaymentAccountVerified({
        verificationStatus: PaymentAccountVerificationStatus.VERIFIED,
      } as OrganizationPaymentAccount),
    ).not.toThrow();
  });

  const makeCreatePaymentService = (
    verificationStatus: PaymentAccountVerificationStatus,
  ) => {
    const order: any = {
      id: 'order-1',
      user: { id: 'buyer-1' },
      organization: {
        id: 'org-1',
        status: OrganizationStatus.ACTIVE,
      },
      items: [
        {
          ticketType: {
            event: { organization: { id: 'org-1' } },
          },
        },
      ],
      status: OrderStatus.PENDING_PAYMENT,
      expiresAt: new Date(Date.now() + 60_000),
      totalPrice: 150000,
    };
    const payment: any = {
      id: 'payment-1',
      organization: order.organization,
      status: PaymentStatus.PENDING,
      amount: 150000,
      expiresAt: order.expiresAt,
      reference: 'EVT1234567890AB',
      bankBin: '970422',
      bankName: 'MB',
      accountName: 'NGUYEN VAN A',
      accountNumberEncrypted: 'cipher',
      accountNumberIv: 'iv',
      accountNumberTag: 'tag',
      currency: 'VND',
      method: 'VIETQR',
    };
    const orderRepository: any = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: order.id }),
      })),
      findOne: jest.fn().mockResolvedValue(order),
    };
    const paymentRepository: any = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity, values) => values),
    };
    const accountRepository: any = {
      findOne: jest.fn().mockResolvedValue({
        organization: order.organization,
        verificationStatus,
        accountNumberEncrypted: 'cipher',
        accountNumberIv: 'iv',
        accountNumberTag: 'tag',
        bankBin: '970422',
        bankName: 'MB',
        accountName: 'NGUYEN VAN A',
      }),
    };
    const manager: any = {
      getRepository: (entity: any) => {
        if (entity === Order) return orderRepository;
        if (entity === OrganizationPaymentAccount) return accountRepository;
        if (entity === Payment) return paymentRepository;
        throw new Error('Unexpected repository');
      },
      create: (_entity: any, values: any) => values,
      save: jest.fn(async (_entity, values) => ({ ...payment, ...values })),
    };
    const dataSource: any = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource,
      {
        decrypt: jest.fn().mockReturnValue('0123456789'),
      } as any,
      {
        createQrDataUrl: jest
          .fn()
          .mockResolvedValue('data:image/png;base64,qr'),
      } as any,
      {} as any,
    );
    return { service, accountRepository };
  };

  it.each([
    PaymentAccountVerificationStatus.PENDING,
    PaymentAccountVerificationStatus.FAILED,
  ])('does not create Payment or QR for %s bank account', async (status) => {
    const h = makeCreatePaymentService(status);
    await expect(
      h.service.createForOrder('order-1', { userId: 'buyer-1' }),
    ).rejects.toThrow('must be verified');
    expect(h.accountRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it('creates Payment and QR for a VERIFIED bank account', async () => {
    const h = makeCreatePaymentService(
      PaymentAccountVerificationStatus.VERIFIED,
    );
    const result = await h.service.createForOrder('order-1', {
      userId: 'buyer-1',
    });
    expect(result.statusCode).toBe(201);
    expect(result.data.status).toBe(PaymentStatus.PENDING);
    expect(result.data.qrCode).toBe('data:image/png;base64,qr');
  });

  const makeAccountUpsertService = (lookupAccount: jest.Mock) => {
    const organization: any = {
      id: 'org-1',
      status: OrganizationStatus.ACTIVE,
    };
    let storedAccount: any = {
      id: 'account-1',
      verificationStatus: PaymentAccountVerificationStatus.VERIFIED,
    };
    const accountRepository: any = {
      findOne: jest.fn().mockResolvedValue(storedAccount),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        storedAccount = value;
        return value;
      }),
    };
    const membershipRepository: any = {
      findOne: jest.fn().mockResolvedValue({
        role: {
          permissions: [
            { permission_code: PermissionCode.ORGANIZATION_UPDATE },
          ],
        },
      }),
    };
    const dataSource: any = {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: (entity: any) =>
            entity === OrganizationPaymentAccount
              ? accountRepository
              : { count: jest.fn().mockResolvedValue(0) },
        }),
      ),
    };
    const service = new PaymentService(
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue(organization) } as any,
      accountRepository,
      membershipRepository,
      dataSource,
      {
        encrypt: jest
          .fn()
          .mockReturnValue({ encrypted: 'cipher', iv: 'iv', tag: 'tag' }),
        decrypt: jest.fn().mockReturnValue('0123456789'),
      } as any,
      {} as any,
      { lookupAccount } as any,
    );
    return { service, accountRepository, getAccount: () => storedAccount };
  };

  it('verifies and saves a matching account name after normalization', async () => {
    const h = makeAccountUpsertService(
      jest.fn().mockResolvedValue({
        bankName: 'MB',
        accountName: 'NGUYEN VAN A',
      }),
    );
    const result = await h.service.upsertOrganizationAccount(
      'org-1',
      {
        bankBin: '970422',
        bankName: 'MBBank',
        accountName: '  Nguyễn   Văn A ',
        accountNumber: '0123456789',
      },
      { userId: 'user-1' },
    );
    expect(h.getAccount().verificationStatus).toBe(
      PaymentAccountVerificationStatus.VERIFIED,
    );
    expect(h.getAccount().verifiedAccountName).toBe('NGUYEN VAN A');
    expect(h.getAccount().bankName).toBe('MB');
    expect(JSON.stringify(result)).not.toContain('0123456789');
    expect(JSON.stringify(result)).toContain('******6789');
  });

  it('marks a changed account FAILED and blocks it on name mismatch', async () => {
    const h = makeAccountUpsertService(
      jest.fn().mockResolvedValue({
        bankName: 'MB',
        accountName: 'SOMEONE ELSE',
      }),
    );
    await expect(
      h.service.upsertOrganizationAccount(
        'org-1',
        {
          bankBin: '970422',
          bankName: 'MBBank',
          accountName: 'Nguyen Van A',
          accountNumber: '0123456789',
        },
        { userId: 'user-1' },
      ),
    ).rejects.toThrow('does not match');
    expect(h.getAccount().verificationStatus).toBe(
      PaymentAccountVerificationStatus.FAILED,
    );
    expect(h.getAccount().verifiedAccountName).toBeNull();
  });

  it('keeps a changed account PENDING when the provider is unavailable', async () => {
    const h = makeAccountUpsertService(
      jest.fn().mockRejectedValue(new Error('network unavailable')),
    );
    await expect(
      h.service.upsertOrganizationAccount(
        'org-1',
        {
          bankBin: '970422',
          bankName: 'MBBank',
          accountName: 'Nguyen Van A',
          accountNumber: '0123456789',
        },
        { userId: 'user-1' },
      ),
    ).rejects.toThrow('network unavailable');
    expect(h.getAccount().verificationStatus).toBe(
      PaymentAccountVerificationStatus.PENDING,
    );
  });
});

describe('Organization payment account DTO validation', () => {
  it('rejects whitespace-only bank and account names', async () => {
    const dto = plainToInstance(UpsertOrganizationPaymentAccountDto, {
      bankBin: '970422',
      bankName: '   ',
      accountName: ' \t ',
      accountNumber: '0123456789',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['bankName', 'accountName']),
    );
  });
});
