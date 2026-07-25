import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { User } from '../user/entities/user.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, User, TicketType])],
  controllers: [TicketController],
  providers: [TicketService],
})
export class TicketModule {}
