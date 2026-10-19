import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

interface LookupTokenPayload {
  organizationId: string;
  userId: string;
  bankBin: string;
  accountNumberHash: string;
  accountName: string;
  provider: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

@Injectable()
export class PaymentAccountLookupTokenService {
  private static readonly TOKEN_TTL_SECONDS = 5 * 60;
  private static readonly TOKEN_PURPOSE = 'eventix:payment-account-lookup:v1';

  issue(input: {
    organizationId: string;
    userId: string;
    bankBin: string;
    accountNumber: string;
    accountName: string;
    provider: string;
  }): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: LookupTokenPayload = {
      organizationId: input.organizationId,
      userId: input.userId,
      bankBin: input.bankBin,
      accountNumberHash: this.accountHash(input.accountNumber),
      accountName: input.accountName,
      provider: input.provider,
      issuedAt: now,
      expiresAt: now + PaymentAccountLookupTokenService.TOKEN_TTL_SECONDS,
      nonce: randomBytes(16).toString('base64url'),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  verify(
    token: string,
    expected: {
      organizationId: string;
      userId: string;
      bankBin: string;
      accountNumber: string;
    },
  ): { accountName: string; provider: string } {
    const parts = token.split('.');
    if (parts.length !== 2) this.invalidToken();

    const expectedSignature = Buffer.from(this.sign(parts[0]), 'base64url');
    const actualSignature = Buffer.from(parts[1], 'base64url');
    if (
      expectedSignature.length !== actualSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      this.invalidToken();
    }

    let payload: LookupTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8'),
      ) as LookupTokenPayload;
    } catch {
      this.invalidToken();
    }

    const now = Math.floor(Date.now() / 1000);
    if (
      !payload.organizationId ||
      !payload.userId ||
      !payload.bankBin ||
      !payload.accountName?.trim() ||
      !payload.provider ||
      !payload.nonce ||
      !Number.isSafeInteger(payload.issuedAt) ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.issuedAt > now ||
      payload.expiresAt <= now ||
      payload.expiresAt - payload.issuedAt >
        PaymentAccountLookupTokenService.TOKEN_TTL_SECONDS ||
      payload.organizationId !== expected.organizationId ||
      payload.userId !== expected.userId ||
      payload.bankBin !== expected.bankBin ||
      payload.accountNumberHash !== this.accountHash(expected.accountNumber)
    ) {
      this.invalidToken();
    }

    return { accountName: payload.accountName, provider: payload.provider };
  }

  private accountHash(accountNumber: string): string {
    return createHmac('sha256', this.getSigningKey())
      .update(`account:${accountNumber}`)
      .digest('base64url');
  }

  private sign(value: string): string {
    return createHmac('sha256', this.getSigningKey())
      .update(value)
      .digest('base64url');
  }

  private getSigningKey(): Buffer {
    const rootSecret = process.env.JWT_SECRET;
    if (!rootSecret) {
      throw new ServiceUnavailableException({
        code: 'ACCOUNT_LOOKUP_UNAVAILABLE',
        message: 'Bank account verification is temporarily unavailable.',
      });
    }
    return createHmac('sha256', rootSecret)
      .update(PaymentAccountLookupTokenService.TOKEN_PURPOSE)
      .digest();
  }

  private invalidToken(): never {
    throw new BadRequestException({
      code: 'PAYMENT_ACCOUNT_LOOKUP_TOKEN_INVALID',
      message: 'Lookup confirmation expired or does not match this account.',
    });
  }
}
