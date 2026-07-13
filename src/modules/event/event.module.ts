import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { Organization } from '../organization/entities/organization.entity';
import { UploadService } from '../upload/upload.service';
import { Membership } from '../membership/entities/membership.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Organization, Membership])],
  controllers: [EventController],
  providers: [EventService, UploadService],
})
export class EventModule {}
