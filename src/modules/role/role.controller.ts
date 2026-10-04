import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiOperation } from '@nestjs/swagger';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { RoleDto, RoleResDto } from './dto/role.dto';
import { DeleteSort } from '../user/dto/delete-sort-user.dto';
import { ApiPaginationQuery, Paginate } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  private assertSuperAdmin(req: any) {
    if (!req.user?.role?.isSuperAdmin) {
      throw new ForbiddenException();
    }
  }

  @Post()
  @Permissions(PermissionCode.ROLE_CREATE)
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @Req() req: any,
  ): Promise<ApiResponse<RoleDto>> {
    return this.roleService.create(createRoleDto, req.user);
  }

  @Get()
  @ApiPaginationQuery({
    sortableColumns: ['role_name', 'role_code', 'organization.name'],
    // filterableColumns: { status: [FilterOperator.EQ] },
  })
  @ApiOperation({ operationId: 'GetRoles' })
  @Permissions(PermissionCode.ROLE_VIEW)
  async findAll(
    @Req() req: any,
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<any>>> {
    return this.roleService.findAll(query, req.user);
  }

  @Get('org/:slug')
  @ApiPaginationQuery({
    sortableColumns: ['role_name', 'role_code', 'organization.name'],
  })
  @ApiOperation({ operationId: 'GetRolesByOrgSlug' })
  @Permissions(PermissionCode.ROLE_VIEW)
  async findAllByOrgSlug(
    @Param('slug') slug: string,
    @Req() req: any,
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<any>>> {
    return this.roleService.findAllByOrgSlug(slug, req.user.userId, query);
  }

  @Patch('/delete')
  @ApiOperation({ operationId: 'deleteSort' })
  @Permissions(PermissionCode.ROLE_DELETE)
  deleteSort(
    @Body() deleteSort: DeleteSort,
    @Req() req: any,
  ): Promise<ApiResponse<DeleteSort>> {
    return this.roleService.deleteSort(deleteSort, req.user);
  }

  @Get(':id/permissions')
  @ApiOperation({ operationId: 'GetRolePermissions' })
  @Permissions(PermissionCode.ROLE_VIEW)
  getRolePermissions(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    return this.roleService.getRolePermissions(id, req.user);
  }

  @Get(':id')
  @Permissions(PermissionCode.ROLE_VIEW)
  GetRoleById(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<ApiResponse<RoleDto>> {
    return this.roleService.GetRoleById(id, req.user);
  }

  @Patch(':id')
  @Permissions(PermissionCode.ROLE_UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Req() req: any,
  ): Promise<ApiResponse<RoleResDto>> {
    return this.roleService.update(id, updateRoleDto, req.user);
  }

  @Delete(':id')
  @Permissions(PermissionCode.ROLE_DELETE)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.roleService.remove(id, req.user);
  }
}
