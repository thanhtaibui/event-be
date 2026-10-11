import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus } from 'src/shared/enum/enum';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  const user = {
    id: 'user-1',
    fullName: 'Nguyen Van A',
    email: 'user@example.com',
  };
  const organization = { id: 'org-1', name: 'Green Future Community' };
  const event = {
    id: 'event-1',
    title: 'Green Life Festival 2026',
    status: EventStatus.ENDED,
    endDateTime: new Date('2026-01-01T00:00:00.000Z'),
    organization,
  };
  const currentUser = {
    userId: user.id,
    role: { isSuperAdmin: false, permissions: ['EVENT_VIEW'] },
  };

  it('allows a participant to submit feedback', async () => {
    const { service, feedbackRepo, ticketRepo } = createService();
    ticketRepo.count.mockResolvedValueOnce(1);
    feedbackRepo.findOne.mockResolvedValueOnce(null);
    feedbackRepo.save.mockImplementationOnce(async (feedback) => ({
      id: 'feedback-1',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      ...feedback,
    }));

    const result = await service.create(
      {
        eventId: event.id,
        rating: 5,
        comment: 'Sự kiện rất tốt',
      },
      currentUser,
    );

    expect(result.statusCode).toBe(201);
    expect(result.data).toMatchObject({
      id: 'feedback-1',
      rating: 5,
      comment: 'Sự kiện rất tốt',
      user: { id: user.id },
      event: { id: event.id },
    });
    expect(feedbackRepo.create).toHaveBeenCalledWith({
      userId: user.id,
      eventId: event.id,
      rating: 5,
      comment: 'Sự kiện rất tốt',
    });
  });

  it('rejects unauthenticated user', async () => {
    const { service } = createService();

    await expect(
      service.create(
        {
          eventId: event.id,
          comment: 'Sự kiện rất tốt',
        },
        undefined,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects user who did not participate in the event', async () => {
    const { service, ticketRepo } = createService();
    ticketRepo.count.mockResolvedValueOnce(0);

    await expect(
      service.create(
        {
          eventId: event.id,
          comment: 'Sự kiện rất tốt',
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects feedback before event is completed', async () => {
    const { service, eventRepo } = createService();
    eventRepo.findOne.mockResolvedValueOnce({
      ...event,
      status: EventStatus.UPCOMING,
      endDateTime: new Date('2999-01-01T00:00:00.000Z'),
    });

    await expect(
      service.create(
        {
          eventId: event.id,
          comment: 'Sự kiện rất tốt',
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate feedback for the same user and event', async () => {
    const { service, feedbackRepo, ticketRepo } = createService();
    ticketRepo.count.mockResolvedValueOnce(1);
    feedbackRepo.findOne.mockResolvedValueOnce({ id: 'feedback-1' });

    await expect(
      service.create(
        {
          eventId: event.id,
          comment: 'Sự kiện rất tốt',
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects cross organization feedback access', async () => {
    const { service, membershipRepo } = createService();
    membershipRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.findByEvent(event.id, currentUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns event feedback for active organization member', async () => {
    const { service, feedbackRepo } = createService();
    feedbackRepo.find.mockResolvedValueOnce([
      {
        id: 'feedback-1',
        rating: 4,
        comment: 'Good',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        user,
        event,
      },
    ]);

    const result = await service.findByEvent(event.id, currentUser);

    expect(result.statusCode).toBe(200);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]).toMatchObject({
      id: 'feedback-1',
      user: { id: user.id },
      event: { id: event.id },
    });
  });

  it('rejects missing event', async () => {
    const { service, eventRepo } = createService();
    eventRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          eventId: event.id,
          comment: 'Sự kiện rất tốt',
        },
        currentUser,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  function createService() {
    const feedbackRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    const eventRepo = {
      findOne: jest.fn().mockResolvedValue(event),
    };
    const ticketRepo = {
      count: jest.fn().mockResolvedValue(1),
    };
    const membershipRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'membership-1' }),
    };
    const service = new FeedbackService(
      feedbackRepo as any,
      eventRepo as any,
      ticketRepo as any,
      membershipRepo as any,
    );

    return {
      service,
      feedbackRepo,
      eventRepo,
      ticketRepo,
      membershipRepo,
    };
  }
});
