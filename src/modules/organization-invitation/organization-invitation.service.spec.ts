import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PermissionCode } from 'src/common/constants/permission-codes';
import { OrganizationInvitationStatus } from 'src/shared/enum/enum';
import { Membership } from '../membership/entities/membership.entity';
import { OrganizationInvitationService } from './organization-invitation.service';
import { OrganizationInvitation } from './entities/organization-invitation.entity';

jest.mock('@react-email/render', () => ({
  render: jest.fn().mockResolvedValue('<html>invite</html>'),
}));
jest.mock('src/emails/OrganizationInviteEmail', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}), { virtual: true });

describe('OrganizationInvitationService', () => {
  const org = { id: 'org-1', name: 'Green Future', slug: 'green-future' };
  const inviter = {
    id: 'owner-1',
    fullName: 'Owner User',
    email: 'owner@example.com',
  };
  const invitee = {
    id: 'user-1',
    fullName: 'Invitee User',
    email: 'user@example.com',
  };
  const managerUser = {
    userId: inviter.id,
    email: inviter.email,
    role: { isSuperAdmin: false },
  };
  const inviteeUser = {
    userId: invitee.id,
    email: invitee.email,
    role: { isSuperAdmin: false },
  };
  const memberManagePermission = {
    permission_code: PermissionCode.ORGANIZATION_MEMBER_MANAGE,
  };
  const managerMembership = {
    id: 'membership-manager',
    role: {
      permissions: [memberManagePermission],
    },
  };
  const memberRole = {
    id: 'role-member',
    role_code: 'MEMBER',
    role_name: 'Member',
    organization: org,
    permissions: [],
  };

  it('creates pending invitation and sends email', async () => {
    const { service, invitationRepo, mailerService } = createService();

    const result = await service.create(
      org.id,
      { email: ' USER@example.com ', role: 'member' },
      managerUser,
    );

    expect(result.statusCode).toBe(201);
    expect(result.data).toMatchObject({
      email: invitee.email,
      role: 'MEMBER',
      status: OrganizationInvitationStatus.PENDING,
    });
    expect(invitationRepo.save).toHaveBeenCalled();
    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: invitee.email,
        subject: `You're invited to join ${org.name}`,
      }),
    );
  });

  it('blocks duplicate pending invitation', async () => {
    const { service } = createService({
      pendingInvitation: createInvitation(),
    });

    await expect(
      service.create(org.id, { email: invitee.email, role: 'MEMBER' }, managerUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts invitation and creates organization membership', async () => {
    const invitation = createInvitation();
    const { service, manager, dataSource } = createService({
      actionInvitation: invitation,
      user: invitee,
    });

    const result = await service.accept(invitation.id, inviteeUser);

    expect(result.statusCode).toBe(200);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(manager.create).toHaveBeenCalledWith(Membership, {
      user: invitee,
      organization: org,
      role: memberRole,
      isActive: true,
    });
    expect(invitation.status).toBe(OrganizationInvitationStatus.ACCEPTED);
  });

  it('rejects invitation without creating membership', async () => {
    const invitation = createInvitation();
    const { service, membershipRepo, invitationRepo } = createService({
      actionInvitation: invitation,
    });

    const result = await service.reject(invitation.id, inviteeUser);

    expect(result.statusCode).toBe(200);
    expect(membershipRepo.create).not.toHaveBeenCalled();
    expect(invitationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrganizationInvitationStatus.REJECTED }),
    );
  });

  it('blocks sender without organization member manage permission', async () => {
    const { service } = createService({
      managerMembership: { id: 'regular', role: { permissions: [] } },
    });

    await expect(
      service.create(org.id, { email: invitee.email, role: 'MEMBER' }, managerUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  function createInvitation(overrides: Partial<OrganizationInvitation> = {}) {
    return {
      id: 'invitation-1',
      email: invitee.email,
      role: 'MEMBER',
      status: OrganizationInvitationStatus.PENDING,
      token: 'token-1',
      organization: org,
      invitedBy: inviter,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as OrganizationInvitation;
  }

  function createService(options: {
    managerMembership?: any;
    existingMembership?: any;
    pendingInvitation?: any;
    actionInvitation?: any;
    user?: any;
  } = {}) {
    const invitationRepo = {
      create: jest.fn((value) => ({
        id: 'invitation-created',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value,
      })),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(async (args) => {
        if (args.where?.id) {
          return options.actionInvitation ?? null;
        }
        if (args.where?.status === OrganizationInvitationStatus.PENDING) {
          return options.pendingInvitation ?? null;
        }
        return null;
      }),
      find: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<Repository<OrganizationInvitation>>;

    const organizationRepo = {
      findOne: jest.fn().mockResolvedValue(org),
    };
    const membershipRepo = {
      findOne: jest.fn(async (args) => {
        if (args.where?.user?.id === managerUser.userId) {
          return options.managerMembership ?? managerMembership;
        }
        return options.existingMembership ?? null;
      }),
      create: jest.fn((value) => value),
    };
    const roleQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(memberRole),
    };
    const roleRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(roleQueryBuilder),
    };
    const userRepo = {
      findOne: jest.fn(async (args) => {
        if (args.where?.id === managerUser.userId) {
          return inviter;
        }
        if (args.where?.id === inviteeUser.userId) {
          return options.user ?? invitee;
        }
        if (args.where?.email === invitee.email) {
          return invitee;
        }
        return null;
      }),
    };
    const manager = {
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => value),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    } as unknown as DataSource;
    const mailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const service = new OrganizationInvitationService(
      invitationRepo,
      organizationRepo as any,
      membershipRepo as any,
      roleRepo as any,
      userRepo as any,
      dataSource,
      mailerService as any,
    );

    return {
      service,
      invitationRepo,
      membershipRepo,
      dataSource,
      manager,
      mailerService,
    };
  }
});
