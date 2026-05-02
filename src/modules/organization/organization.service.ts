import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { SortDto } from '../../common/dtos/sort.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationDto } from './dto/organization.dto';
import { paginateArray } from '../../common/utils/paginate-array';
import { applySearch, applySort } from "../../common/utils/applySort"
import { Membership } from '../membership/entities/membership.entity';
import { OrgRequestStatus } from 'src/shared/enum/enum';
import { User } from '../user/entities/user.entity';
import { SwitchOrgDto } from './dto/switch-org.dto';
import { OrganizationResDto } from './dto/organization-res.dto';
import { DeleteSort } from '../user/dto/delete-sort-user.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class OrganizationService {
  constructor(@InjectRepository(Organization) private organizationRepo: Repository<Organization>,
    private readonly cloudinaryService: CloudinaryService,
    @InjectRepository(Membership) private memberRepo: Repository<Membership>,
    @InjectRepository(User) private userRepo: Repository<User>) { }


  async create(
    createOrganizationDto: CreateOrganizationDto,
    file?: Express.Multer.File, // File logo từ Controller truyền xuống
  ): Promise<ApiResponse<CreateOrganizationDto>> {
    // 1. Kiểm tra xem Slug đã tồn tại chưa (Tránh lỗi Duplicate Entry)
    const existingOrg = await this.organizationRepo.findOne({
      where: { slug: createOrganizationDto.slug },
    });
    if (existingOrg) {
      throw new BadRequestException('Slug already exists. Please choose another one.');
    }
    const user = await this.userRepo.findOne({ where: { id: createOrganizationDto.ownerId } });
    if (!user) {
      throw new BadRequestException(`User with ID ${createOrganizationDto.ownerId} not found`);
    }
    let logoUrl;
    let logoPublicId;

    // 2. Nếu có file, tiến hành upload lên Cloudinary
    if (file) {
      try {
        const uploadResult = await this.cloudinaryService.uploadFile(file, 'organizations/avatars');
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
      status: OrgRequestStatus.PENDING,
      owner: { id: createOrganizationDto.ownerId } as User,
      logoUrl: logoUrl,
      legalName: createOrganizationDto.legalName,
      // logoPublicId: logoPublicId,
      industry: createOrganizationDto.industry,
      email: createOrganizationDto.email,
      phone: createOrganizationDto.phone,
      website: createOrganizationDto.website,
      address: createOrganizationDto.address,
      isActive: true,
      isVerified: false,
    });
    const saveOrg = await this.organizationRepo.save(newOrg);
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
    }
    try {
      return Response(201, "Create Organization Successfully", result);
    } catch (error) {
      // Nếu lưu DB thất bại mà đã lỡ upload ảnh, nên xóa ảnh trên Cloudinary để dọn rác
      if (logoPublicId) {
        await this.cloudinaryService.deleteFile(logoUrl);
      }
      throw new BadRequestException('Could not create organization. Please try again.');
    }
  }


  async SwitchOrg(): Promise<ApiResponse<SwitchOrgDto[]>> {
    const orgs = await this.organizationRepo.find();
    const result = orgs.map((org) => ({
      id: org.id,
      name: org.name,
    }))
    return Response(200, 'Get Switch Orgs Successfully', result)
  }
  async findAll(query: SortDto): Promise<ApiResponse<PaginationResult<OrganizationDto>>> {
    const { sortBy, sortOrder, search } = query;

    const orgs = await this.organizationRepo.find({
      // where: { isDelete: false },
      relations: ['memberships', 'events', 'owner'],
    });

    // 2. Search dữ liệu thô trước
    const searchData = applySearch(
      orgs,
      search,
      ['name', 'status', 'Slug']
    );

    // 3. Sort dữ liệu
    const sortedData = applySort(
      searchData,
      sortBy as keyof Organization,
      sortOrder,
      ['name', 'status', 'createdAt']
    );

    // 4. Map sang DTO chuyên nghiệp
    const items: OrganizationDto[] = sortedData.map(org => ({
      id: org.id,
      name: org.name,
      bio: org.bio,
      slug: org.slug,
      isActive: org.isActive,
      status: org.status,
      createdAt: org.createdAt,
      owner: org.owner ? {
        id: org.owner.id,
        fullName: org.owner.fullName,
        email: org.owner.email,
      } : null,
      // Trả về số lượng để UI làm badge, không trả về mảng ID
      totalMembers: org.memberships?.length || 0,
      totalEvents: org.events?.length || 0,
    }));

    // 5. Phân trang sau khi đã xử lý xong data
    return Response(
      200,
      'Get all organizations successfully',
      paginateArray<OrganizationDto>(items, query)
    );
  }

  async GetMembersByOrgId(orgId: string): Promise<ApiResponse<any>> {
    // 1. Tìm Org và join sâu xuống User và Role
    const org = await this.organizationRepo.findOne({
      where: { id: orgId },
      relations: ['memberships', 'memberships.user', 'memberships.role']
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    // 2. Map lại dữ liệu để trả về danh sách Member (Phẳng hóa)
    const members = (org.memberships || [])
      .filter(m => m.user !== null) // Loại bỏ nếu user không tồn tại
      .map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        fullName: m.user.fullName,
        email: m.user.email,
        phoneNumber: m.user.phoneNumber,
        isActive: m.isActive, // Trạng thái của user trong Org này
        role: m.role ? {
          id: m.role.id,
          name: m.role.role_name,
          color: m.role.colorKey
        } : null
      }));

    // 3. Trả về thông tin Org kèm danh sách members đã làm sạch
    const result = {
      id: org.id,
      name: org.name,
      status: org.status,
      totalMembers: members.length,
      members: members // Đây là mảng đã được phẳng hóa
    };

    return Response(
      200,
      'Get members of organization successfully',
      result
    );
  }

  async GetOrgById(id: string): Promise<ApiResponse<OrganizationResDto>> {
    const org = await this.organizationRepo.findOne({
      where: { id: id },
      relations: ['owner']
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
      legalName: org.legalName,
      industry: org.industry,
      email: org.email,
      phone: org.phone,
      website: org.website,
      address: org.address,
      createdAt: org.createdAt,
      bannerUrl: org.bannerUrl,
      logoUrl: org.logoUrl
    };

    return Response(
      200,
      'Get Organization By Id Successfully',
      result
    );
  }
  async GetOrgBySlug(slug: string): Promise<ApiResponse<OrganizationResDto>> {
    const org = await this.organizationRepo.findOne({
      where: { slug: slug.trim() },
      relations: ['owner']
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
      legalName: org.legalName,
      industry: org.industry,
      email: org.email,
      phone: org.phone,
      website: org.website,
      address: org.address,
      createdAt: org.createdAt,
      bannerUrl: org.bannerUrl,
      logoUrl: org.logoUrl
    };

    return Response(
      200,
      'Get Organization By Id Successfully',
      result
    );
  }

  findOne(id: number) {
    return `This action returns a #${id} organization`;
  }
  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto
  ): Promise<ApiResponse<UpdateOrganizationDto>> {
    const org = await this.organizationRepo.findOne({
      where: { id },
      relations: ['owner']
    });
    if (!org) {
      throw new BadRequestException(`Organization with ID ${id} not found`)
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

  async updateActive(id: string, isActive: boolean): Promise<ApiResponse<OrganizationResDto>> {
    const org = await this.organizationRepo.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not exist');
    }
    org.isActive = isActive
    const savedUser = await this.organizationRepo.save(org);
    return Response(200, 'Organization updated Active successfully', savedUser);
  }
  async updateBanner(id: string, updateBannerDto: UpdateBannerDto): Promise<ApiResponse<UpdateBannerDto>> {
    const org = await this.organizationRepo.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not exist');
    }
    if (org.bannerUrl) {
      await this.cloudinaryService.deleteFile(org.bannerUrl);
    }
    org.bannerUrl = updateBannerDto.bannerUrl
    const savedUser = await this.organizationRepo.save(org);
    return Response(200, 'Organization updated Active successfully', { id: savedUser.id, bannerUrl: savedUser.bannerUrl });
  }

  async deleteSort(deleteSort: DeleteSort): Promise<ApiResponse<DeleteSort>> {
    Logger.warn('check1', deleteSort)
    const org = await this.organizationRepo.find({ where: { id: In(deleteSort.ids) } })
    if (org.length !== deleteSort.ids.length) {
      throw new BadRequestException("Invalid ids");
    }
    const names = org.map(i => i.name);
    await this.organizationRepo.update(
      { id: In(deleteSort.ids) },
      { status: OrgRequestStatus.ARCHIVED },
    );

    return Response(200, `Delete:${names.join(", ")} successfully`, deleteSort)
  }
  // remove(id: number) {
  //   return `This action removes a #${id} organization`;
  // }
}
