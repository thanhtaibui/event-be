import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionCode } from 'src/common/constants/permission-codes';
import { MembershipService } from './membership.service';

describe('MembershipService RBAC', () => {
  const orgA = { id: 'org-a', name: 'Organization A' };
  const orgB = { id: 'org-b', name: 'Organization B' };
  const targetUser = {
    id: 'target-user',
    fullName: 'Target User',
    email: 'target@example.com',
  };
  const ownerUser = { userId: 'owner-user', role: { isSuperAdmin: false } };
  const managerUser = { userId: 'manager-user', role: { isSuperAdmin: false } };
  const regularUser = { userId: 'regular-user', role: { isSuperAdmin: false } };

  const permissions = {
    memberManage: { permission_code: PermissionCode.ORGANIZATION_MEMBER_MANAGE },
    eventView: { permission_code: PermissionCode.EVENT_VIEW },
    roleCreate: { permission_code: PermissionCode.ROLE_CREATE },
  };
  const ownerRole = {
    id: 'owner-role',
    role_name: 'Owner',
    role_code: 'OWNER',
    organization: null,
    permissions: [
      permissions.memberManage,
      permissions.eventView,
      permissions.roleCreate,
    ],
  };
  const customManagerRole = {
    id: 'custom-manager-role',
    role_name: 'Member Manager',
    role_code: 'MEMBER_MANAGER',
    organization: orgA,
    permissions: [permissions.memberManage, permissions.eventView],
  };
  const regularRole = {
    id: 'regular-role',
    role_name: 'Member',
    role_code: 'MEMBER',
    organization: orgA,
    permissions: [permissions.eventView],
  };

  it('allows owner to create member in own organization', async () => {
    const { service, membershipRepo } = createService({
      organization: orgA,
      managerMembership: {
        id: 'owner-membership',
        role: ownerRole,
        organization: orgA,
        isActive: true,
      },
      targetRole: regularRole,
    });

    const result = await service.create(
      {
        userId: targetUser.id,
        orgId: orgA.id,
        roleId: regularRole.id,
      },
      ownerUser,
    );

    expect(result.statusCode).toBe(201);
    expect(result.data).toMatchObject({
      userId: targetUser.id,
      userName: targetUser.fullName,
      role: regularRole.role_name,
    });
    expect(membershipRepo.create).toHaveBeenCalledWith({
      user: targetUser,
      organization: orgA,
      role: regularRole,
      isActive: true,
    });
  });

  it('allows custom role with organization member manage permission', async () => {
    const { service } = createService({
      organization: orgA,
      managerMembership: {
        id: 'manager-membership',
        role: customManagerRole,
        organization: orgA,
        isActive: true,
      },
      targetRole: regularRole,
    });

    const result = await service.create(
      {
        userId: targetUser.id,
        orgId: orgA.id,
        roleId: regularRole.id,
      },
      managerUser,
    );

    expect(result.statusCode).toBe(201);
  });

  it('blocks regular role without organization member manage permission', async () => {
    const { service } = createService({
      organization: orgA,
      managerMembership: {
        id: 'regular-membership',
        role: regularRole,
        organization: orgA,
        isActive: true,
      },
      targetRole: regularRole,
    });

    await expect(
      service.create(
        {
          userId: targetUser.id,
          orgId: orgA.id,
          roleId: regularRole.id,
        },
        regularUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks owner from managing another organization', async () => {
    const { service } = createService({
      organization: orgB,
      managerMembership: null,
      targetRole: { ...regularRole, organization: orgB },
    });

    await expect(
      service.create(
        {
          userId: targetUser.id,
          orgId: orgB.id,
          roleId: regularRole.id,
        },
        ownerUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks duplicate membership creation', async () => {
    const { service } = createService({
      organization: orgA,
      managerMembership: {
        id: 'owner-membership',
        role: ownerRole,
        organization: orgA,
        isActive: true,
      },
      targetRole: regularRole,
      existingMembership: {
        id: 'existing-membership',
        user: targetUser,
        organization: orgA,
        role: regularRole,
      },
    });

    await expect(
      service.create(
        {
          userId: targetUser.id,
          orgId: orgA.id,
          roleId: regularRole.id,
        },
        ownerUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks assigning a role beyond current permissions', async () => {
    const elevatedRole = {
      id: 'elevated-role',
      role_name: 'Elevated',
      role_code: 'ELEVATED',
      organization: orgA,
      permissions: [permissions.memberManage, permissions.roleCreate],
    };
    const { service } = createService({
      organization: orgA,
      managerMembership: {
        id: 'manager-membership',
        role: customManagerRole,
        organization: orgA,
        isActive: true,
      },
      targetRole: elevatedRole,
    });

    await expect(
      service.create(
        {
          userId: targetUser.id,
          orgId: orgA.id,
          roleId: elevatedRole.id,
        },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  function createService(options: {
    organization: any;
    managerMembership: any;
    targetRole: any;
    existingMembership?: any;
  }) {
    const membershipRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(options.managerMembership)
        .mockResolvedValueOnce(options.managerMembership)
        .mockResolvedValueOnce(options.existingMembership ?? null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn(async (membership) => ({
        id: 'membership-created',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        ...membership,
      })),
    };
    const roleRepo = {
      findOne: jest.fn().mockResolvedValue(options.targetRole),
    };
    const organizationRepo = {
      findOne: jest.fn().mockResolvedValue(options.organization),
    };
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(targetUser),
    };
    const service = new MembershipService(
      membershipRepo as any,
      roleRepo as any,
      organizationRepo as any,
      userRepo as any,
    );

    return {
      service,
      membershipRepo,
      roleRepo,
      organizationRepo,
      userRepo,
    };
  }
});
