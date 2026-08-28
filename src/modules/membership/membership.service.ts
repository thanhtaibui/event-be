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
import { IsNull, Repository } from 'typeorm';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { MembershipDto, OrganizationMembershipDto } from './dto/membership.dto';
import { Role } from '../role/entities/role.entity';
import { Organization } from '../organization/entities/organization.entity';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(Membership)
    private membershipRepo: Repository<Membership>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
  ) {}

  create(createMembershipDto: CreateMembershipDto) {
    return 'This action adds a new membership';
  }

  findAll() {
    return `This action returns all membership`;
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
  ): Promise<ApiResponse<OrganizationMembershipDto[]>> {
    const timer = `GET_MEMBERSHIPS_BY_ORG:${orgId}`;
    console.time(timer);
    try {
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

  async findOne(id: string): Promise<ApiResponse<OrganizationMembershipDto>> {
    const timer = `GET_MEMBERSHIP_BY_ID:${id}`;
    console.time(timer);
    try {
      const membership = await this.membershipRepo.findOne({
        where: { id },
        relations: ['user', 'role'],
      });

      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

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

  update(id: string, updateMembershipDto: UpdateMembershipDto) {
    return `This action updates a #${id} membership`;
  }

  async updateStatus(
    id: string,
    updateMembershipStatusDto: UpdateMembershipStatusDto,
  ): Promise<ApiResponse<OrganizationMembershipDto>> {
    const membership = await this.membershipRepo.findOne({
      where: { id },
      relations: ['user', 'role'],
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

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
  ): Promise<ApiResponse<OrganizationMembershipDto>> {
    const membership = await this.membershipRepo.findOne({
      where: { id },
      relations: ['user', 'organization', 'role'],
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

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

    if (role.organization.id !== membership.organization.id) {
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

  remove(id: number) {
    return `This action removes a #${id} membership`;
  }

  private isSuperAdminRoleCode(roleCode?: string): boolean {
    return roleCode?.trim().toUpperCase() === 'SUPER_ADMIN';
  }
}
