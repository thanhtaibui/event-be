import { BadRequestException, Injectable } from '@nestjs/common';
import { VIETQR_BANKS } from './vietqr-bank-catalog';

export interface ValidatedBankAccount {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName?: string;
}

@Injectable()
export class PaymentAccountVerificationService {
  validateAccountFormat(input: {
    bankBin: string;
    accountNumber: string;
    accountName?: string;
  }): ValidatedBankAccount {
    const bankBin = input.bankBin?.trim();
    if (!bankBin) {
      throw new BadRequestException({
        code: 'BANK_BIN_REQUIRED',
        message: 'Bank BIN is required.',
      });
    }

    const bank = VIETQR_BANKS.get(bankBin);
    if (!bank || !bank.transferSupported) {
      throw new BadRequestException({
        code: 'BANK_UNSUPPORTED',
        message: 'This bank is not supported for payment accounts.',
      });
    }

    const accountNumber = input.accountNumber?.trim();
    if (!accountNumber) {
      throw new BadRequestException({
        code: 'INVALID_BANK_ACCOUNT',
        message: 'Bank account number is required.',
      });
    }

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

    let cleanName: string | undefined;
    if (input.accountName !== undefined && input.accountName !== null) {
      cleanName = input.accountName.trim().replace(/\s+/g, ' ');
      if (!cleanName || cleanName.length > 120) {
        throw new BadRequestException({
          code: 'INVALID_ACCOUNT_NAME',
          message:
            'Account holder name cannot be empty and cannot exceed 120 characters.',
        });
      }
    }

    return {
      bankBin: bank.bin,
      bankName: bank.name,
      accountNumber,
      accountName: cleanName,
    };
  }

  validateAccountHolder(input: {
    bankBin: string;
    accountNumber: string;
    accountName: string;
  }): Required<ValidatedBankAccount> {
    const cleanName = input.accountName?.trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      throw new BadRequestException({
        code: 'ACCOUNT_HOLDER_NAME_REQUIRED',
        message: 'Account holder name is required.',
      });
    }
    const validated = this.validateAccountFormat({
      ...input,
      accountName: cleanName,
    });
    return {
      bankBin: validated.bankBin,
      bankName: validated.bankName,
      accountNumber: validated.accountNumber,
      accountName: cleanName,
    };
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
