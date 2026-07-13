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

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  @Post()
  async create(
    @Body() createRoleDto: CreateRoleDto,
  ): Promise<ApiResponse<RoleDto>> {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @ApiPaginationQuery({
    sortableColumns: ['role_name', 'role_code', 'organization.name'],
    // filterableColumns: { status: [FilterOperator.EQ] },
  })
  @ApiOperation({ operationId: 'GetRoles' })
  async findAll(
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<RoleDto>>> {
    return this.roleService.findAll(query);
  }

  @Get('org/:slug')
  @ApiPaginationQuery({
    sortableColumns: ['role_name', 'role_code', 'organization.name'],
  })
  @ApiOperation({ operationId: 'GetRolesByOrgSlug' })
  async findAllByOrgSlug(
    @Param('slug') slug: string,
    @Req() req: any,
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<RoleDto>>> {
    return this.roleService.findAllByOrgSlug(slug, req.user.userId, query);
  }

  @Patch('/delete')
  @ApiOperation({ operationId: 'deleteSort' })
  deleteSort(@Body() deleteSort: DeleteSort): Promise<ApiResponse<DeleteSort>> {
    return this.roleService.deleteSort(deleteSort);
  }

  @Get(':id')
  GetRoleById(@Param('id') id: string): Promise<ApiResponse<RoleDto>> {
    return this.roleService.GetRoleById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<ApiResponse<RoleResDto>> {
    return this.roleService.update(id, updateRoleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }
}
