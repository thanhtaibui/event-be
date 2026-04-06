import { Module } from '@nestjs/common';
import { EventPostService } from './event-post.service';
import { EventPostController } from './event-post.controller';

@Module({
  controllers: [EventPostController],
  providers: [EventPostService],
})
export class EventPostModule {}
