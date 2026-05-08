import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { TicketTypeService } from './ticket-type.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { ApiOperation } from '@nestjs/swagger';
import { TicketTypeDto } from './dto/ticket-type.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';

@Controller('ticket-types')
export class TicketTypeController {
  constructor(private readonly ticketTypeService: TicketTypeService) { }

  @Post()
  @ApiOperation({ operationId: 'createTicketType' })
  create(@Body() createTicketTypeDto: CreateTicketTypeDto) {
    return this.ticketTypeService.create(createTicketTypeDto);
  }

  @Get()
  findAll() {
    return this.ticketTypeService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<TicketTypeDto>> {
    return this.ticketTypeService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateTicketTypeDto: UpdateTicketTypeDto): Promise<ApiResponse<TicketTypeDto>> {
    return this.ticketTypeService.update(id, updateTicketTypeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketTypeService.remove(+id);
  }
}
