import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from "@nestjs/swagger"
import { ApiResponse, Response } from '../../common/utils/ApiResponse';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { Query } from '@nestjs/common';
import { OrganizationDto } from './dto/organization.dto';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { RoleService } from '../role/role.service';
import { RoleOrgDto } from '../role/dto/role-org.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';
import { OrganizationResDto } from './dto/organization-res.dto';
import { UpdateActiveDto } from './dto/updateActiveDto.dto';
import { DeleteSort } from '../user/dto/delete-sort-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ApiPaginationQuery, FilterOperator, Paginate } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
// @ApiBearerAuth('access-token')
// @UseGuards(JwtGuard)
@Controller('organizations')
export class OrganizationController {

  constructor(private readonly organizationService: OrganizationService,
    private readonly roleService: RoleService,
  ) { }

  @Post()
  @UseInterceptors(FileInterceptor('logo'))
  async createOrganization(
    @Body() createDto: CreateOrganizationDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.organizationService.create(createDto, file);
  }
  @Get()
  @ApiOperation({ operationId: 'getOrgs' })
  @ApiPaginationQuery({
    searchableColumns: ['name', 'email', 'owner.fullName'],
    sortableColumns: ['name', 'email', 'owner.fullName'],
    filterableColumns: {
      isActive: [FilterOperator.EQ],
      status: [FilterOperator.EQ]
    },
  })
  async findAll(@Paginate() query: PaginateQuery): Promise<ApiResponse<PaginationResult<OrganizationDto>>> {
    return this.organizationService.findAll(query);
  }

  @Get('/switch-org')
  @ApiOperation({ operationId: 'SwitchOrg' })
  async SwitchOrg(): Promise<ApiResponse<SwitchOrgDto[]>> {
    return this.organizationService.SwitchOrg();
  }

  @Get(':id/members')
  findMembers(@Param('id') id: string): Promise<ApiResponse<OrganizationDto>> {
    return this.organizationService.GetMembersByOrgId(id);
  }
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<OrganizationResDto>> {
    return this.organizationService.GetOrgById(id);
  }
  @Patch(':id/banner')
  changeBanner(@Param('id') id: string, @Body() updateBannerDto: UpdateBannerDto): Promise<ApiResponse<UpdateBannerDto>> {
    return this.organizationService.updateBanner(id, updateBannerDto);
  }
  @Get('detail/:slug')
  findOrgBySlug(@Param('slug') slug: string): Promise<ApiResponse<OrganizationResDto>> {
    return this.organizationService.GetOrgBySlug(slug);
  }
  @Get(':orgId/roles')
  @ApiOperation({ operationId: 'getRoleOrg' })
  async getRolesByOrg(@Param('orgId') orgId: string): Promise<ApiResponse<RoleOrgDto[]>> {
    return this.roleService.findAllByOrg(orgId);
  }
  @Patch('/delete')
  @ApiOperation({ operationId: 'deleteSort' })
  deleteSort(@Body() deleteSort: DeleteSort): Promise<ApiResponse<DeleteSort>> {
    return this.organizationService.deleteSort(deleteSort);
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrganizationDto: UpdateOrganizationDto): Promise<ApiResponse<UpdateOrganizationDto>> {
    return this.organizationService.update(id, updateOrganizationDto);
  }

  @Patch(':id/active')
  @ApiOperation({ operationId: 'updateActive' })
  updateActive(@Param('id') id: string, @Body() updateActiveDto: UpdateActiveDto): Promise<ApiResponse<OrganizationResDto>> {
    return this.organizationService.updateActive(id, updateActiveDto.active);
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.organizationService.remove(+id);
  // }
}
