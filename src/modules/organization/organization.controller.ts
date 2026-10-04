import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';
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
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';
// @ApiBearerAuth('access-token')
// @UseGuards(JwtGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly roleService: RoleService,
  ) {}

  private assertSuperAdmin(req: any) {
    if (!req.user?.role?.isSuperAdmin) {
      throw new ForbiddenException();
    }
  }

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_CREATE)
  @UseInterceptors(FileInterceptor('logo'))
  async createOrganization(
    @Body() createDto: CreateOrganizationDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.organizationService.create(createDto, file);
  }
  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_VIEW)
  @ApiOperation({ operationId: 'getOrgs' })
  @ApiPaginationQuery({
    searchableColumns: ['name', 'email', 'owner.fullName'],
    sortableColumns: ['name', 'email', 'owner.fullName'],
    filterableColumns: {
      isActive: [FilterOperator.EQ],
      status: [FilterOperator.EQ],
    },
  })
  async findAll(
    @Req() req: any,
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<OrganizationDto>>> {
    return this.organizationService.findAll(query, req.user);
  }

  @Get('/switch-org')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_VIEW)
  @ApiOperation({ operationId: 'SwitchOrg' })
  async SwitchOrg(@Req() req: any): Promise<ApiResponse<SwitchOrgDto[]>> {
    return this.organizationService.SwitchOrg(req.user);
  }

  @Get(':id/members')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  findMembers(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<ApiResponse<OrganizationDto>> {
    return this.organizationService.GetMembersByOrgId(id, req.user);
  }
  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_VIEW)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<ApiResponse<OrganizationResDto>> {
    return this.organizationService.GetOrgById(id, req.user);
  }
  @Patch(':id/banner')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_UPDATE)
  changeBanner(
    @Param('id') id: string,
    @Body() updateBannerDto: UpdateBannerDto,
    @Req() req: any,
  ): Promise<ApiResponse<UpdateBannerDto>> {
    return this.organizationService.updateBanner(id, updateBannerDto, req.user);
  }
  @Get('detail/:slug')
  findOrgBySlug(
    @Param('slug') slug: string,
  ): Promise<ApiResponse<OrganizationResDto>> {
    return this.organizationService.GetOrgBySlug(slug);
  }
  @Get(':orgId/roles')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ROLE_VIEW)
  @ApiOperation({ operationId: 'getRoleOrg' })
  async getRolesByOrg(
    @Req() req: any,
    @Param('orgId') orgId: string,
  ): Promise<ApiResponse<RoleOrgDto[]>> {
    return this.roleService.findAllByOrg(orgId, req.user);
  }
  @Patch('/delete')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_DELETE)
  @ApiOperation({ operationId: 'deleteSort' })
  deleteSort(
    @Req() req: any,
    @Body() deleteSort: DeleteSort,
  ): Promise<ApiResponse<DeleteSort>> {
    return this.organizationService.deleteSort(deleteSort, req.user);
  }
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @Req() req: any,
  ): Promise<ApiResponse<UpdateOrganizationDto>> {
    return this.organizationService.update(id, updateOrganizationDto, req.user);
  }

  @Patch(':id/active')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_UPDATE)
  @ApiOperation({ operationId: 'updateActive' })
  updateActive(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateActiveDto: UpdateActiveDto,
  ): Promise<ApiResponse<OrganizationResDto>> {
    return this.organizationService.updateActive(id, updateActiveDto.active, req.user);
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.organizationService.remove(+id);
  // }
}
