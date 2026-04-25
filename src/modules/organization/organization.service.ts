import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { SortDto } from '../../common/dtos/sort.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationDto } from './dto/organization.dto';
import { paginateArray } from '../../common/utils/paginate-array';
import { applySearch, applySort } from "../../common/utils/applySort"
import { Membership } from '../membership/entities/membership.entity';
import { OrgRequestStatus } from 'src/shared/enum/enum';
import { User } from '../user/entities/user.entity';
import { SwitchOrgDto } from './dto/switch-org.dto';

@Injectable()
export class OrganizationService {
  constructor(@InjectRepository(Organization) private organizationRepo: Repository<Organization>, @InjectRepository(Membership) private memberRepo: Repository<Membership>, @InjectRepository(User) private userRepo: Repository<User>) { }
  async create(createOrganizationDto: CreateOrganizationDto): Promise<ApiResponse<CreateOrganizationDto>> {
    const user = await this.userRepo.findOne({
      where: { id: createOrganizationDto.ownerId },
    })
    if (!user) {
      throw new BadRequestException('User done not find');
    }
    const request = this.organizationRepo.create({
      name: createOrganizationDto.name,
      bio: createOrganizationDto.bio,
      owner: {
        id: createOrganizationDto.ownerId
      },
      status: OrgRequestStatus.PENDING,
    });
    const saveOrg = await this.organizationRepo.save(request);
    const result = {
      name: saveOrg.name,
      bio: saveOrg.bio,
      ownerId: saveOrg.owner.id,
      status: saveOrg.status,
    }
    return Response(201, "Create Org Successfully", result)
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
    const { sortBy, sortOrder, search } = query
    const orgs = await this.organizationRepo.find({
      relations: ['memberships', "events", "memberships.role"],
    })
    const result = orgs.map((org) => ({
      ...org,
      memberCount: org.memberships?.length || 0,
    }));
    const sortedData = applySort(
      result,
      sortBy as keyof Organization,
      sortOrder,
      ['name', 'status'],
    )
    const searchData = applySearch(
      sortedData,
      search,
      ['name', 'status'],
    )
    const items = searchData.map(org => ({
      id: org.id,
      name: org.name,
      bio: org.bio,
      // events: org.events,
      isActive: org.isActive,
      owner: org.owner,
      membershipIds: org.memberships?.map(m => m.id) || [],
      status: org.status
    }));

    return Response(
      200,
      'Get all organizations successfully',
      paginateArray<OrganizationDto>(items, query)
    );
  }

  async GetUserByOrgId(id: string): Promise<ApiResponse<OrganizationDto>> {
    const org = await this.organizationRepo.findOne({
      where: { id: id },
      relations: ['memberships', 'memberships.user', 'memberships.role']
    })
    if (!org) {
      throw new BadRequestException('Organization done not find');
    }
    const item = {
      name: org.name,
      bio: org.bio,
      isActive: org.isActive,
      owner: org.owner,
      status: org.status,
      memberships: org.memberships?.map((m) => ({
        userId: m.user?.id,
        organizationId: m.organization?.id,
        isActive: m.isActive,
        roleId: m.role.id
      })) || [],
    };
    return Response(
      200,
      'Get members of organizations successfully',
      item
    );
  }

  findOne(id: number) {
    return `This action returns a #${id} organization`;
  }

  update(id: number, updateOrganizationDto: UpdateOrganizationDto) {
    return `This action updates a #${id} organization`;
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
