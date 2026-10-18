import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  PaymentVerificationProvider,
  SePayWebhookNotification,
} from '../payment-verification.provider';

@Injectable()
export class SePayWebhookProvider implements PaymentVerificationProvider {
  async verifyNotification(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<SePayWebhookNotification> {
    const secret = process.env.SEPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException(
        'SePay webhook verification is not configured',
      );
    }
    if (!Buffer.isBuffer(rawBody)) {
      throw new UnauthorizedException('Missing raw webhook body');
    }

    const signature = this.header(headers, 'x-sepay-signature');
    const timestamp = this.header(headers, 'x-sepay-timestamp');
    const timestampSeconds = Number(timestamp);
    if (
      !signature ||
      !/^\d+$/.test(timestamp || '') ||
      !Number.isSafeInteger(timestampSeconds) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > 300
    ) {
      throw new UnauthorizedException('Invalid or expired SePay signature');
    }

    const expected = `sha256=${createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex')}`;
    const expectedBytes = Buffer.from(expected, 'utf8');
    const receivedBytes = Buffer.from(signature, 'utf8');
    if (
      expectedBytes.length !== receivedBytes.length ||
      !timingSafeEqual(expectedBytes, receivedBytes)
    ) {
      throw new UnauthorizedException('Invalid or expired SePay signature');
    }

    const payloadSha256 = createHash('sha256').update(rawBody).digest('hex');
    let payload: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      // A correctly signed but unreadable payload is retained for reconciliation.
    }

    const transactionId = this.stringValue(payload.id);
    const reference = this.paymentReference(payload.code, payload.content);
    const occurredAt = this.parseVietnameseDate(payload.transactionDate);
    const idempotencySource = transactionId
      ? `SEPAY:${transactionId}`
      : `SEPAY:BODY:${payloadSha256}`;

    return {
      transactionId,
      reference,
      amount:
        typeof payload.transferAmount === 'number' &&
        Number.isSafeInteger(payload.transferAmount) &&
        payload.transferAmount > 0
          ? payload.transferAmount
          : null,
      receivingAccountNumber:
        typeof payload.accountNumber === 'string' &&
        /^\d{6,19}$/.test(payload.accountNumber)
          ? payload.accountNumber
          : null,
      occurredAt,
      transferType:
        typeof payload.transferType === 'string'
          ? payload.transferType.toLowerCase()
          : null,
      idempotencyKey: createHash('sha256')
        .update(idempotencySource)
        .digest('hex'),
      payloadSha256,
    };
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private stringValue(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
      return String(value);
    }
    return null;
  }

  private paymentReference(code: unknown, content: unknown): string | null {
    const validReference = /^EVT[A-F0-9]{12}$/i;
    if (typeof code === 'string' && validReference.test(code.trim())) {
      return code.trim().toUpperCase();
    }
    if (typeof content !== 'string') return null;
    const match = content.match(/\bEVT[A-F0-9]{12}\b/i);
    return match?.[0]?.toUpperCase() ?? null;
  }

  private parseVietnameseDate(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    );
    if (!match) return null;
    const [, year, month, day, hour, minute, second] = match.map(Number);
    if (hour > 23 || minute > 59 || second > 59) return null;
    const result = new Date(
      Date.UTC(year, month - 1, day, hour - 7, minute, second),
    );
    if (
      result.getUTCFullYear() !== year ||
      result.getUTCMonth() !== month - 1 ||
      result.getUTCDate() !== day
    ) {
      return null;
    }
    return result;
  }
}
