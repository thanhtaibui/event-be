import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class PaymentCryptoService {
  private getKey(): Buffer {
    const encoded = process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY;
    if (!encoded || !/^[a-fA-F0-9]{64}$/.test(encoded)) {
      throw new BadRequestException(
        'PAYMENT_ACCOUNT_ENCRYPTION_KEY must be a 32-byte hex key',
      );
    }
    return Buffer.from(encoded, 'hex');
  }

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getKey(),
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
