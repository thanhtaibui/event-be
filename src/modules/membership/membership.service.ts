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
import { MembershipDto, OrganizationMembershipDto } from './dto/membership.dto';
import { Role } from '../role/entities/role.entity';
import { Organization } from '../organization/entities/organization.entity';
import { User } from '../user/entities/user.entity';

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
      this.userRepo.findOne({ where: { id: createMembershipDto.userId } }),
      this.organizationRepo.findOne({
        where: { id: createMembershipDto.orgId },
      }),
      this.roleRepo.findOne({
        where: { id: createMembershipDto.roleId, deletedAt: IsNull() },
        relations: ['organization'],
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    await this.assertCanManageOrganization(organization.id, currentUser);

    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (!this.roleCanBeUsedInOrganization(role, organization.id)) {
      throw new BadRequestException('Role does not belong to this organization');
    }

    const existingMembership = await this.membershipRepo.findOne({
      where: {
        user: { id: user.id },
        organization: { id: organization.id },
      },
      relations: ['user', 'role'],
    });

    if (existingMembership) {
      existingMembership.role = role;
      existingMembership.isActive = true;
      const saved = await this.membershipRepo.save(existingMembership);
      return Response(200, 'Membership already existed and was updated', {
        id: saved.id,
        userId: user.id,
        createdAt: saved.createdAt,
        userName: user.fullName,
        email: user.email,
        isActive: saved.isActive,
        role: role.role_name,
      });
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
    userId: string,
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

      const membership = await this.membershipRepo.findOne({
        where: {
          user: { id: userId },
          organization: { id: organization.id },
          isActive: true,
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'User does not belong to this organization',
        );
      }

      return this.findByOrganization(organization.id);
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
      membership.organization = organization;
    }

    if (updateMembershipDto.roleId) {
      const role = await this.roleRepo.findOne({
        where: { id: updateMembershipDto.roleId, deletedAt: IsNull() },
        relations: ['organization'],
      });
      if (!role) {
        throw new NotFoundException('Role not found');
      }
      const targetOrgId = membership.organization?.id;
      if (!this.roleCanBeUsedInOrganization(role, targetOrgId)) {
        throw new BadRequestException(
          'Role does not belong to this organization',
        );
      }
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
    await this.assertCanManageOrganization(
      membership.organization.id,
      currentUser,
    );

    const role = await this.roleRepo.findOne({
      where: {
        id: updateMembershipRoleDto.roleId,
        deletedAt: IsNull(),
      },
      relations: ['organization'],
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!this.roleCanBeUsedInOrganization(role, membership.organization.id)) {
      throw new BadRequestException(
        'Role does not belong to this organization',
      );
    }

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
    return roleCode?.trim().toUpperCase() === 'SUPER_ADMIN';
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
    if (!currentUser || currentUser.role?.isSuperAdmin) {
      return null;
    }

    const memberships = await this.membershipRepo.find({
      where: {
        user: { id: currentUser.userId },
        isActive: true,
      },
      relations: ['organization'],
      select: {
        id: true,
        organization: {
          id: true,
        },
      },
    });

    return memberships
      .map((membership) => membership.organization?.id)
      .filter((id): id is string => Boolean(id));
  }

  private async assertCanManageOrganization(
    orgId: string,
    currentUser?: any,
  ): Promise<void> {
    if (!currentUser) {
      return;
    }

    if (currentUser.role?.isSuperAdmin) {
      return;
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: currentUser.userId },
        organization: { id: orgId },
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('User does not belong to this organization');
    }
  }
}
