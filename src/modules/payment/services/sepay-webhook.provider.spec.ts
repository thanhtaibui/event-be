import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { SePayWebhookProvider } from './sepay-webhook.provider';

describe('SePayWebhookProvider', () => {
  const originalSecret = process.env.SEPAY_WEBHOOK_SECRET;
  const provider = new SePayWebhookProvider();

  beforeEach(() => {
    process.env.SEPAY_WEBHOOK_SECRET = 'test-sepay-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.SEPAY_WEBHOOK_SECRET;
    else process.env.SEPAY_WEBHOOK_SECRET = originalSecret;
  });

  const signedHeaders = (
    body: Buffer,
    timestamp = `${Math.floor(Date.now() / 1000)}`,
  ) => ({
    'x-sepay-timestamp': timestamp,
    'x-sepay-signature': `sha256=${createHmac('sha256', 'test-sepay-secret')
      .update(`${timestamp}.`)
      .update(body)
      .digest('hex')}`,
  });

  it('authenticates HMAC and maps a SePay incoming transaction', async () => {
    const body = Buffer.from(
      JSON.stringify({
        id: 92704,
        transactionDate: '2026-10-18 11:08:33',
        accountNumber: '1017588888',
        code: null,
        content: 'EVT1234567890AB chuyen tien',
        transferType: 'in',
        transferAmount: 150000,
      }),
    );
    const result = await provider.verifyNotification(signedHeaders(body), body);

    expect(result).toMatchObject({
      transactionId: '92704',
      reference: 'EVT1234567890AB',
      amount: 150000,
      receivingAccountNumber: '1017588888',
      transferType: 'in',
    });
    expect(result.occurredAt?.toISOString()).toBe('2026-10-18T04:08:33.000Z');
    expect(result.idempotencyKey).toHaveLength(64);
    expect(result.payloadSha256).toHaveLength(64);
  });

  it('rejects a forged signature and stale timestamp', async () => {
    const body = Buffer.from('{}');
    await expect(
      provider.verifyNotification(
        {
          'x-sepay-timestamp': `${Math.floor(Date.now() / 1000)}`,
          'x-sepay-signature': 'sha256=bad',
        },
        body,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const oldTimestamp = `${Math.floor(Date.now() / 1000) - 301}`;
    await expect(
      provider.verifyNotification(signedHeaders(body, oldTimestamp), body),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('keeps a correctly signed but incomplete payload available for reconciliation', async () => {
    const body = Buffer.from('{"id":42,"transferType":"in"}');
    const result = await provider.verifyNotification(signedHeaders(body), body);
    expect(result.transactionId).toBe('42');
    expect(result.reference).toBeNull();
    expect(result.amount).toBeNull();
    expect(result.receivingAccountNumber).toBeNull();
  });

  it('does not treat legacy organization verification references as payment references', async () => {
    const body = Buffer.from(
      JSON.stringify({
        id: 92705,
        accountNumber: '1017588888',
        content: 'EVVABCDEF123456',
        transferType: 'in',
        transferAmount: 1000,
      }),
    );
    const result = await provider.verifyNotification(signedHeaders(body), body);
    expect(result.reference).toBeNull();
  });
});
