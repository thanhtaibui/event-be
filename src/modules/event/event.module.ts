import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { Organization } from '../organization/entities/organization.entity';
import { UploadModule } from '../upload/upload.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { Membership } from '../membership/entities/membership.entity';
import { Category } from '../category/entities/category.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Organization, Membership, Category]),
    NotificationModule,
    UploadModule,
    CloudinaryModule,
  ],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
