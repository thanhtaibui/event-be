import { BadRequestException } from '@nestjs/common';
import { PaymentCryptoService } from './payment-crypto.service';

describe('PaymentCryptoService', () => {
  const service = new PaymentCryptoService();
  const previousKey = process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY;

  afterEach(() => {
    if (previousKey === undefined)
      delete process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY;
    else process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY = previousKey;
  });

  it('encrypts account numbers and decrypts them only with the configured key', () => {
    process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY = 'a'.repeat(64);
    const encrypted = service.encrypt('0123456789');
    expect(encrypted.encrypted).not.toContain('0123456789');
    expect(
      service.decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag),
    ).toBe('0123456789');
  });

  it('rejects missing or malformed encryption keys', () => {
    process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY = 'invalid';
    expect(() => service.encrypt('0123456789')).toThrow(BadRequestException);
  });
});
