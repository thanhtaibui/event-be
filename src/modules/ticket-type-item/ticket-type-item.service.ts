import { Injectable } from '@nestjs/common';
import { CreateTicketTypeItemDto } from './dto/create-ticket-type-item.dto';
import { UpdateTicketTypeItemDto } from './dto/update-ticket-type-item.dto';

@Injectable()
export class TicketTypeItemService {
  create(createTicketTypeItemDto: CreateTicketTypeItemDto) {
    return 'This action adds a new ticketTypeItem';
  }

  findAll() {
    return `This action returns all ticketTypeItem`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ticketTypeItem`;
  }

  update(id: number, updateTicketTypeItemDto: UpdateTicketTypeItemDto) {
    return `This action updates a #${id} ticketTypeItem`;
  }

  remove(id: number) {
    return `This action removes a #${id} ticketTypeItem`;
  }
}
