import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationDto } from './dto/organization.dto';
import { Membership } from '../membership/entities/membership.entity';
import { EventStatus, OrganizationStatus } from 'src/shared/enum/enum';
import { User } from '../user/entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { SwitchOrgDto } from './dto/switch-org.dto';
import { OrganizationResDto } from './dto/organization-res.dto';
import { DeleteSort } from '../user/dto/delete-sort-user.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { paginate, FilterOperator, type PaginateQuery } from 'nestjs-paginate';
import { plainToInstance } from 'class-transformer';
import { Event } from '../event/entities/event.entity';
import { PermissionCode } from 'src/common/constants/permission-codes';
import { OrganizationMembersQueryDto } from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
    private readonly cloudinaryService: CloudinaryService,
    @InjectRepository(Membership) private memberRepo: Repository<Membership>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Event) private eventRepo: Repository<Event>,
  ) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
    file?: Express.Multer.File, // File logo từ Controller truyền xuống
  ): Promise<ApiResponse<CreateOrganizationDto>> {
    // 1. Kiểm tra xem Slug đã tồn tại chưa (Tránh lỗi Duplicate Entry)
    const existingOrg = await this.organizationRepo.findOne({
      where: { slug: createOrganizationDto.slug },
    });
    if (existingOrg) {
      throw new BadRequestException(
        'Slug already exists. Please choose another one.',
      );
    }
    const user = await this.userRepo.findOne({
      where: { id: createOrganizationDto.ownerId },
    });
    if (!user) {
      throw new BadRequestException(
        `User with ID ${createOrganizationDto.ownerId} not found`,
      );
    }
    const ownerRole = await this.findOwnerRole();
    let logoUrl;
    let logoPublicId;

    // 2. Nếu có file, tiến hành upload lên Cloudinary
    if (file) {
      try {
        const uploadResult = await this.cloudinaryService.uploadFile(
          file,
          'organizations/avatars',
        );
        logoUrl = uploadResult.data?.secure_url;
        logoPublicId = uploadResult.data?.public_id;
      } catch (error) {
        throw new BadRequestException('Failed to upload organization logo');
      }
    }

    // 3. Tạo instance và gán các trường dữ liệu mới
    const newOrg = this.organizationRepo.create({
      name: createOrganizationDto.name,
      bio: createOrganizationDto.bio,
      slug: createOrganizationDto.slug,
      status: OrganizationStatus.PENDING,
      owner: { id: createOrganizationDto.ownerId } as User,
      logoUrl: logoUrl,
      legalName: createOrganizationDto.legalName,
      // logoPublicId: logoPublicId,
      industry: createOrganizationDto.industry,
      email: createOrganizationDto.email,
      phone: createOrganizationDto.phone,
      website: createOrganizationDto.website,
      address: createOrganizationDto.address,
      isVerified: false,
    });
    const saveOrg = await this.organizationRepo.save(newOrg);
    await this.createOwnerMembershipIfMissing(user, saveOrg, ownerRole);
    // 4. Lưu vào Database
    const result: CreateOrganizationDto = {
      name: saveOrg.name,
      bio: saveOrg.bio,
      slug: saveOrg.slug,
      ownerId: saveOrg?.owner.id,
      legalName: saveOrg.legalName,
      industry: saveOrg.industry,
      email: saveOrg.email,
      phone: saveOrg.phone,
      website: saveOrg.website,
      address: saveOrg.address,
    };
    try {
      return Response(201, 'Create Organization Successfully', result);
    } catch (error) {
      // Nếu lưu DB thất bại mà đã lỡ upload ảnh, nên xóa ảnh trên Cloudinary để dọn rác
      if (logoPublicId) {
        await this.cloudinaryService.deleteFile(logoUrl);
      }
      throw new BadRequestException(
        'Could not create organization. Please try again.',
      );
    }
  }

  async SwitchOrg(currentUser?: any): Promise<ApiResponse<SwitchOrgDto[]>> {
    console.time('GET_SWITCH_ORGS');
    try {
      const orgIds = await this.getAccessibleOrganizationIds(currentUser);
      const orgs = await this.organizationRepo.find({
        where: orgIds
          ? {
              id: In(orgIds),
            }
          : undefined,
      });
      const result = orgs.map((org) => ({
        id: org.id,
        name: org.name,
        isVerified: org.isVerified,
      }));
      return Response(200, 'Get Switch Orgs Successfully', result);
    } finally {
      console.timeEnd('GET_SWITCH_ORGS');
    }
  }

  async findAll(
    query: PaginateQuery,
    currentUser?: any,
  ): Promise<ApiResponse<PaginationResult<OrganizationDto>>> {
    console.time('GET_ORGS');
    try {
      const orgIds = await this.getAccessibleOrganizationIds(currentUser);
      if (orgIds && orgIds.length === 0) {
        return Response(200, 'Get all organizations successfully', {
          items: [],
          page: 1,
          limit: query.limit ?? 10,
          total: 0,
          totalPages: 0,
        });
      }

      const result = await paginate(query, this.organizationRepo, {
        searchableColumns: ['name', 'email', 'owner.fullName'],
        sortableColumns: ['name', 'email', 'owner.fullName'],
        filterableColumns: {
          status: [FilterOperator.EQ],
        },
        where: orgIds ? { id: In(orgIds) } : undefined,
        relations: ['owner'],
        defaultSortBy: [['createdAt', 'DESC']],
      });

      const items = plainToInstance(OrganizationDto, result.data, {
        excludeExtraneousValues: true,
      });

      // 5. Phân trang sau khi đã xử lý xong data
      return Response(200, 'Get all organizations successfully', {
        items: items,
        page: result.meta.currentPage ?? 1,
        limit: result.meta.itemsPerPage,
        total: result.meta.totalItems ?? 0,
        totalPages: result.meta.totalPages ?? 1,
      });
    } finally {
      console.timeEnd('GET_ORGS');
    }
  }

  async findPublicOrganizations(): Promise<ApiResponse<any[]>> {
    console.time('GET_PUBLIC_ORGS');
    try {
      const organizations = await this.organizationRepo.find({
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

      const result = organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        logo: organization.logoUrl ?? null,
        description: organization.bio ?? null,
        createdAt: organization.createdAt,
      }));

      return Response(
        200,
        'Get public organizations successfully',
        result,
      );
    } finally {
      console.timeEnd('GET_PUBLIC_ORGS');
    }
  }

  async GetMembersByOrgId(
    orgId: string,
    query: OrganizationMembersQueryDto = {},
    currentUser?: any,
  ): Promise<ApiResponse<any>> {
    console.time('GET_ORG_MEMBERS');
    try {
      await this.ensureOrganizationExists(orgId);
      await this.assertCanManageOrganizationMembers(orgId, currentUser);

      const page = Math.max(Number(query.page ?? 1), 1);
      const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 100);
      const offset = (page - 1) * limit;

      const memberQuery = this.memberRepo
        .createQueryBuilder('membership')
        .leftJoin('membership.user', 'user')
        .leftJoin('membership.role', 'role')
        .where('membership.organizationId = :orgId', { orgId })
        .andWhere('user.id IS NOT NULL')
        .select([
          'membership.id AS "membershipId"',
          'membership.createdAt AS "createdAt"',
          'membership.isActive AS "isActive"',
          'user.id AS "userId"',
          'user.fullName AS "fullName"',
          'user.email AS "email"',
          'user.phoneNumber AS "phoneNumber"',
          'role.id AS "roleId"',
          'role.role_name AS "roleName"',
          'role.role_code AS "roleCode"',
          'role.colorKey AS "roleColor"',
        ])
        .orderBy('membership.createdAt', 'DESC')
        .offset(offset)
        .limit(limit);

      const [rows, total] = await Promise.all([
        memberQuery.getRawMany(),
        this.memberRepo
          .createQueryBuilder('membership')
          .leftJoin('membership.user', 'user')
          .where('membership.organizationId = :orgId', { orgId })
          .andWhere('user.id IS NOT NULL')
          .getCount(),
      ]);

      const items = rows.map((member) => ({
        membershipId: member.membershipId,
        userId: member.userId,
        fullName: member.fullName,
        email: member.email,
        phoneNumber: member.phoneNumber,
        isActive: member.isActive,
        createdAt: member.createdAt,
        role: member.roleId
          ? {
              id: member.roleId,
              name: member.roleName,
              code: member.roleCode,
              color: member.roleColor,
            }
          : null,
      }));

      return Response(200, 'Get organization members successfully', {
        items,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } finally {
      console.timeEnd('GET_ORG_MEMBERS');
    }
  }

  async getMemberSummary(
    orgId: string,
    currentUser?: any,
  ): Promise<ApiResponse<any>> {
    console.time('GET_ORG_MEMBER_SUMMARY');
    try {
      await this.ensureOrganizationExists(orgId);
      await this.assertCanManageOrganizationMembers(orgId, currentUser);

      const [totalMembers, activeMembers, inactiveMembers] = await Promise.all([
        this.memberRepo.count({
          where: {
            organization: { id: orgId },
          },
        }),
        this.memberRepo.count({
          where: {
            organization: { id: orgId },
            isActive: true,
          },
        }),
        this.memberRepo.count({
          where: {
            organization: { id: orgId },
            isActive: false,
          },
        }),
      ]);

      return Response(200, 'Get organization member summary successfully', {
        totalMembers,
        activeMembers,
        inactiveMembers,
      });
    } finally {
      console.timeEnd('GET_ORG_MEMBER_SUMMARY');
    }
  }

  async getOverview(
    orgId: string,
    currentUser?: any,
  ): Promise<ApiResponse<any>> {
    console.time('GET_ORG_OVERVIEW');
    try {
      await this.ensureOrganizationExists(orgId);
      await this.assertCanManageOrganizationMembers(orgId, currentUser);

      const [totalMembers, activeMembers, totalEvents, activeEvents] =
        await Promise.all([
          this.memberRepo.count({
            where: {
              organization: { id: orgId },
            },
          }),
          this.memberRepo.count({
            where: {
              organization: { id: orgId },
              isActive: true,
            },
          }),
          this.eventRepo.count({
            where: {
              organization: { id: orgId },
            },
          }),
          this.eventRepo.count({
            where: {
              organization: { id: orgId },
              status: In([
                EventStatus.PUBLISHED,
                EventStatus.UPCOMING,
                EventStatus.ONGOING,
              ]),
            },
          }),
        ]);

      return Response(200, 'Get organization overview successfully', {
        members: {
          total: totalMembers,
          active: activeMembers,
        },
        events: {
          total: totalEvents,
          active: activeEvents,
        },
      });
    } finally {
      console.timeEnd('GET_ORG_OVERVIEW');
    }
  }

  async GetOrgById(
    id: string,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationResDto>> {
    console.time('GET_ORG_BY_ID');
    try {
      await this.assertCanAccessOrganization(id, currentUser);
      const org = await this.organizationRepo.findOne({
        where: { id: id },
        relations: ['owner'],
      });

      if (!org) {
        throw new BadRequestException('Organization not found');
      }
      const result = {
        id: org.id,
        name: org.name,
        bio: org.bio,
        owner: org.owner,
        slug: org.slug,
        isVerified: org.isVerified,
        legalName: org.legalName,
        industry: org.industry,
        email: org.email,
        phone: org.phone,
        website: org.website,
        address: org.address,
        createdAt: org.createdAt,
        bannerUrl: org.bannerUrl,
        logoUrl: org.logoUrl,
      };

      return Response(200, 'Get Organization By Id Successfully', result);
    } finally {
      console.timeEnd('GET_ORG_BY_ID');
    }
  }
  async GetOrgBySlug(slug: string): Promise<ApiResponse<OrganizationResDto>> {
    console.time('GET_ORG_BY_SLUG');
    try {
      const org = await this.organizationRepo.findOne({
        where: { slug: slug.trim() },
        relations: ['owner'],
      });

      if (!org) {
        throw new BadRequestException('Organization not found');
      }
      const [totalMembers, totalEvents] = await Promise.all([
        this.memberRepo.count({
          where: {
            organization: { id: org.id },
            isActive: true,
          },
        }),
        this.eventRepo.count({
          where: {
            organization: { id: org.id },
          },
        }),
      ]);
      const result = {
        id: org.id,
        name: org.name,
        bio: org.bio,
        owner: org.owner,
        slug: org.slug,
        status: org.status,
        isVerified: org.isVerified,
        legalName: org.legalName,
        industry: org.industry,
        email: org.email,
        phone: org.phone,
        website: org.website,
        address: org.address,
        createdAt: org.createdAt,
        bannerUrl: org.bannerUrl,
        logoUrl: org.logoUrl,
        stats: {
          totalMembers,
          totalEvents,
        },
      };

      return Response(200, 'Get Organization By Id Successfully', result);
    } finally {
      console.timeEnd('GET_ORG_BY_SLUG');
    }
  }

  async GetPublicOrgBySlug(slug: string): Promise<ApiResponse<any>> {
    console.time('GET_PUBLIC_ORG_BY_SLUG');
    try {
      const org = await this.organizationRepo.findOne({
        where: {
          slug: slug.trim(),
          status: OrganizationStatus.ACTIVE,
        },
      });

      if (!org) {
        throw new BadRequestException('Organization not found');
      }

      const [totalMembers, totalEvents] = await Promise.all([
        this.memberRepo.count({
          where: {
            organization: { id: org.id },
            isActive: true,
          },
        }),
        this.eventRepo.count({
          where: {
            organization: { id: org.id },
          },
        }),
      ]);

      return Response(200, 'Get public organization detail successfully', {
        id: org.id,
        slug: org.slug,
        name: org.name,
        logoUrl: org.logoUrl ?? null,
        bannerUrl: org.bannerUrl ?? null,
        bio: org.bio ?? null,
        industry: org.industry ?? null,
        website: org.website ?? null,
        email: org.email ?? null,
        address: org.address ?? null,
        createdAt: org.createdAt,
        isVerified: org.isVerified,
        stats: {
          totalMembers,
          totalEvents,
        },
      });
    } finally {
      console.timeEnd('GET_PUBLIC_ORG_BY_SLUG');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} organization`;
  }
  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
    currentUser?: any,
  ): Promise<ApiResponse<UpdateOrganizationDto>> {
    await this.assertCanAccessOrganization(id, currentUser);
    const org = await this.organizationRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!org) {
      throw new BadRequestException(`Organization with ID ${id} not found`);
    }
    const { ownerId, ...otherData } = updateOrganizationDto;
    Object.assign(org, otherData);
    if (ownerId) {
      org.owner = { id: ownerId } as any;
    }
    // 3. Lưu vào Database
    const updatedOrg = await this.organizationRepo.save(org);

    return {
      statusCode: 200,
      message: 'Update organization successfully',
      data: updatedOrg,
    };
  }

  async updateActive(
    id: string,
    active: boolean,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationResDto>> {
    await this.assertCanAccessOrganization(id, currentUser);
    const org = await this.organizationRepo.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not exist');
    }
    org.status = active
      ? OrganizationStatus.ACTIVE
      : OrganizationStatus.SUSPENDED;
    const savedUser = await this.organizationRepo.save(org);
    return Response(200, 'Organization status updated successfully', savedUser);
  }

  async approve(
    id: string,
    currentUser?: any,
  ): Promise<ApiResponse<OrganizationResDto>> {
    this.assertSuperAdmin(currentUser);
    const org = await this.organizationRepo.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!org) {
      throw new NotFoundException('Organization not exist');
    }

    org.status = OrganizationStatus.ACTIVE;

    const savedOrg = await this.organizationRepo.save(org);
    return Response(200, 'Organization approved successfully', savedOrg);
  }

  async updateBanner(
    id: string,
    updateBannerDto: UpdateBannerDto,
    currentUser?: any,
  ): Promise<ApiResponse<UpdateBannerDto>> {
    await this.assertCanAccessOrganization(id, currentUser);
    const org = await this.organizationRepo.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not exist');
    }
    if (org.bannerUrl) {
      await this.cloudinaryService.deleteFile(org.bannerUrl);
    }
    org.bannerUrl = updateBannerDto.bannerUrl;
    const savedUser = await this.organizationRepo.save(org);
    return Response(200, 'Organization updated Active successfully', {
      id: savedUser.id,
      bannerUrl: savedUser.bannerUrl,
    });
  }

  async deleteSort(
    deleteSort: DeleteSort,
    currentUser?: any,
  ): Promise<ApiResponse<DeleteSort>> {
    Logger.warn('check1', deleteSort);
    const org = await this.organizationRepo.find({
      where: { id: In(deleteSort.ids) },
    });
    if (org.length !== deleteSort.ids.length) {
      throw new BadRequestException('Invalid ids');
    }
    for (const item of org) {
      await this.assertCanAccessOrganization(item.id, currentUser);
    }
    const names = org.map((i) => i.name);
    await this.organizationRepo.update(
      { id: In(deleteSort.ids) },
      { status: OrganizationStatus.ARCHIVED },
    );

    return Response(200, `Delete:${names.join(', ')} successfully`, deleteSort);
  }
  // remove(id: number) {
  //   return `This action removes a #${id} organization`;
  // }

  private async createOwnerMembershipIfMissing(
    owner: User,
    organization: Organization,
    ownerRole: Role,
  ): Promise<void> {
    const existingMembership = await this.memberRepo.findOne({
      where: {
        user: { id: owner.id },
        organization: { id: organization.id },
      },
    });

    if (existingMembership) {
      return;
    }

    const membership = this.memberRepo.create({
      user: owner,
      organization,
      role: ownerRole,
      isActive: true,
    });

    await this.memberRepo.save(membership);
  }

  private async findOwnerRole(): Promise<Role> {
    const ownerRole = await this.roleRepo.findOne({
      where: {
        role_code: 'OWNER',
        organization: IsNull(),
        deletedAt: IsNull(),
      },
    });

    if (!ownerRole) {
      throw new BadRequestException('OWNER role not found');
    }

    return ownerRole;
  }

  private async ensureOrganizationExists(orgId: string): Promise<void> {
    const organization = await this.organizationRepo.findOne({
      where: { id: orgId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
  }

  private async assertCanManageOrganizationMembers(
    orgId: string,
    currentUser?: any,
  ): Promise<void> {
    if (currentUser?.role?.isSuperAdmin) {
      return;
    }

    if (!currentUser?.userId) {
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    }

    const membership = await this.memberRepo.findOne({
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

    const hasPermission = membership.role?.permissions?.some(
      (permission) =>
        permission.permission_code === PermissionCode.ORGANIZATION_MEMBER_MANAGE,
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient organization permission');
    }
  }

  private async assertCanAccessOrganization(
    orgId: string,
    currentUser?: any,
  ): Promise<void> {
    if (!currentUser || currentUser.role?.isSuperAdmin) {
      return;
    }

    const membership = await this.memberRepo.findOne({
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

  private assertSuperAdmin(currentUser?: any): void {
    if (!currentUser?.role?.isSuperAdmin) {
      throw new ForbiddenException('SUPER_ADMIN_REQUIRED');
    }
  }

  private async getAccessibleOrganizationIds(
    currentUser?: any,
  ): Promise<string[] | null> {
    if (!currentUser || currentUser.role?.isSuperAdmin) {
      return null;
    }

    const memberships = await this.memberRepo.find({
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
}
