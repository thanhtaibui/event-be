import { ForbiddenException } from '@nestjs/common';
import { paginate } from 'nestjs-paginate';
import { EventService } from './event.service';
import { EventStatus, OrganizationStatus } from 'src/shared/enum/enum';

jest.mock('nestjs-paginate', () => ({
  paginate: jest.fn(),
  FilterOperator: {
    EQ: '$eq',
    GTE: '$gte',
    LTE: '$lte',
  },
}));

describe('EventService create', () => {
  const organizationOwner = { id: 'owner-1', fullName: 'Owner User' };
  const organization = {
    id: 'org-1',
    name: 'Green Future Community',
    owner: organizationOwner,
  };
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
  const draftEvent = {
    id: 'event-1',
    title: 'Green Life Festival 2026',
    eventPoster: null,
    eventBanner: null,
    startDateTime: new Date('2026-12-20T08:00:00.000Z'),
    endDateTime: new Date('2026-12-20T17:00:00.000Z'),
    registrationEndDate: new Date('2026-12-15T23:59:59.000Z'),
    capacity: 100,
    status: EventStatus.DRAFT,
    organization,
    categories: [category],
    description: 'Community green event',
    place: 'Ho Chi Minh City',
  };

  beforeEach(() => {
    jest.mocked(paginate).mockReset();
  });

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

  it('GET ALL returns draft events for super admin management view', async () => {
    const { service, queryBuilders } = createService();
    mockPaginateResult([draftEvent]);

    const result = await service.findAll(
      { path: '/events', page: 1, limit: 10 } as any,
      {
        userId: 'super-admin',
        role: { isSuperAdmin: true },
      },
    );

    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0].title).toBe('Green Life Festival 2026');
    expect(queryBuilders[0].leftJoinAndSelect).toHaveBeenCalledWith(
      'event.organization',
      'event_organization_rel',
    );
    expect(queryBuilders[0].leftJoinAndSelect).toHaveBeenCalledWith(
      'event.categories',
      'event_categories_rel',
    );
    expect(queryBuilders[0].where).not.toHaveBeenCalled();
    expect(queryBuilders[0].andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('event.status IN'),
      expect.any(Object),
    );
    expect(queryBuilders[0].andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('registrationEndDate'),
      expect.any(Object),
    );
  });

  it('GET ALL scopes owner to active membership organizations', async () => {
    const { service, membershipRepo, queryBuilders } = createService();
    membershipRepo.find.mockResolvedValueOnce([
      {
        id: 'membership-1',
        organization,
      },
    ]);
    mockPaginateResult([draftEvent]);

    const result = await service.findAll(
      { path: '/events', page: 1, limit: 10 } as any,
      ownerUser,
    );

    expect(result.data?.items).toHaveLength(1);
    expect(membershipRepo.find).toHaveBeenCalledWith({
      where: {
        user: { id: ownerUser.userId },
        isActive: true,
      },
      relations: ['organization'],
    });
    expect(queryBuilders[0].andWhere).toHaveBeenCalledWith(
      'event_organization_rel.id IN (:...organizationIds)',
      { organizationIds: [organization.id] },
    );
  });

  it('GET ALL returns empty list for owner without organization scope', async () => {
    const { service, membershipRepo } = createService();
    membershipRepo.find.mockResolvedValueOnce([]);

    const result = await service.findAll(
      { path: '/events', page: 1, limit: 10 } as any,
      ownerUser,
    );

    expect(result.data).toEqual({
      items: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
    expect(paginate).not.toHaveBeenCalled();
  });

  it('GET PUBLIC returns only public discovery events without user scope', async () => {
    const { service, eventRepo, membershipRepo, queryBuilders } = createService();
    const publicEvent = {
      ...draftEvent,
      status: EventStatus.PUBLISHED,
      eventBanner: 'https://cdn.example.com/banner.jpg',
    };
    mockPaginateResult([publicEvent]);

    const result = await service.findPublicEvents({
      path: '/events/public',
      page: 1,
      limit: 10,
      search: 'Green Life',
    } as any);

    expect(result.statusCode).toBe(200);
    expect(result.message).toBe('Get public events successfully');
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0].title).toBe(publicEvent.title);
    expect(result.data?.items[0].eventPoster).toBe(publicEvent.eventBanner);
    expect(result.data?.meta).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(membershipRepo.find).not.toHaveBeenCalled();
    expect(queryBuilders[0].where).toHaveBeenCalledWith(
      'event.status IN (:...statuses)',
      {
        statuses: [
          EventStatus.PUBLISHED,
          EventStatus.UPCOMING,
          EventStatus.ONGOING,
        ],
      },
    );
    expect(queryBuilders[0].andWhere).toHaveBeenCalledWith(
      'organization.status = :organizationStatus',
      { organizationStatus: OrganizationStatus.ACTIVE },
    );
    expect(eventRepo.find).toHaveBeenCalled();
  });

  it('publishes a draft event successfully', async () => {
    const { service, eventRepo } = createService();
    eventRepo.findOne.mockResolvedValueOnce({ ...draftEvent });

    const result = await service.publish(draftEvent.id, ownerUser);

    expect(result.statusCode).toBe(200);
    expect(result.message).toBe('Publish Event Successfully');
    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: EventStatus.PUBLISHED }),
    );
  });

  it('rejects publishing a cancelled event', async () => {
    const { service, eventRepo } = createService();
    eventRepo.findOne.mockResolvedValueOnce({
      ...draftEvent,
      status: EventStatus.CANCELLED,
    });

    await expect(service.publish(draftEvent.id, ownerUser)).rejects.toMatchObject({
      response: { message: 'ONLY_DRAFT_EVENT_CAN_BE_PUBLISHED' },
    });
    expect(eventRepo.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: EventStatus.PUBLISHED }),
    );
  });

  it('scheduler changes published events to upcoming and notifies owner', async () => {
    const { service, eventRepo, notificationService } = createService();
    const event = {
      ...draftEvent,
      status: EventStatus.PUBLISHED,
      startDateTime: new Date(Date.now() - 60 * 1000),
      endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };
    eventRepo.find.mockResolvedValueOnce([event]);

    await service.syncEventStatuses();

    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: EventStatus.UPCOMING }),
    );
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: organizationOwner.id,
        title: 'Event status updated',
        message: `${event.title} is now ${EventStatus.UPCOMING}`,
      }),
    );
  });

  it('scheduler keeps future published events as published', async () => {
    const { service, eventRepo, notificationService } = createService();
    const event = {
      ...draftEvent,
      status: EventStatus.PUBLISHED,
      startDateTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      endDateTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    };
    eventRepo.find.mockResolvedValueOnce([event]);

    await service.syncEventStatuses();

    expect(eventRepo.save).not.toHaveBeenCalled();
    expect(notificationService.create).not.toHaveBeenCalled();
    expect(event.status).toBe(EventStatus.PUBLISHED);
  });

  it('scheduler changes upcoming events to ongoing and notifies owner', async () => {
    const { service, eventRepo, notificationService } = createService();
    const event = {
      ...draftEvent,
      status: EventStatus.UPCOMING,
      startDateTime: new Date(Date.now() - 60 * 1000),
      endDateTime: new Date(Date.now() + 60 * 60 * 1000),
    };
    eventRepo.find.mockResolvedValueOnce([event]);

    await service.syncEventStatuses();

    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: EventStatus.ONGOING }),
    );
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: organizationOwner.id,
        message: `${event.title} is now ${EventStatus.ONGOING}`,
      }),
    );
  });

  it('scheduler changes ongoing events to ended and notifies owner', async () => {
    const { service, eventRepo, notificationService } = createService();
    const event = {
      ...draftEvent,
      status: EventStatus.ONGOING,
      startDateTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endDateTime: new Date(Date.now() - 60 * 1000),
    };
    eventRepo.find.mockResolvedValueOnce([event]);

    await service.syncEventStatuses();

    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: EventStatus.ENDED }),
    );
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: organizationOwner.id,
        message: `${event.title} is now ${EventStatus.ENDED}`,
      }),
    );
  });

  function createService() {
    const queryBuilders: any[] = [];
    const createQueryBuilder = () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      queryBuilders.push(qb);
      return qb;
    };
    const eventRepo = {
      create: jest.fn((value) => value),
      save: jest.fn((value) =>
        Promise.resolve({
          id: 'event-1',
          ...value,
        }),
      ),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(draftEvent),
      createQueryBuilder: jest.fn(createQueryBuilder),
    };
    const organizationRepo = {
      findOne: jest.fn().mockResolvedValue(organization),
    };
    const membershipRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      find: jest.fn().mockResolvedValue([
        {
          id: 'membership-1',
          organization,
        },
      ]),
    };
    const categoryRepo = {
      find: jest.fn().mockResolvedValue([category]),
    };
    const notificationService = {
      create: jest.fn().mockResolvedValue({ statusCode: 201 }),
    };

    const service = new EventService(
      eventRepo as any,
      organizationRepo as any,
      membershipRepo as any,
      categoryRepo as any,
      {} as any,
      notificationService as any,
    );

    return {
      service,
      eventRepo,
      organizationRepo,
      membershipRepo,
      categoryRepo,
      notificationService,
      queryBuilders,
    };
  }

  function mockPaginateResult(data: any[]) {
    jest.mocked(paginate).mockResolvedValueOnce({
      data,
      meta: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: data.length,
        totalPages: data.length > 0 ? 1 : 0,
      },
      links: {} as any,
    } as any);
  }
});
