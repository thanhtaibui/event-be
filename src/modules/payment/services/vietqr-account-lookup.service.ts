import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

interface VietQrBank {
  bin: string;
  name: string;
  shortName?: string;
  lookupSupported: number;
}

interface VietQrBanksResponse {
  code?: string;
  data?: VietQrBank[];
}

interface VietQrLookupResponse {
  code?: string;
  data?: { accountName?: string };
}

export interface BankAccountLookupResult {
  bankName: string;
  accountName: string;
}

@Injectable()
export class VietQrAccountLookupService {
  private readonly apiBaseUrl = 'https://api.vietqr.io/v2';
  private readonly requestTimeoutMs = 8000;
  private cachedBanks: { expiresAt: number; banks: VietQrBank[] } | null = null;

  async lookupAccount(
    bankBin: string,
    accountNumber: string,
  ): Promise<BankAccountLookupResult> {
    const clientId = process.env.VIETQR_CLIENT_ID?.trim();
    const apiKey = process.env.VIETQR_API_KEY?.trim();
    if (!clientId || !apiKey) {
      throw new ServiceUnavailableException(
        'Bank account verification is not configured',
      );
    }

    const banks = await this.getBanks();
    const bank = banks.find((item) => item.bin === bankBin);
    if (!bank || Number(bank.lookupSupported) !== 1) {
      throw new BadRequestException({
        code: 'BANK_LOOKUP_UNSUPPORTED',
        message: 'This bank is not supported for account verification',
      });
    }

    const response = await this.fetchJson<VietQrLookupResponse>(
      `${this.apiBaseUrl}/lookup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          bin: Number(bankBin),
          accountNumber,
        }),
      },
    );

    if (response.code === '42' || response.code === '21') {
      throw new BadRequestException({
        code: 'BANK_ACCOUNT_NOT_FOUND',
        message: 'The bank account could not be verified',
      });
    }
    if (response.code !== '00') {
      throw new ServiceUnavailableException(
        'Bank account verification provider could not complete the lookup',
      );
    }

    const accountName = response.data?.accountName?.trim();
    if (!accountName) {
      throw new ServiceUnavailableException(
        'Bank account verification provider returned an invalid response',
      );
    }

    return {
      bankName: bank.shortName?.trim() || bank.name.trim(),
      accountName,
    };
  }

  private async getBanks(): Promise<VietQrBank[]> {
    if (this.cachedBanks && this.cachedBanks.expiresAt > Date.now()) {
      return this.cachedBanks.banks;
    }

    const response = await this.fetchJson<VietQrBanksResponse>(
      `${this.apiBaseUrl}/banks`,
      { method: 'GET' },
    );
    if (
      response.code !== '00' ||
      !Array.isArray(response.data) ||
      !response.data.every(
        (bank) =>
          typeof bank?.bin === 'string' &&
          typeof bank.name === 'string' &&
          Number.isFinite(Number(bank.lookupSupported)),
      )
    ) {
      throw new ServiceUnavailableException(
        'Bank list provider returned an invalid response',
      );
    }

    this.cachedBanks = {
      banks: response.data,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    return response.data;
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.status === 401 || response.status === 403) {
        throw new ServiceUnavailableException(
          'Bank account verification credentials are invalid',
        );
      }
      if (!response.ok) {
        throw new ServiceUnavailableException(
          'Bank account verification provider is unavailable',
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Bank account verification provider is unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
