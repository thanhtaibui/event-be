import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { EventStatus } from 'src/shared/enum/enum';
import { Repository } from 'typeorm';
import { Event } from '../event/entities/event.entity';
import { Membership } from '../membership/entities/membership.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { Feedback } from './entities/feedback.entity';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
  ) {}

  async create(
    createFeedbackDto: CreateFeedbackDto,
    currentUser?: any,
  ): Promise<ApiResponse<any>> {
    if (!currentUser?.userId) {
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    }

    const event = await this.findEventOrThrow(createFeedbackDto.eventId);
    this.assertEventCompleted(event);

    const hasParticipated = await this.hasUserParticipatedInEvent(
      currentUser.userId,
      event.id,
    );
    if (!hasParticipated) {
      throw new ForbiddenException('USER_DID_NOT_PARTICIPATE_IN_EVENT');
    }

    const existingFeedback = await this.feedbackRepo.findOne({
      where: {
        user: { id: currentUser.userId },
        event: { id: event.id },
      },
    });
    if (existingFeedback) {
      throw new BadRequestException('FEEDBACK_ALREADY_SUBMITTED');
    }

    const feedback = this.feedbackRepo.create({
      userId: currentUser.userId,
      eventId: event.id,
      rating: createFeedbackDto.rating,
      comment: createFeedbackDto.comment.trim(),
    });
    const savedFeedback = await this.feedbackRepo.save(feedback);

    return Response(
      201,
      'Create Feedback Successfully',
      this.toFeedbackDto(savedFeedback),
    );
  }

  async findByEvent(
    eventId: string,
    currentUser?: any,
  ): Promise<ApiResponse<any[]>> {
    const event = await this.findEventOrThrow(eventId);
    await this.assertCanViewEventFeedback(event, currentUser);

    const feedbacks = await this.feedbackRepo.find({
      where: { event: { id: event.id } },
      relations: ['user', 'event'],
      order: { createdAt: 'DESC' },
    });

    return Response(
      200,
      'Get Event Feedback Successfully',
      feedbacks.map((feedback) => this.toFeedbackDto(feedback)),
    );
  }

  private async findEventOrThrow(eventId: string): Promise<Event> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['organization'],
    });

    if (!event) {
      throw new NotFoundException('EVENT_NOT_FOUND');
    }

    return event;
  }

  private assertEventCompleted(event: Event): void {
    const isCompleted =
      event.status === EventStatus.ENDED || event.endDateTime <= new Date();

    if (!isCompleted) {
      throw new BadRequestException('EVENT_NOT_COMPLETED');
    }
  }

  private async hasUserParticipatedInEvent(
    userId: string,
    eventId: string,
  ): Promise<boolean> {
    const count = await this.ticketRepo.count({
      where: {
        user: { id: userId },
        ticketType: {
          event: { id: eventId },
        },
      },
      relations: ['ticketType', 'ticketType.event'],
    });

    return count > 0;
  }

  private async assertCanViewEventFeedback(
    event: Event,
    currentUser?: any,
  ): Promise<void> {
    if (!currentUser?.userId) {
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    }

    if (currentUser.role?.isSuperAdmin) {
      throw new ForbiddenException('SUPER_ADMIN_FEEDBACK_MANAGEMENT_DISABLED');
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: currentUser.userId },
        organization: { id: event.organization.id },
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('USER_DOES_NOT_BELONG_TO_ORGANIZATION');
    }
  }

  private toFeedbackDto(feedback: Feedback) {
    return {
      id: feedback.id,
      rating: feedback.rating ?? null,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
      user: feedback.user
        ? {
            id: feedback.user.id,
            fullName: feedback.user.fullName,
            email: feedback.user.email,
          }
        : { id: feedback.userId },
      event: feedback.event
        ? {
            id: feedback.event.id,
            title: feedback.event.title,
          }
        : { id: feedback.eventId },
    };
  }
}
