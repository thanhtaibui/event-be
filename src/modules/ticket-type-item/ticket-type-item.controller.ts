import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TicketTypeItemService } from './ticket-type-item.service';
import { CreateTicketTypeItemDto } from './dto/create-ticket-type-item.dto';
import { UpdateTicketTypeItemDto } from './dto/update-ticket-type-item.dto';

@Controller('ticket-type-item')
export class TicketTypeItemController {
  constructor(private readonly ticketTypeItemService: TicketTypeItemService) {}

  @Post()
  create(@Body() createTicketTypeItemDto: CreateTicketTypeItemDto) {
    return this.ticketTypeItemService.create(createTicketTypeItemDto);
  }

  @Get()
  findAll() {
    return this.ticketTypeItemService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketTypeItemService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTicketTypeItemDto: UpdateTicketTypeItemDto,
  ) {
    return this.ticketTypeItemService.update(+id, updateTicketTypeItemDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketTypeItemService.remove(+id);
  }
}
