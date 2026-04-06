import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EventPostService } from './event-post.service';
import { CreateEventPostDto } from './dto/create-event-post.dto';
import { UpdateEventPostDto } from './dto/update-event-post.dto';

@Controller('event-post')
export class EventPostController {
  constructor(private readonly eventPostService: EventPostService) {}

  @Post()
  create(@Body() createEventPostDto: CreateEventPostDto) {
    return this.eventPostService.create(createEventPostDto);
  }

  @Get()
  findAll() {
    return this.eventPostService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventPostService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventPostDto: UpdateEventPostDto) {
    return this.eventPostService.update(+id, updateEventPostDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventPostService.remove(+id);
  }
}
