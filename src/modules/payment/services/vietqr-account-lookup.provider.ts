import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BankAccountLookupInput,
  BankAccountLookupProvider,
  BankAccountLookupResult,
} from '../bank-account-lookup.provider';

interface VietQrLookupResponse {
  code?: string | number;
  desc?: string;
  data?: { accountName?: string };
}

@Injectable()
export class VietQrAccountLookupProvider extends BankAccountLookupProvider {
  private readonly logger = new Logger(VietQrAccountLookupProvider.name);

  async lookup(
    input: BankAccountLookupInput,
  ): Promise<BankAccountLookupResult> {
    const clientId = process.env.VIETQR_CLIENT_ID?.trim();
    const apiKey = process.env.VIETQR_API_KEY?.trim();
    if (!clientId || !apiKey) {
      this.logger.error(
        'VietQR lookup unavailable: VIETQR_CLIENT_ID or VIETQR_API_KEY environment variable is missing or empty.',
      );
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
    } catch (err: any) {
      this.logger.error(
        `VietQR lookup request failed or timed out: ${err?.message || err}`,
      );
      throw this.unavailable();
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn('VietQR lookup rate limit exceeded (HTTP 429).');
      throw new HttpException(
        {
          code: 'ACCOUNT_LOOKUP_RATE_LIMITED',
          message:
            'Bank account verification rate limit exceeded. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      response.status === HttpStatus.UNAUTHORIZED ||
      response.status === HttpStatus.FORBIDDEN
    ) {
      this.logger.error(
        `VietQR lookup authentication failed with HTTP ${response.status}. Please check VIETQR_CLIENT_ID and VIETQR_API_KEY.`,
      );
      throw this.unavailable();
    }

    let body: VietQrLookupResponse;
    try {
      body = (await response.json()) as VietQrLookupResponse;
    } catch {
      this.logger.error(
        `VietQR lookup response could not be parsed as JSON (HTTP ${response.status}).`,
      );
      throw new BadGatewayException({
        code: 'ACCOUNT_LOOKUP_UNAVAILABLE',
        message: 'Bank account verification is temporarily unavailable.',
      });
    }

    const responseCode =
      body.code !== undefined && body.code !== null ? String(body.code) : '';

    if (responseCode === '429') {
      this.logger.warn('VietQR lookup rate limit exceeded (code 429).');
      throw new HttpException(
        {
          code: 'ACCOUNT_LOOKUP_RATE_LIMITED',
          message:
            'Bank account verification rate limit exceeded. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (responseCode === '42') {
      throw new NotFoundException({
        code: 'BANK_ACCOUNT_NOT_FOUND',
        message: 'Bank account could not be verified.',
      });
    }
    if (['10', '21', '22', '41'].includes(responseCode)) {
      throw new BadRequestException({
        code:
          responseCode === '41'
            ? 'BANK_LOOKUP_UNSUPPORTED'
            : 'INVALID_BANK_ACCOUNT',
        message: 'The bank or account details are not supported for lookup.',
      });
    }
    if (!response.ok || responseCode !== '00') {
      this.logger.error(
        `VietQR lookup returned unsuccessful response: HTTP ${response.status ?? 'unknown'}, code: ${responseCode}, desc: ${body.desc || 'N/A'}`,
      );
      throw this.unavailable();
    }

    const accountName = body.data?.accountName?.trim();
    if (!accountName) {
      this.logger.warn(
        'VietQR lookup returned success code 00 but missing accountName in data.',
      );
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
