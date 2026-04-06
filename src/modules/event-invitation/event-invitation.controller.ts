import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EventInvitationService } from './event-invitation.service';
import { CreateEventInvitationDto } from './dto/create-event-invitation.dto';
import { UpdateEventInvitationDto } from './dto/update-event-invitation.dto';

@Controller('event-invitation')
export class EventInvitationController {
  constructor(private readonly eventInvitationService: EventInvitationService) {}

  @Post()
  create(@Body() createEventInvitationDto: CreateEventInvitationDto) {
    return this.eventInvitationService.create(createEventInvitationDto);
  }

  @Get()
  findAll() {
    return this.eventInvitationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventInvitationService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventInvitationDto: UpdateEventInvitationDto) {
    return this.eventInvitationService.update(+id, updateEventInvitationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventInvitationService.remove(+id);
  }
}
