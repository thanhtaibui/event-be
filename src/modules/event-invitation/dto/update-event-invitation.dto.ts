import { PartialType } from '@nestjs/mapped-types';
import { CreateEventInvitationDto } from './create-event-invitation.dto';

export class UpdateEventInvitationDto extends PartialType(CreateEventInvitationDto) {}
