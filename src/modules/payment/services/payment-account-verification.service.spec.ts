import { BadRequestException } from '@nestjs/common';
import { PaymentAccountVerificationService } from './payment-account-verification.service';

describe('PaymentAccountVerificationService', () => {
  const service = new PaymentAccountVerificationService();

  describe('validateAccountFormat', () => {
    it('validates a correct bank BIN and account number', () => {
      const result = service.validateAccountFormat({
        bankBin: '970415',
        accountNumber: '10087387466',
        accountName: '  NGUYEN   VAN   A  ',
      });
      expect(result).toEqual({
        bankBin: '970415',
        bankName: 'VietinBank',
        accountNumber: '10087387466',
        accountName: 'NGUYEN VAN A',
      });
    });

    it('rejects an empty or missing bank BIN', () => {
      expect(() =>
        service.validateAccountFormat({
          bankBin: '',
          accountNumber: '10087387466',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects an unsupported bank BIN', () => {
      expect(() =>
        service.validateAccountFormat({
          bankBin: '000000',
          accountNumber: '10087387466',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects an empty or missing account number', () => {
      expect(() =>
        service.validateAccountFormat({
          bankBin: '970415',
          accountNumber: '',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects non-numeric account numbers', () => {
      expect(() =>
        service.validateAccountFormat({
          bankBin: '970415',
          accountNumber: '1008738746A',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects account numbers outside length bounds (< 6 or > 19)', () => {
      expect(() =>
        service.validateAccountFormat({
          bankBin: '970415',
          accountNumber: '12345',
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        service.validateAccountFormat({
          bankBin: '970415',
          accountNumber: '12345678901234567890',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects suspicious account numbers', () => {
      expect(() =>
        service.validateAccountFormat({
          bankBin: '970415',
          accountNumber: '1111111111',
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        service.validateAccountFormat({
          bankBin: '970415',
          accountNumber: '0123456789',
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        service.validateAccountFormat({
          bankBin: '970415',
          accountNumber: '9876543210',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects an account name that exceeds 120 characters', () => {
      expect(() =>
        service.validateAccountFormat({
          bankBin: '970415',
          accountNumber: '10087387466',
          accountName: 'A'.repeat(121),
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('validateAccountHolder', () => {
    it('validates and collapses whitespace in account holder name', () => {
      const result = service.validateAccountHolder({
        bankBin: '970422',
        accountNumber: '10087387466',
        accountName: '  TRAN   VAN   B  ',
      });
      expect(result).toEqual({
        bankBin: '970422',
        bankName: 'MBBank',
        accountNumber: '10087387466',
        accountName: 'TRAN VAN B',
      });
    });

    it('rejects empty or whitespace-only account holder name', () => {
      expect(() =>
        service.validateAccountHolder({
          bankBin: '970422',
          accountNumber: '10087387466',
          accountName: '   ',
        }),
      ).toThrow(BadRequestException);
    });
  });
});
