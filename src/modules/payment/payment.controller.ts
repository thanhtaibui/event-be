import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionCode } from '../../common/constants/permission-codes';
import { PaymentService } from './payment.service';
import { UpsertOrganizationPaymentAccountDto } from './dto/upsert-organization-payment-account.dto';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Put('organizations/:organizationId/payment-account')
  @Permissions(PermissionCode.ORGANIZATION_UPDATE)
  @ApiOperation({
    summary:
      'Configure an organization receiving account and get verification instructions',
  })
  upsertOrganizationAccount(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: UpsertOrganizationPaymentAccountDto,
    @Req() req: any,
  ) {
    return this.paymentService.upsertOrganizationAccount(
      organizationId,
      dto,
      req.user,
    );
  }

  @Get('organizations/:organizationId/payment-account')
  @Permissions(PermissionCode.ORGANIZATION_UPDATE)
  getOrganizationAccount(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() req: any,
  ) {
    return this.paymentService.getOrganizationAccount(organizationId, req.user);
  }

  @Post('payments/orders/:orderId')
  @ApiOperation({
    summary: 'Initialize a VietQR payment for the authenticated buyer order',
  })
  createForOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: any,
  ) {
    return this.paymentService.createForOrder(orderId, req.user);
  }

  @Get('payments/:paymentId')
  getPayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() req: any,
  ) {
    return this.paymentService.getPayment(paymentId, req.user);
  }
}
