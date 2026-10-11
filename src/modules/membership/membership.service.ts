import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMembershipDto } from './dto/create-membership.dto';
import {
  UpdateMembershipRoleDto,
  UpdateMembershipStatusDto,
  UpdateMembershipDto,
} from './dto/update-membership.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Membership } from './entities/membership.entity';
import { In, IsNull, Repository } from 'typeorm';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import {
  PermissionCode,
  PermissionCodeValue,
} from 'src/common/constants/permission-codes';
import { MembershipDto, OrganizationMembershipDto } from './dto/membership.dto';
import { Role } from '../role/entities/role.entity';
import { Organization } from '../organization/entities/organization.entity';
import { User } from '../user/entities/user.entity';
import {
  assertNotSuperAdminSystemMembership,
  assertNotSuperAdminSystemUser,
  isSuperAdminRole,
  isSuperAdminRoleCode,
} from '../../common/system-account/super-admin-protection';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(Membership)
    private membershipRepo: Repository<Membership>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(
    createMembershipDto: CreateMembershipDto,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationMembershipDto>> {
    if (!createMembershipDto.userId) {
      throw new BadRequestException('User ID is required');
    }

    const [user, organization, role] = await Promise.all([
      this.userRepo.findOne({
        where: { id: createMembershipDto.userId },
        relations: ['memberships', 'memberships.role'],
      }),
      this.organizationRepo.findOne({
        where: { id: createMembershipDto.orgId },
      }),
      this.roleRepo.findOne({
        where: { id: createMembershipDto.roleId, deletedAt: IsNull() },
        relations: ['organization', 'permissions'],
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    assertNotSuperAdminSystemUser(
      user,
      'SUPER_ADMIN system account membership cannot be modified.',
    );
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    await this.assertCanManageOrganization(organization.id, currentUser);

    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (isSuperAdminRole(role)) {
      throw new ForbiddenException(
        'SUPER_ADMIN system role cannot be assigned.',
      );
    }
    if (!this.roleCanBeUsedInOrganization(role, organization.id)) {
      throw new BadRequestException('Role does not belong to this organization');
    }
    await this.assertRoleAssignmentAllowed(role, organization.id, currentUser);

    const existingMembership = await this.membershipRepo.findOne({
      where: {
        user: { id: user.id },
        organization: { id: organization.id },
      },
      relations: ['user', 'role'],
    });

    if (existingMembership) {
      assertNotSuperAdminSystemMembership(
        existingMembership,
        'SUPER_ADMIN system membership cannot be modified.',
      );
      throw new BadRequestException('Membership already exists');
    }

    const membership = this.membershipRepo.create({
      user,
      organization,
      role,
      isActive: true,
    });
    const savedMembership = await this.membershipRepo.save(membership);

    return Response(201, 'Create Membership Successfully', {
      id: savedMembership.id,
      userId: user.id,
      createdAt: savedMembership.createdAt,
      userName: user.fullName,
      email: user.email,
      isActive: savedMembership.isActive,
      role: role.role_name,
    });
  }

  async findAll(
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationMembershipDto[]>> {
    console.time('GET_MEMBERSHIPS');
    try {
      const orgIds = await this.getAccessibleOrganizationIds(currentUser);
      if (orgIds && orgIds.length === 0) {
        return Response(200, 'Get Memberships Successfully', []);
      }

      const memberships = await this.membershipRepo.find({
        where: orgIds
          ? {
              organization: {
                id: In(orgIds),
              },
            }
          : undefined,
        relations: ['user', 'organization', 'role'],
        order: { createdAt: 'DESC' },
      });

      return Response(
        200,
        'Get Memberships Successfully',
        memberships
          .filter((membership) => membership.user)
          .filter((membership) => !isSuperAdminRole(membership.role))
          .map((membership) => ({
            id: membership.id,
            userId: membership.user.id,
            createdAt: membership.createdAt,
            userName: membership.user.fullName,
            email: membership.user.email,
            isActive: membership.isActive,
            role: membership.role?.role_name ?? null,
          })),
      );
    } finally {
      console.timeEnd('GET_MEMBERSHIPS');
    }
  }

  async findUserOrganizations(
    userId: string,
  ): Promise<ApiResponse<MembershipDto[]>> {
    const timer = `GET_USER_ORGANIZATIONS:${userId}`;
    console.time(timer);
    try {
      const memberships = await this.membershipRepo.find({
        where: { user: { id: userId } },
        relations: ['organization', 'role'],
      });

      const result = memberships
        .filter((m) => m.role !== null && m.organization !== null)
        .filter((m) => !this.isSuperAdminRoleCode(m.role.role_code))
        .map((m) => ({
          userId: userId,
          organizationId: m.organization?.id,
          roleId: m.role?.id,
          isActive: m.isActive,
        }));
      return Response(200, 'Get Orgs of User Successfully', result);
    } finally {
      console.timeEnd(timer);
    }
  }

  async findByOrganization(
    orgId: string,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationMembershipDto[]>> {
    const timer = `GET_MEMBERSHIPS_BY_ORG:${orgId}`;
    console.time(timer);
    try {
      await this.assertCanManageOrganization(orgId, currentUser);
      const memberships = await this.membershipRepo.find({
        where: { organization: { id: orgId } },
        relations: ['user', 'role'],
        order: { createdAt: 'DESC' },
      });

      const result = memberships
        .filter((m) => m.user !== null)
        .map((m) => ({
          id: m.id,
          userId: m.user.id,
          createdAt: m.createdAt,
          userName: m.user.fullName,
          email: m.user.email,
          isActive: m.isActive,
          role: m.role?.role_name ?? null,
        }));

      return Response(
        200,
        'Get Memberships Of Organization Successfully',
        result,
      );
    } finally {
      console.timeEnd(timer);
    }
  }

  async findByOrganizationSlug(
    slug: string,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationMembershipDto[]>> {
    const timer = `GET_MEMBERSHIPS_BY_ORG_SLUG:${slug}`;
    console.time(timer);
    try {
      const organization = await this.organizationRepo.findOne({
        where: { slug },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      if (!currentUser?.role?.isSuperAdmin) {
        const membership = await this.membershipRepo.findOne({
          where: {
            user: { id: currentUser?.userId },
            organization: { id: organization.id },
            isActive: true,
          },
          relations: ['role', 'role.permissions'],
        });

        if (
          !membership ||
          !this.membershipHasPermission(
            membership,
            PermissionCode.ORGANIZATION_MEMBER_MANAGE,
          )
        ) {
          throw new ForbiddenException(
            'User does not belong to this organization',
          );
        }
      }

      return this.findByOrganization(organization.id, currentUser);
    } finally {
      console.timeEnd(timer);
    }
  }

  async findOne(
    id: string,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationMembershipDto>> {
    const timer = `GET_MEMBERSHIP_BY_ID:${id}`;
    console.time(timer);
    try {
      const membership = await this.membershipRepo.findOne({
        where: { id },
        relations: ['user', 'organization', 'role'],
      });

      if (!membership) {
        throw new NotFoundException('Membership not found');
      }
      assertNotSuperAdminSystemMembership(
        membership,
        'SUPER_ADMIN system membership cannot be read through normal CRUD.',
      );
      await this.assertCanManageOrganization(
        membership.organization.id,
        currentUser,
      );

      return Response(200, 'Get Membership Successfully', {
        id: membership.id,
        userId: membership.user.id,
        createdAt: membership.createdAt,
        userName: membership.user.fullName,
        email: membership.user.email,
        isActive: membership.isActive,
        role: membership.role?.role_name ?? null,
      });
    } finally {
      console.timeEnd(timer);
    }
  }

  async update(
    id: string,
    updateMembershipDto: UpdateMembershipDto,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationMembershipDto>> {
    const membership = await this.membershipRepo.findOne({
      where: { id },
      relations: ['user', 'organization', 'role'],
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    assertNotSuperAdminSystemMembership(
      membership,
      'SUPER_ADMIN system membership cannot be modified.',
    );
    await this.assertCanManageOrganization(
      membership.organization.id,
      currentUser,
    );

    if (updateMembershipDto.orgId) {
      const organization = await this.organizationRepo.findOne({
        where: { id: updateMembershipDto.orgId },
      });
      if (!organization) {
        throw new NotFoundException('Organization not found');
      }
      await this.assertCanManageOrganization(organization.id, currentUser);
      membership.organization = organization;
    }

    if (updateMembershipDto.roleId) {
      const role = await this.roleRepo.findOne({
        where: { id: updateMembershipDto.roleId, deletedAt: IsNull() },
        relations: ['organization', 'permissions'],
      });
      if (!role) {
        throw new NotFoundException('Role not found');
      }
      if (isSuperAdminRole(role)) {
        throw new ForbiddenException(
          'SUPER_ADMIN system role cannot be assigned.',
        );
      }
      const targetOrgId = membership.organization?.id;
      if (!this.roleCanBeUsedInOrganization(role, targetOrgId)) {
        throw new BadRequestException(
          'Role does not belong to this organization',
        );
      }
      await this.assertRoleAssignmentAllowed(role, targetOrgId, currentUser);
      membership.role = role;
    }

    const savedMembership = await this.membershipRepo.save(membership);
    return Response(200, 'Update Membership Successfully', {
      id: savedMembership.id,
      userId: savedMembership.user.id,
      createdAt: savedMembership.createdAt,
      userName: savedMembership.user.fullName,
      email: savedMembership.user.email,
      isActive: savedMembership.isActive,
      role: savedMembership.role?.role_name ?? null,
    });
  }

  async updateStatus(
    id: string,
    updateMembershipStatusDto: UpdateMembershipStatusDto,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationMembershipDto>> {
    const membership = await this.membershipRepo.findOne({
      where: { id },
      relations: ['user', 'organization', 'role'],
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    assertNotSuperAdminSystemMembership(
      membership,
      'SUPER_ADMIN system membership cannot be modified.',
    );
    await this.assertCanManageOrganization(
      membership.organization.id,
      currentUser,
    );

    membership.isActive = updateMembershipStatusDto.active;
    const savedMembership = await this.membershipRepo.save(membership);

    return Response(200, 'Update Membership Status Successfully', {
      id: savedMembership.id,
      userId: savedMembership.user.id,
      createdAt: savedMembership.createdAt,
      userName: savedMembership.user.fullName,
      email: savedMembership.user.email,
      isActive: savedMembership.isActive,
      role: savedMembership.role?.role_name ?? null,
    });
  }

  async updateRole(
    id: string,
    updateMembershipRoleDto: UpdateMembershipRoleDto,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationMembershipDto>> {
    const membership = await this.membershipRepo.findOne({
      where: { id },
      relations: ['user', 'organization', 'role'],
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    assertNotSuperAdminSystemMembership(
      membership,
      'SUPER_ADMIN system membership cannot be modified.',
    );
    await this.assertCanManageOrganization(
      membership.organization.id,
      currentUser,
    );

    const role = await this.roleRepo.findOne({
      where: {
        id: updateMembershipRoleDto.roleId,
        deletedAt: IsNull(),
      },
      relations: ['organization', 'permissions'],
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (isSuperAdminRole(role)) {
      throw new ForbiddenException(
        'SUPER_ADMIN system role cannot be assigned.',
      );
    }

    if (!this.roleCanBeUsedInOrganization(role, membership.organization.id)) {
      throw new BadRequestException(
        'Role does not belong to this organization',
      );
    }
    await this.assertRoleAssignmentAllowed(
      role,
      membership.organization.id,
      currentUser,
    );

    membership.role = role;
    const savedMembership = await this.membershipRepo.save(membership);

    return Response(200, 'Update Membership Role Successfully', {
      id: savedMembership.id,
      userId: savedMembership.user.id,
      createdAt: savedMembership.createdAt,
      userName: savedMembership.user.fullName,
      email: savedMembership.user.email,
      isActive: savedMembership.isActive,
      role: savedMembership.role?.role_name ?? null,
    });
  }

  async remove(
    id: string,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationMembershipDto>> {
    const membership = await this.membershipRepo.findOne({
      where: { id },
      relations: ['user', 'organization', 'role'],
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    assertNotSuperAdminSystemMembership(
      membership,
      'SUPER_ADMIN system membership cannot be deleted.',
    );
    await this.assertCanManageOrganization(
      membership.organization.id,
      currentUser,
    );

    membership.isActive = false;
    const savedMembership = await this.membershipRepo.save(membership);

    return Response(200, 'Remove Membership Successfully', {
      id: savedMembership.id,
      userId: savedMembership.user.id,
      createdAt: savedMembership.createdAt,
      userName: savedMembership.user.fullName,
      email: savedMembership.user.email,
      isActive: savedMembership.isActive,
      role: savedMembership.role?.role_name ?? null,
    });
  }

  private isSuperAdminRoleCode(roleCode?: string): boolean {
    return isSuperAdminRoleCode(roleCode);
  }

  private roleCanBeUsedInOrganization(role: Role, orgId?: string): boolean {
    if (!orgId) {
      return false;
    }

    if (role.organization?.id === orgId) {
      return true;
    }

    return !role.organization && role.role_code?.trim().toUpperCase() === 'OWNER';
  }

  private async getAccessibleOrganizationIds(
    currentUser?: any,
  ): Promise<string[] | null> {
    if (currentUser?.role?.isSuperAdmin) {
      return null;
    }

    if (!currentUser?.userId) {
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    }

    const memberships = await this.membershipRepo.find({
      where: {
        user: { id: currentUser.userId },
        isActive: true,
      },
      relations: ['organization', 'role', 'role.permissions'],
    });

    return memberships
      .filter((membership) =>
        this.membershipHasPermission(
          membership,
          PermissionCode.ORGANIZATION_MEMBER_MANAGE,
        ),
      )
      .map((membership) => membership.organization?.id)
      .filter((id): id is string => Boolean(id));
  }

  private async assertCanManageOrganization(
    orgId: string,
    currentUser?: any,
  ): Promise<void> {
    if (currentUser?.role?.isSuperAdmin) {
      return;
    }

    if (!currentUser?.userId) {
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: currentUser.userId },
        organization: { id: orgId },
        isActive: true,
      },
      relations: ['role', 'role.permissions'],
    });

    if (!membership) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    if (
      !this.membershipHasPermission(
        membership,
        PermissionCode.ORGANIZATION_MEMBER_MANAGE,
      )
    ) {
      throw new ForbiddenException('Insufficient organization permission');
    }
  }

  private async assertRoleAssignmentAllowed(
    targetRole: Role,
    orgId: string | undefined,
    currentUser?: any,
  ): Promise<void> {
    if (currentUser?.role?.isSuperAdmin) {
      return;
    }

    if (!currentUser?.userId) {
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    }

    if (!orgId) {
      throw new ForbiddenException('ORGANIZATION_SCOPE_REQUIRED');
    }

    const managerMembership = await this.membershipRepo.findOne({
      where: {
        user: { id: currentUser?.userId },
        organization: { id: orgId },
        isActive: true,
      },
      relations: ['role', 'role.permissions'],
    });

    if (!managerMembership) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    const managerPermissionCodes = new Set(
      managerMembership.role?.permissions?.map(
        (permission) => permission.permission_code,
      ) || [],
    );
    const targetPermissionCodes =
      targetRole.permissions?.map((permission) => permission.permission_code) ||
      [];
    const exceedsCurrentUserPermissions = targetPermissionCodes.some(
      (permissionCode) => !managerPermissionCodes.has(permissionCode),
    );

    if (exceedsCurrentUserPermissions) {
      throw new ForbiddenException('Cannot assign role beyond current permissions');
    }
  }

  private membershipHasPermission(
    membership: Membership,
    permissionCode: PermissionCodeValue,
  ): boolean {
    return Boolean(
      membership.role?.permissions?.some(
        (permission) => permission.permission_code === permissionCode,
      ),
    );
  }
}
