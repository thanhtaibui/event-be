import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { SortDto } from 'src/common/dtos/sort.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { EventDto } from './dto/event.dto';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { ApiOperation } from '@nestjs/swagger';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) { }

  @Post()
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventService.create(createEventDto);
  }

  @Get()
  @ApiOperation({ operationId: 'getEvents' })
  async findAll(@Param() query: SortDto): Promise<ApiResponse<PaginationResult<EventDto>>> {
    return await this.eventService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventService.update(+id, updateEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventService.remove(+id);
  }
}
