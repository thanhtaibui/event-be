import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BankAccountLookupInput,
  BankAccountLookupProvider,
  BankAccountLookupResult,
} from '../bank-account-lookup.provider';

interface VietQrLookupResponse {
  code?: string;
  desc?: string;
  data?: { accountName?: string };
}

@Injectable()
export class VietQrAccountLookupProvider extends BankAccountLookupProvider {
  async lookup(
    input: BankAccountLookupInput,
  ): Promise<BankAccountLookupResult> {
    const clientId = process.env.VIETQR_CLIENT_ID?.trim();
    const apiKey = process.env.VIETQR_API_KEY?.trim();
    if (!clientId || !apiKey) {
      throw this.unavailable();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch('https://api.vietqr.io/v2/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          bin: Number(input.bankBin),
          accountNumber: input.accountNumber,
        }),
        signal: controller.signal,
      });
    } catch {
      throw this.unavailable();
    } finally {
      clearTimeout(timeout);
    }

    let body: VietQrLookupResponse;
    try {
      body = (await response.json()) as VietQrLookupResponse;
    } catch {
      throw new BadGatewayException({
        code: 'ACCOUNT_LOOKUP_UNAVAILABLE',
        message: 'Bank account verification is temporarily unavailable.',
      });
    }

    if (body.code === '42') {
      throw new NotFoundException({
        code: 'BANK_ACCOUNT_NOT_FOUND',
        message: 'Bank account could not be verified.',
      });
    }
    if (['10', '21', '22', '41'].includes(body.code || '')) {
      throw new BadRequestException({
        code:
          body.code === '41'
            ? 'BANK_LOOKUP_UNSUPPORTED'
            : 'INVALID_BANK_ACCOUNT',
        message: 'The bank or account details are not supported for lookup.',
      });
    }
    if (!response.ok || body.code !== '00') {
      throw this.unavailable();
    }

    const accountName = body.data?.accountName?.trim();
    if (!accountName) {
      throw this.unavailable();
    }

    return {
      accountNumber: input.accountNumber,
      accountName,
      bankBin: input.bankBin,
      provider: 'VIETQR',
    };
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'ACCOUNT_LOOKUP_UNAVAILABLE',
      message: 'Bank account verification is temporarily unavailable.',
    });
  }
}
