import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PaymentWebhookReceipt,
  PaymentWebhookReceiptStatus,
} from '../entities/payment-webhook-receipt.entity';
import { SePayWebhookNotification } from '../payment-verification.provider';
import { SePayWebhookService } from './sepay-webhook.service';

describe('SePayWebhookService', () => {
  const makeHarness = (options?: {
    receipt?: any;
    payment?: any;
    processResult?: any;
    processError?: Error;
  }) => {
    let storedReceipt = options?.receipt ?? null;
    const receiptRepo: any = {
      findOne: jest.fn(async () => storedReceipt),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        storedReceipt = value;
        return value;
      }),
    };
    const paymentRepo: any = {
      findOne: jest
        .fn()
        .mockResolvedValue(options?.payment ?? { order: { id: 'order-1' } }),
    };
    const paymentService: any = {
      processVerifiedTransfer: options?.processError
        ? jest.fn().mockRejectedValue(options.processError)
        : jest
            .fn()
            .mockResolvedValue(options?.processResult ?? { statusCode: 200 }),
    };
    return {
      service: new SePayWebhookService(
        receiptRepo,
        paymentRepo,
        paymentService,
      ),
      receiptRepo,
      paymentRepo,
      paymentService,
      getReceipt: () => storedReceipt,
    };
  };

  const notification = (
    overrides: Partial<SePayWebhookNotification> = {},
  ): SePayWebhookNotification => ({
    transactionId: '92704',
    reference: 'EVT1234567890AB',
    amount: 150000,
    receivingAccountNumber: '1017588888',
    occurredAt: new Date('2026-10-18T04:08:33.000Z'),
    transferType: 'in',
    idempotencyKey: 'a'.repeat(64),
    payloadSha256: 'b'.repeat(64),
    ...overrides,
  });

  it('processes a valid transfer and marks its receipt processed', async () => {
    const h = makeHarness();
    await expect(
      h.service.handleVerifiedTransfer(notification()),
    ).resolves.toEqual({
      success: true,
    });
    expect(h.paymentService.processVerifiedTransfer).toHaveBeenCalledWith(
      'SEPAY',
      expect.objectContaining({ transactionId: '92704', amount: 150000 }),
    );
    expect(h.getReceipt().status).toBe(PaymentWebhookReceiptStatus.PROCESSED);
  });

  it('records wrong amount for reconciliation without treating it as paid', async () => {
    const h = makeHarness({ processResult: { statusCode: 202 } });
    await h.service.handleVerifiedTransfer(notification({ amount: 50000 }));
    expect(h.getReceipt().status).toBe(
      PaymentWebhookReceiptStatus.RECONCILIATION_REQUIRED,
    );
    expect(h.getReceipt().reconciliationReason).toContain('amount');
  });

  it('stores an unknown reference for reconciliation', async () => {
    const h = makeHarness();
    h.paymentRepo.findOne.mockResolvedValue(null);
    h.paymentService.processVerifiedTransfer.mockRejectedValue(
      new NotFoundException('Payment reference not found'),
    );
    await h.service.handleVerifiedTransfer(notification());
    expect(h.getReceipt().status).toBe(
      PaymentWebhookReceiptStatus.RECONCILIATION_REQUIRED,
    );
    expect(h.getReceipt().order).toBeNull();
  });

  it('stores incomplete signed transfer evidence for reconciliation', async () => {
    const h = makeHarness();
    await h.service.handleVerifiedTransfer(
      notification({ reference: null, amount: null }),
    );
    expect(h.getReceipt().status).toBe(
      PaymentWebhookReceiptStatus.RECONCILIATION_REQUIRED,
    );
    expect(h.paymentService.processVerifiedTransfer).not.toHaveBeenCalled();
  });

  it('keeps a late transfer in reconciliation and does not issue through payment flow', async () => {
    const h = makeHarness({
      processError: new BadRequestException(
        'Payment is not pending or has expired',
      ),
    });
    await h.service.handleVerifiedTransfer(notification());
    expect(h.getReceipt().status).toBe(
      PaymentWebhookReceiptStatus.RECONCILIATION_REQUIRED,
    );
    expect(h.paymentService.processVerifiedTransfer).toHaveBeenCalledTimes(1);
  });

  it('acknowledges a replay without processing or issuing tickets again', async () => {
    const receipt = {
      status: PaymentWebhookReceiptStatus.PROCESSED,
      idempotencyKey: 'a'.repeat(64),
    } as PaymentWebhookReceipt;
    const h = makeHarness({ receipt });
    await expect(
      h.service.handleVerifiedTransfer(notification()),
    ).resolves.toEqual({
      success: true,
    });
    expect(h.paymentService.processVerifiedTransfer).not.toHaveBeenCalled();
  });
});
