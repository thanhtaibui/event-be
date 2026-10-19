import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import {
  OrganizationPaymentAccount,
  PaymentAccountVerificationStatus,
} from '../entities/organization-payment-account.entity';
import {
  PaymentWebhookReceipt,
  PaymentWebhookReceiptStatus,
} from '../entities/payment-webhook-receipt.entity';
import {
  SePayWebhookNotification,
  VerifiedBankTransfer,
} from '../payment-verification.provider';
import { PaymentService } from '../payment.service';
import { PaymentCryptoService } from './payment-crypto.service';

@Injectable()
export class SePayWebhookService {
  constructor(
    @InjectRepository(PaymentWebhookReceipt)
    private readonly receiptRepo: Repository<PaymentWebhookReceipt>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly paymentService: PaymentService,
    private readonly crypto: PaymentCryptoService,
  ) {}

  async handleVerifiedTransfer(transfer: SePayWebhookNotification) {
    let receipt = await this.receiptRepo.findOne({
      where: { idempotencyKey: transfer.idempotencyKey },
    });
    if (receipt && receipt.status !== PaymentWebhookReceiptStatus.RECEIVED) {
      return { success: true };
    }

    const isVerificationTransfer = this.isVerificationReference(
      transfer.reference,
    );
    const payment =
      !isVerificationTransfer &&
      transfer.transferType === 'in' &&
      transfer.reference
        ? await this.paymentRepo.findOne({
            where: { reference: transfer.reference },
            relations: ['order'],
          })
        : null;

    if (!receipt) {
      receipt = this.receiptRepo.create({
        idempotencyKey: transfer.idempotencyKey,
        providerTransactionId: transfer.transactionId,
        reference: transfer.reference,
        amount: transfer.amount,
        receivingAccountLast4:
          transfer.receivingAccountNumber?.slice(-4) ?? null,
        occurredAt: transfer.occurredAt,
        payloadSha256: transfer.payloadSha256,
        status: PaymentWebhookReceiptStatus.RECEIVED,
        reconciliationReason: null,
        orderId: payment?.order?.id ?? null,
        order: payment?.order ?? null,
      });
      try {
        receipt = await this.receiptRepo.save(receipt);
      } catch (error) {
        if (!this.isUniqueViolation(error)) throw error;
        receipt = await this.receiptRepo.findOne({
          where: { idempotencyKey: transfer.idempotencyKey },
        });
        if (!receipt) throw error;
        if (receipt.status !== PaymentWebhookReceiptStatus.RECEIVED) {
          return { success: true };
        }
      }
    } else if (payment?.order && !receipt.order) {
      receipt.orderId = payment.order.id;
      receipt.order = payment.order;
      await this.receiptRepo.save(receipt);
    }

    const incompleteReason = this.getIncompleteReason(transfer);
    if (incompleteReason) {
      await this.markForReconciliation(receipt, incompleteReason);
      return { success: true };
    }

    if (isVerificationTransfer) {
      await this.processOrganizationAccountVerification(receipt, transfer);
      return { success: true };
    }

    try {
      const verifiedTransfer: VerifiedBankTransfer = {
        transactionId: transfer.transactionId!,
        reference: transfer.reference!,
        amount: transfer.amount!,
        receivingAccountNumber: transfer.receivingAccountNumber!,
        occurredAt: transfer.occurredAt!,
        transferType: transfer.transferType!,
      };
      const result = await this.paymentService.processVerifiedTransfer(
        'SEPAY',
        verifiedTransfer,
      );
      if (result.statusCode === 202) {
        await this.markForReconciliation(
          receipt,
          'Transfer amount does not settle the payment exactly',
        );
      } else {
        receipt.status = PaymentWebhookReceiptStatus.PROCESSED;
        receipt.reconciliationReason = null;
        await this.receiptRepo.save(receipt);
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        await this.markForReconciliation(
          receipt,
          error instanceof NotFoundException
            ? 'No payment matches the transfer reference'
            : 'Transfer could not be automatically reconciled',
        );
        return { success: true };
      }
      throw error;
    }

    return { success: true };
  }

  private getIncompleteReason(
    transfer: SePayWebhookNotification,
  ): string | null {
    if (!transfer.transactionId) return 'Missing provider transaction ID';
    if (!transfer.reference) return 'Missing or unrecognized payment reference';
    if (
      transfer.amount === null ||
      !Number.isSafeInteger(transfer.amount) ||
      transfer.amount <= 0
    ) {
      return 'Missing or invalid transfer amount';
    }
    if (!transfer.receivingAccountNumber) {
      return 'Missing or invalid receiving account number';
    }
    if (!(transfer.occurredAt instanceof Date)) {
      return 'Missing or invalid transaction date';
    }
    if (transfer.transferType !== 'in') {
      return 'Transfer is not an incoming payment';
    }
    return null;
  }

  private isVerificationReference(reference: string | null): boolean {
    return !!reference && /^EVV[A-F0-9]{12}$/i.test(reference);
  }

  private async processOrganizationAccountVerification(
    receipt: PaymentWebhookReceipt,
    transfer: SePayWebhookNotification,
  ): Promise<void> {
    if (transfer.transferType !== 'in') {
      await this.markForReconciliation(
        receipt,
        'Verification transfer is not incoming',
      );
      return;
    }
    if (transfer.amount !== 1000) {
      await this.markForReconciliation(
        receipt,
        'Verification transfer amount does not match the requested amount',
      );
      return;
    }

    const outcome = await this.dataSource.transaction(async (manager) => {
      const accountRepository = manager.getRepository(
        OrganizationPaymentAccount,
      );
      const account = await accountRepository.findOne({
        where: { verificationReference: transfer.reference! },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) return 'REFERENCE_NOT_FOUND' as const;
      if (
        account.verificationStatus !== PaymentAccountVerificationStatus.PENDING
      ) {
        return 'NOT_PENDING' as const;
      }

      const expectedAccountNumber = this.crypto.decrypt(
        account.accountNumberEncrypted,
        account.accountNumberIv,
        account.accountNumberTag,
      );
      if (transfer.receivingAccountNumber !== expectedAccountNumber) {
        return 'ACCOUNT_MISMATCH' as const;
      }

      account.verificationStatus = PaymentAccountVerificationStatus.VERIFIED;
      account.verifiedAccountName = null;
      account.verifiedAt = new Date();
      account.verificationProvider = 'SEPAY';
      account.verificationFailureReason = null;
      await accountRepository.save(account);
      return 'VERIFIED' as const;
    });

    if (outcome === 'VERIFIED' || outcome === 'NOT_PENDING') {
      receipt.status = PaymentWebhookReceiptStatus.PROCESSED;
      receipt.reconciliationReason =
        outcome === 'NOT_PENDING'
          ? 'Verification reference was already processed'
          : null;
      await this.receiptRepo.save(receipt);
      return;
    }

    const reasonByOutcome = {
      REFERENCE_NOT_FOUND:
        'No organization account matches the verification reference',
      ACCOUNT_MISMATCH:
        'Verification transfer receiving account does not match',
    } as const;
    await this.markForReconciliation(receipt, reasonByOutcome[outcome]);
  }

  private async markForReconciliation(
    receipt: PaymentWebhookReceipt,
    reason: string,
  ): Promise<void> {
    receipt.status = PaymentWebhookReceiptStatus.RECONCILIATION_REQUIRED;
    receipt.reconciliationReason = reason;
    await this.receiptRepo.save(receipt);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'driverError' in error &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError &&
      error.driverError.code === '23505'
    );
  }
}
