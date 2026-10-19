import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../membership/entities/membership.entity';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { Payment } from './entities/payment.entity';
import { OrganizationPaymentAccount } from './entities/organization-payment-account.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentWebhookReceipt } from './entities/payment-webhook-receipt.entity';
import { BankAccountLookupProvider } from './bank-account-lookup.provider';
import { PaymentController } from './payment.controller';
import { SePayWebhookController } from './sepay-webhook.controller';
import { PaymentService } from './payment.service';
import { PaymentCryptoService } from './services/payment-crypto.service';
import { SePayWebhookProvider } from './services/sepay-webhook.provider';
import { SePayWebhookService } from './services/sepay-webhook.service';
import { VietQrService } from './services/vietqr.service';
import { PaymentAccountVerificationService } from './services/payment-account-verification.service';
import { PaymentAccountLookupTokenService } from './services/payment-account-lookup-token.service';
import { VietQrAccountLookupProvider } from './services/vietqr-account-lookup.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Order,
      OrderItem,
      Organization,
      OrganizationPaymentAccount,
      PaymentTransaction,
      PaymentWebhookReceipt,
      Membership,
      Ticket,
      TicketType,
    ]),
  ],
  controllers: [PaymentController, SePayWebhookController],
  providers: [
    PaymentService,
    PaymentCryptoService,
    VietQrService,
    PaymentAccountVerificationService,
    PaymentAccountLookupTokenService,
    {
      provide: BankAccountLookupProvider,
      useClass: VietQrAccountLookupProvider,
    },
    SePayWebhookProvider,
    SePayWebhookService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
