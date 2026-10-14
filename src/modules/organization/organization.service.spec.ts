import { ForbiddenException } from '@nestjs/common';
import { PermissionCode } from 'src/common/constants/permission-codes';
import { OrganizationStatus } from 'src/shared/enum/enum';
import { OrganizationService } from './organization.service';

describe('OrganizationService membership data', () => {
  const orgId = 'org-1';
  const ownerId = 'owner-1';
  const currentUser = { userId: 'manager-1', role: { isSuperAdmin: false } };
  const superAdminUser = { userId: 'super-admin', role: { isSuperAdmin: true } };
  const managerMembership = {
    id: 'membership-manager',
    role: {
      permissions: [
        { permission_code: PermissionCode.ORGANIZATION_MEMBER_MANAGE },
      ],
    },
  };

  it('returns paginated organization members for scoped member manager', async () => {
    const { service, memberRepo } = createService({
      managerMembership,
      memberRows: [
        {
          membershipId: 'membership-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          isActive: true,
          userId: 'user-1',
          fullName: 'Member One',
          email: 'member@example.com',
          phoneNumber: '0900000000',
          roleId: 'role-1',
          roleName: 'Owner',
          roleCode: 'OWNER',
          roleColor: 'red',
        },
      ],
      memberTotal: 1,
    });

    const result = await service.GetMembersByOrgId(
      orgId,
      { page: 1, limit: 10 },
      currentUser,
    );

    expect(result.statusCode).toBe(200);
    expect(result.message).toBe('Get organization members successfully');
    expect(result.data.meta).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(result.data.items).toEqual([
      {
        membershipId: 'membership-1',
        userId: 'user-1',
        fullName: 'Member One',
        email: 'member@example.com',
        phoneNumber: '0900000000',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        role: {
          id: 'role-1',
          name: 'Owner',
          code: 'OWNER',
          color: 'red',
        },
      },
    ]);
    expect(memberRepo.findOne).toHaveBeenCalledWith({
      where: {
        user: { id: currentUser.userId },
        organization: { id: orgId },
        isActive: true,
      },
      relations: ['role', 'role.permissions'],
    });
  });

  it('blocks organization member without manage permission', async () => {
    const { service, memberRepo } = createService({
      managerMembership: {
        id: 'membership-regular',
        role: {
          permissions: [{ permission_code: PermissionCode.EVENT_VIEW }],
        },
      },
    });

    await expect(
      service.GetMembersByOrgId(orgId, { page: 1, limit: 10 }, currentUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns organization member summary with organization scope validation', async () => {
    const { service, memberRepo } = createService({
      managerMembership,
      memberCounts: [10, 8, 2],
    });

    const result = await service.getMemberSummary(orgId, currentUser);

    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual({
      totalMembers: 10,
      activeMembers: 8,
      inactiveMembers: 2,
    });
    expect(memberRepo.count).toHaveBeenCalledTimes(3);
  });

  it('returns organization overview using shared scoped checks', async () => {
    const { service, eventRepo } = createService({
      managerMembership,
      memberCounts: [10, 8],
      eventCounts: [5, 3],
    });

    const result = await service.getOverview(orgId, currentUser);

    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual({
      members: {
        total: 10,
        active: 8,
      },
      events: {
        total: 5,
        active: 3,
      },
    });
    expect(eventRepo.count).toHaveBeenCalledTimes(2);
    expect(eventRepo.count.mock.calls[1][0].where.organization).toEqual({
      id: orgId,
    });
    expect(eventRepo.count.mock.calls[1][0].where.status).toBeDefined();
  });

  it('creates organization as pending and unverified', async () => {
    const { service, organizationRepo, memberRepo } = createService({
      user: { id: ownerId },
      ownerRole: { id: 'owner-role', role_code: 'OWNER' },
    });

    const result = await service.create({
      name: 'Green Future Community',
      slug: 'green-future-community',
      ownerId,
      bio: 'Green community',
      legalName: 'Green Future Community',
      industry: 'Environment',
      email: 'green@example.com',
      phone: '0900000000',
      website: 'https://green.example.com',
      address: 'Ho Chi Minh City',
    });

    expect(result.statusCode).toBe(201);
    expect(organizationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OrganizationStatus.PENDING,
        isVerified: false,
      }),
    );
    expect(memberRepo.save).toHaveBeenCalled();
  });

  it('approves organization lifecycle without verifying identity', async () => {
    const organization = {
      id: orgId,
      status: OrganizationStatus.PENDING,
      isVerified: false,
    };
    const { service, organizationRepo } = createService({
      organization,
    });

    const result = await service.approve(orgId, superAdminUser);

    expect(result.statusCode).toBe(200);
    expect(organizationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OrganizationStatus.ACTIVE,
        isVerified: false,
      }),
    );
  });

  it('returns organization detail by slug with lifecycle status and stats', async () => {
    const organization = {
      id: orgId,
      name: 'Green Future Community',
      bio: 'Green community',
      owner: {
        id: ownerId,
        fullName: 'Owner User',
        email: 'owner@example.com',
      },
      slug: 'green-future-community',
      status: OrganizationStatus.ACTIVE,
      isVerified: true,
      legalName: 'Green Future Community',
      industry: 'Environment',
      email: 'green@example.com',
      phone: '0900000000',
      website: 'https://green.example.com',
      address: 'Ho Chi Minh City',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      bannerUrl: 'https://cdn.example.com/banner.jpg',
      logoUrl: 'https://cdn.example.com/logo.jpg',
    };
    const { service, memberRepo, eventRepo } = createService({
      existingSlugOrganization: organization,
      memberCounts: [10],
      eventCounts: [5],
    });

    const result = await service.GetOrgBySlug(' green-future-community ');

    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual(
      expect.objectContaining({
        id: orgId,
        name: organization.name,
        slug: organization.slug,
        status: OrganizationStatus.ACTIVE,
        isVerified: true,
        stats: {
          totalMembers: 10,
          totalEvents: 5,
        },
      }),
    );
    expect(memberRepo.count).toHaveBeenCalledWith({
      where: {
        organization: { id: orgId },
        isActive: true,
      },
    });
    expect(eventRepo.count).toHaveBeenCalledWith({
      where: {
        organization: { id: orgId },
      },
    });
  });

  it('returns public organization discovery data only', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const { service, organizationRepo } = createService({
      publicOrganizations: [
        {
          id: orgId,
          name: 'Green Future Community',
          logoUrl: 'https://cdn.example.com/logo.jpg',
          bio: 'Green community',
          createdAt,
          email: 'private@example.com',
          owner: { id: ownerId },
        },
      ],
    });

    const result = await service.findPublicOrganizations();

    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual([
      {
        id: orgId,
        name: 'Green Future Community',
        logo: 'https://cdn.example.com/logo.jpg',
        description: 'Green community',
        createdAt,
      },
    ]);
    expect(organizationRepo.find).toHaveBeenCalledWith({
      where: {
        status: OrganizationStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        bio: true,
        createdAt: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  });

  function createService(options: {
    managerMembership?: any;
    memberRows?: any[];
    memberTotal?: number;
    memberCounts?: number[];
    eventCounts?: number[];
    organization?: any;
    existingSlugOrganization?: any;
    publicOrganizations?: any[];
    user?: any;
    ownerRole?: any;
  }) {
    const listQueryBuilder = createMemberListQueryBuilder(
      options.memberRows ?? [],
    );
    const countQueryBuilder = createMemberCountQueryBuilder(
      options.memberTotal ?? 0,
    );
    const memberRepo = {
      findOne: jest.fn().mockResolvedValue(options.managerMembership),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      count: jest
        .fn()
        .mockImplementation(async () => (options.memberCounts ?? []).shift()),
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(listQueryBuilder)
        .mockReturnValueOnce(countQueryBuilder),
    };
    const organizationRepo = {
      create: jest.fn((value) => value),
      save: jest.fn((value) =>
        Promise.resolve({
          id: orgId,
          owner: { id: ownerId },
          ...value,
        }),
      ),
      findOne: jest.fn().mockImplementation(async (args?: any) => {
        if (args?.where?.slug) {
          return options.existingSlugOrganization ?? null;
        }

        return options.organization ?? { id: orgId };
      }),
      find: jest.fn().mockResolvedValue(options.publicOrganizations ?? []),
    };
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(options.user ?? null),
    };
    const roleRepo = {
      findOne: jest.fn().mockResolvedValue(options.ownerRole ?? null),
    };
    const eventRepo = {
      count: jest
        .fn()
        .mockImplementation(async () => (options.eventCounts ?? []).shift()),
    };
    const service = new OrganizationService(
      organizationRepo as any,
      {} as any,
      memberRepo as any,
      userRepo as any,
      roleRepo as any,
      eventRepo as any,
    );

    return {
      service,
      memberRepo,
      organizationRepo,
      userRepo,
      roleRepo,
      eventRepo,
    };
  }

  function createMemberListQueryBuilder(rows: any[]) {
    return {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
  }

  function createMemberCountQueryBuilder(total: number) {
    return {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(total),
    };
  }
});
