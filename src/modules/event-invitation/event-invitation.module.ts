import { Module } from '@nestjs/common';
import { EventInvitationService } from './event-invitation.service';
import { EventInvitationController } from './event-invitation.controller';

@Module({
  controllers: [EventInvitationController],
  providers: [EventInvitationService],
})
export class EventInvitationModule {}
