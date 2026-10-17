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
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentCryptoService } from './services/payment-crypto.service';
import { VietQrService } from './services/vietqr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Order,
      OrderItem,
      Organization,
      OrganizationPaymentAccount,
      PaymentTransaction,
      Membership,
      Ticket,
      TicketType,
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentCryptoService, VietQrService],
  exports: [PaymentService],
})
export class PaymentModule {}
