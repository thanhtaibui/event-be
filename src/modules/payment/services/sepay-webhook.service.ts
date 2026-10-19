import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import {
  PaymentWebhookReceipt,
  PaymentWebhookReceiptStatus,
} from '../entities/payment-webhook-receipt.entity';
import {
  SePayWebhookNotification,
  VerifiedBankTransfer,
} from '../payment-verification.provider';
import { PaymentService } from '../payment.service';

@Injectable()
export class SePayWebhookService {
  constructor(
    @InjectRepository(PaymentWebhookReceipt)
    private readonly receiptRepo: Repository<PaymentWebhookReceipt>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly paymentService: PaymentService,
  ) {}

  async handleVerifiedTransfer(transfer: SePayWebhookNotification) {
    let receipt = await this.receiptRepo.findOne({
      where: { idempotencyKey: transfer.idempotencyKey },
    });
    if (receipt && receipt.status !== PaymentWebhookReceiptStatus.RECEIVED) {
      return { success: true };
    }

    const payment =
      transfer.transferType === 'in' && transfer.reference
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
