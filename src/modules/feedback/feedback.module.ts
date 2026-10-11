import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { Feedback } from './entities/feedback.entity';
import { Event } from '../event/entities/event.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Membership } from '../membership/entities/membership.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Feedback, Event, Ticket, Membership])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
