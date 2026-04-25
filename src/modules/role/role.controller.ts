import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiOperation } from '@nestjs/swagger';
import { SortDto } from 'src/common/dtos/sort.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { RoleDto } from './dto/role.dto';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  @Post()
  async create(@Body() createRoleDto: CreateRoleDto): Promise<ApiResponse<RoleDto>> {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ operationId: 'GetRoles' })
  async findAll(@Query() query: SortDto): Promise<ApiResponse<PaginationResult<RoleDto>>> {
    return this.roleService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }
}
