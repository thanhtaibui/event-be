import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invite } from './entities/invite.entity';
import { MailerModule } from '@nestjs-modules/mailer';
import { Event } from '../event/entities/event.entity';
import { Membership } from '../membership/entities/membership.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Invite, Event, Membership]), MailerModule],
  controllers: [InviteController],
  providers: [InviteService],
})
export class InviteModule {}
