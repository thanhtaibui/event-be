import { Module } from '@nestjs/common';
import { TicketTypeItemService } from './ticket-type-item.service';
import { TicketTypeItemController } from './ticket-type-item.controller';

@Module({
  controllers: [TicketTypeItemController],
  providers: [TicketTypeItemService],
})
export class TicketTypeItemModule {}
