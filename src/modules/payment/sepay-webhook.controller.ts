import { Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request } from 'express';
import { SePayWebhookProvider } from './services/sepay-webhook.provider';
import { SePayWebhookService } from './services/sepay-webhook.service';

@Controller('payments/webhooks')
export class SePayWebhookController {
  constructor(
    private readonly provider: SePayWebhookProvider,
    private readonly webhookService: SePayWebhookService,
  ) {}

  @Post('sepay')
  @ApiExcludeEndpoint()
  async receive(@Req() request: RawBodyRequest<Request>) {
    if (!request.rawBody) {
      throw new UnauthorizedException('Missing raw webhook body');
    }
    const transfer = await this.provider.verifyNotification(
      request.headers,
      request.rawBody,
    );
    return this.webhookService.handleVerifiedTransfer(transfer);
  }
}
