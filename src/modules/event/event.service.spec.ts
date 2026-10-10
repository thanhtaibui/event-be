import { ForbiddenException } from '@nestjs/common';
import { EventService } from './event.service';
import { EventStatus } from 'src/shared/enum/enum';

describe('EventService create', () => {
  const organization = { id: 'org-1', name: 'Green Future Community' };
  const category = {
    id: 'category-1',
    name: 'Lễ hội',
    description: 'FESTIVAL',
    deletedAt: null,
  };
  const validPayload = {
    title: 'Green Life Festival 2026',
    startDateTime: '2026-12-20T08:00:00.000Z' as any,
    endDateTime: '2026-12-20T17:00:00.000Z' as any,
    registrationEndDate: '2026-12-15T23:59:59.000Z' as any,
    capacity: 100,
    organizationId: organization.id,
    categoryIds: [category.id],
    description: 'Community green event',
    place: 'Ho Chi Minh City',
  };
  const ownerUser = {
    userId: 'user-1',
    role: { isSuperAdmin: false },
  };

  it('creates an event with categoryIds and returns success response', async () => {
    const { service, eventRepo, categoryRepo } = createService();

    const result = await service.create(validPayload, ownerUser);

    expect(result.statusCode).toBe(201);
    expect(result.message).toBe('Create Event Successfully');
    expect(result.data?.title).toBe(validPayload.title);
    expect(eventRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: validPayload.title,
        status: EventStatus.DRAFT,
        organization,
        categories: [category],
      }),
    );
    expect(categoryRepo.find).toHaveBeenCalledWith({
      where: {
        id: expect.any(Object),
        deletedAt: expect.any(Object),
      },
    });
  });

  it('rejects unknown category IDs with a clean error', async () => {
    const { service, categoryRepo } = createService();
    categoryRepo.find.mockResolvedValueOnce([]);

    await expect(service.create(validPayload, ownerUser)).rejects.toMatchObject({
      response: { message: 'CATEGORY_NOT_FOUND' },
    });
  });

  it('rejects duplicate category IDs', async () => {
    const { service } = createService();

    await expect(
      service.create(
        {
          ...validPayload,
          categoryIds: [category.id, category.id],
        },
        ownerUser,
      ),
    ).rejects.toMatchObject({
      response: { message: 'DUPLICATE_CATEGORY_IDS' },
    });
  });

  it('rejects invalid event dates', async () => {
    const { service } = createService();

    await expect(
      service.create(
        {
          ...validPayload,
          endDateTime: '2026-12-20T07:00:00.000Z' as any,
        },
        ownerUser,
      ),
    ).rejects.toMatchObject({
      response: { message: 'INVALID_EVENT_DATES' },
    });
  });

  it('rejects missing organizations with a clean error', async () => {
    const { service, organizationRepo } = createService();
    organizationRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.create(validPayload, ownerUser)).rejects.toMatchObject({
      response: { message: 'ORGANIZATION_NOT_FOUND' },
    });
  });

  it('rejects users who are not members of the organization', async () => {
    const { service, membershipRepo } = createService();
    membershipRepo.findOne.mockResolvedValueOnce(null);

    await service.create(validPayload, ownerUser).catch((error: unknown) => {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error).toMatchObject({
        response: { message: 'EVENT_CREATE_FORBIDDEN' },
      });
    });
  });

  function createService() {
    const eventRepo = {
      create: jest.fn((value) => value),
      save: jest.fn((value) =>
        Promise.resolve({
          id: 'event-1',
          ...value,
        }),
      ),
    };
    const organizationRepo = {
      findOne: jest.fn().mockResolvedValue(organization),
    };
    const membershipRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'membership-1' }),
    };
    const categoryRepo = {
      find: jest.fn().mockResolvedValue([category]),
    };

    const service = new EventService(
      eventRepo as any,
      organizationRepo as any,
      membershipRepo as any,
      categoryRepo as any,
      {} as any,
    );

    return {
      service,
      eventRepo,
      organizationRepo,
      membershipRepo,
      categoryRepo,
    };
  }
});
