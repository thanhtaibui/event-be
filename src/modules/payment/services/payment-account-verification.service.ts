import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BankAccountLookupProvider } from '../bank-account-lookup.provider';
import { VIETQR_BANKS } from './vietqr-bank-catalog';
import { PaymentAccountLookupTokenService } from './payment-account-lookup-token.service';

export interface VerifiedAccountLookup {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  verificationToken: string;
}

@Injectable()
export class PaymentAccountVerificationService {
  constructor(
    private readonly accountLookup: BankAccountLookupProvider,
    private readonly lookupToken: PaymentAccountLookupTokenService,
  ) {}

  async lookup(input: {
    organizationId: string;
    userId: string;
    bankBin: string;
    accountNumber: string;
  }): Promise<VerifiedAccountLookup> {
    const bank = VIETQR_BANKS.get(input.bankBin);
    if (!bank?.transferSupported || !bank.lookupSupported) {
      throw new BadRequestException({
        code: 'BANK_LOOKUP_UNSUPPORTED',
        message: 'This bank is not supported for beneficiary lookup.',
      });
    }

    const accountNumber = input.accountNumber.trim();
    if (
      (bank.accountNumber.numericOnly && !/^\d+$/.test(accountNumber)) ||
      accountNumber.length < bank.accountNumber.minLength ||
      accountNumber.length > bank.accountNumber.maxLength ||
      this.isSuspiciousAccountNumber(accountNumber)
    ) {
      throw new BadRequestException({
        code: 'INVALID_BANK_ACCOUNT',
        message: 'Bank account number format is invalid.',
      });
    }

    const result = await this.accountLookup.lookup({
      bankBin: input.bankBin,
      accountNumber,
    });
    if (
      result.bankBin !== input.bankBin ||
      result.accountNumber !== accountNumber ||
      !result.accountName?.trim() ||
      !result.provider?.trim()
    ) {
      throw new ServiceUnavailableException({
        code: 'ACCOUNT_LOOKUP_UNAVAILABLE',
        message: 'Bank account verification is temporarily unavailable.',
      });
    }

    const accountName = result.accountName.trim().replace(/\s+/g, ' ');
    let verificationToken: string;
    try {
      verificationToken = this.lookupToken.issue({
        organizationId: input.organizationId,
        userId: input.userId,
        bankBin: input.bankBin,
        accountNumber,
        accountName,
        provider: result.provider,
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'ACCOUNT_LOOKUP_UNAVAILABLE',
        message: 'Bank account verification is temporarily unavailable.',
      });
    }

    return {
      bankBin: input.bankBin,
      bankName: bank.name,
      accountNumber,
      accountName,
      verificationToken,
    };
  }

  verifyConfirmation(input: {
    organizationId: string;
    userId: string;
    bankBin: string;
    accountNumber: string;
    verificationToken: string;
  }): { accountName: string; provider: string; bankName: string } {
    const bank = VIETQR_BANKS.get(input.bankBin);
    if (!bank?.transferSupported || !bank.lookupSupported) {
      throw new BadRequestException({
        code: 'BANK_LOOKUP_UNSUPPORTED',
        message: 'This bank is not supported for beneficiary lookup.',
      });
    }
    const verified = this.lookupToken.verify(input.verificationToken, {
      organizationId: input.organizationId,
      userId: input.userId,
      bankBin: input.bankBin,
      accountNumber: input.accountNumber.trim(),
    });
    return { ...verified, bankName: bank.name };
  }

  isSuspiciousAccountNumber(accountNumber: string): boolean {
    if (/^(\d)\1+$/.test(accountNumber)) return true;
    if (new Set(accountNumber).size <= 2 && accountNumber.length >= 10) {
      return true;
    }
    if (accountNumber.length >= 8) {
      const ascending = '01234567890123456789';
      const descending = '98765432109876543210';
      if (
        ascending.includes(accountNumber) ||
        descending.includes(accountNumber)
      ) {
        return true;
      }
    }
    return false;
  }
}
