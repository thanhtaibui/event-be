import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { PermissionCode } from 'src/common/constants/permission-codes';
import { OrganizationInvitationStatus } from 'src/shared/enum/enum';
import { Membership } from '../membership/entities/membership.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationInvitationService } from './organization-invitation.service';
import { OrganizationInvitation } from './entities/organization-invitation.entity';

jest.mock('@react-email/render', () => ({
  render: jest.fn().mockResolvedValue('<html />'),
}));
jest.mock(
  'src/emails/OrganizationInviteEmail',
  () => ({ __esModule: true, default: jest.fn(() => null) }),
  { virtual: true },
);

describe('OrganizationInvitationService security', () => {
  const org = { id: 'org-1', name: 'Org', slug: 'org' };
  const inviter = {
    id: 'owner-1',
    fullName: 'Owner',
    email: 'owner@example.com',
  };
  const invitee = {
    id: 'user-1',
    fullName: 'Invitee',
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
  const role = {
    id: 'role-1',
    role_code: 'MEMBER',
    role_name: 'Member',
    organization: org,
    permissions: [],
  };

  it('stores only a token hash and emails the raw token', async () => {
    const ctx = createService();
    const result = await ctx.service.create(
      org.id,
      { email: invitee.email, role: 'member' },
      managerUser,
    );
    expect(result.data.token).toBeUndefined();
    expect(ctx.invitationRepo.create.mock.calls[0][0].token).toMatch(
      /^sha256:/,
    );
    expect(ctx.mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  it('rejects role escalation using the shared membership rule', async () => {
    const ctx = createService();
    ctx.membershipService.validateRoleAssignment.mockRejectedValue(
      new ForbiddenException(),
    );
    await expect(
      ctx.service.create(
        org.id,
        { email: invitee.email, role: 'ADMIN' },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unauthorized sender and duplicate pending invitation', async () => {
    const denied = createService({ managerPermissions: [] });
    await expect(
      denied.service.create(
        org.id,
        { email: invitee.email, role: 'MEMBER' },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const duplicate = createService({ pendingInvitation: makeInvitation() });
    await expect(
      duplicate.service.create(
        org.id,
        { email: invitee.email, role: 'MEMBER' },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires matching recipient email and invitation token to accept', async () => {
    const invitation = makeInvitation();
    const ctx = createService({ actionInvitation: invitation });
    await expect(
      ctx.service.accept(invitation.id, inviteeUser),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      ctx.service.accept(invitation.id, inviteeUser, 'bad-token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      ctx.service.accept(
        invitation.id,
        { ...inviteeUser, email: 'other@example.com' },
        'secret-token',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const result = await ctx.service.accept(
      invitation.id,
      inviteeUser,
      'secret-token',
    );
    expect(result.statusCode).toBe(200);
    expect(ctx.manager.create).toHaveBeenCalledWith(
      Membership,
      expect.objectContaining({ user: invitee, isActive: true }),
    );
  });

  it('accepts hashed tokens used by newly created invitations', async () => {
    const invitation = makeInvitation({
      token: `sha256:${createHash('sha256').update('raw-token-value-0123456789abcdef').digest('hex')}`,
    });
    const ctx = createService({ actionInvitation: invitation });
    await expect(
      ctx.service.accept(
        invitation.id,
        inviteeUser,
        'raw-token-value-0123456789abcdef',
      ),
    ).resolves.toMatchObject({ statusCode: 200 });
  });

  it('rejects reuse and expires expired pending invitations', async () => {
    const handled = makeInvitation({
      status: OrganizationInvitationStatus.REJECTED,
    });
    await expect(
      createService({ actionInvitation: handled }).service.accept(
        handled.id,
        inviteeUser,
        'secret-token',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const expired = makeInvitation({ expiresAt: new Date(Date.now() - 1000) });
    const ctx = createService({ actionInvitation: expired });
    await expect(
      ctx.service.accept(expired.id, inviteeUser, 'secret-token'),
    ).rejects.toThrow('Invitation expired');
    expect(ctx.manager.save).toHaveBeenCalledWith(
      OrganizationInvitation,
      expect.objectContaining({ status: OrganizationInvitationStatus.EXPIRED }),
    );
  });

  it('lists only the authenticated email inbox with pagination and no token', async () => {
    const ctx = createService();
    ctx.invitationRepo.findAndCount.mockResolvedValue([[makeInvitation()], 1]);
    const result = await ctx.service.findForCurrentUser(inviteeUser, {
      page: 2,
      limit: 5,
    });
    expect(ctx.invitationRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: invitee.email,
          status: OrganizationInvitationStatus.PENDING,
        },
        skip: 5,
        take: 5,
      }),
    );
    expect(result.data.items[0].token).toBeUndefined();
  });

  it('revokes only pending invitations and resend rotates the token', async () => {
    const pending = makeInvitation();
    const revoke = createService({ actionInvitation: pending });
    expect(
      (await revoke.service.revoke(org.id, pending.id, managerUser)).data
        .status,
    ).toBe(OrganizationInvitationStatus.REVOKED);
    const retry = makeInvitation();
    const resend = createService({ actionInvitation: retry });
    await resend.service.resend(org.id, retry.id, managerUser);
    expect(retry.token).toMatch(/^sha256:/);
    expect(resend.mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  it('removes a new invitation if email delivery fails', async () => {
    const ctx = createService();
    ctx.mailer.sendMail.mockRejectedValue(new Error('SMTP error'));
    await expect(
      ctx.service.create(
        org.id,
        { email: invitee.email, role: 'MEMBER' },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(ctx.invitationRepo.remove).toHaveBeenCalled();
  });

  function makeInvitation(overrides: Partial<OrganizationInvitation> = {}) {
    return {
      id: 'invite-1',
      email: invitee.email,
      role: 'MEMBER',
      status: OrganizationInvitationStatus.PENDING,
      token: 'secret-token',
      organization: org,
      invitedBy: inviter,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as OrganizationInvitation;
  }

  function createService(
    options: {
      managerPermissions?: any[];
      pendingInvitation?: any;
      actionInvitation?: any;
    } = {},
  ) {
    const invitationRepo: any = {
      create: jest.fn((value) => ({
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value,
      })),
      save: jest.fn(async (value) => value),
      remove: jest.fn(async (value) => value),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn(() => makeQueryBuilder()),
      findOne: jest.fn(async (args) =>
        args.where?.organization?.id && args.where?.id
          ? (options.actionInvitation ?? null)
          : null,
      ),
    } as jest.Mocked<Repository<OrganizationInvitation>> & any;
    const membershipRepo = {
      findOne: jest.fn(async (args) =>
        args.where?.user?.id === inviter.id
          ? {
              role: {
                permissions: options.managerPermissions ?? [
                  {
                    permission_code: PermissionCode.ORGANIZATION_MEMBER_MANAGE,
                  },
                ],
              },
            }
          : null,
      ),
    };
    const roleBuilder: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(role),
    };
    const roleRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(roleBuilder),
    };
    const userRepo = {
      findOne: jest.fn(async (args) =>
        args.where?.id === inviter.id
          ? inviter
          : args.where?.email === invitee.email
            ? invitee
            : args.where?.id === invitee.id
              ? invitee
              : null,
      ),
    };
    const manager: any = {
      findOne: jest.fn(async (entity, args) =>
        entity === Organization
          ? org
          : entity === OrganizationInvitation
            ? args.where?.status
              ? (options.pendingInvitation ?? null)
              : (options.actionInvitation ?? null)
            : null,
      ),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn(() => makeQueryBuilder()),
      }),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => value),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    } as unknown as DataSource;
    const mailer: any = { sendMail: jest.fn().mockResolvedValue(undefined) };
    const membershipService: any = {
      validateRoleAssignment: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OrganizationInvitationService(
      invitationRepo,
      { findOne: jest.fn().mockResolvedValue(org) } as any,
      membershipRepo as any,
      roleRepo as any,
      userRepo as any,
      dataSource,
      mailer,
      membershipService,
    );
    return { service, invitationRepo, manager, mailer, membershipService };
  }

  function makeQueryBuilder(): any {
    return {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
  }
});
