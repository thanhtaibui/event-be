import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { User } from '../user/entities/user.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { Ticket } from '../ticket/entities/ticket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, TicketType, Ticket])],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
