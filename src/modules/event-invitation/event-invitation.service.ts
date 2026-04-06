import { Injectable } from '@nestjs/common';
import { CreateEventInvitationDto } from './dto/create-event-invitation.dto';
import { UpdateEventInvitationDto } from './dto/update-event-invitation.dto';

@Injectable()
export class EventInvitationService {
  create(createEventInvitationDto: CreateEventInvitationDto) {
    return 'This action adds a new eventInvitation';
  }

  findAll() {
    return `This action returns all eventInvitation`;
  }

  findOne(id: number) {
    return `This action returns a #${id} eventInvitation`;
  }

  update(id: number, updateEventInvitationDto: UpdateEventInvitationDto) {
    return `This action updates a #${id} eventInvitation`;
  }

  remove(id: number) {
    return `This action removes a #${id} eventInvitation`;
  }
}
