import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger"
import { SortDto } from '../../common/dtos/sort.dto';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { Query } from '@nestjs/common';
import { OrganizationDto } from './dto/organization.dto';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { RoleService } from '../role/role.service';
import { RoleOrgDto } from '../role/dto/role-org.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';
// @ApiBearerAuth('access-token')
// @UseGuards(JwtGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService, private readonly roleService: RoleService,) { }

  @Post()
  @ApiOperation({ operationId: 'CreateOrg' })
  create(@Body() createOrganizationDto: CreateOrganizationDto): Promise<ApiResponse<CreateOrganizationDto>> {
    return this.organizationService.create(createOrganizationDto);
  }

  @Get()
  @ApiOperation({ operationId: 'getOrgs' })
  async findAll(@Query() query: SortDto): Promise<ApiResponse<PaginationResult<OrganizationDto>>> {
    return this.organizationService.findAll(query);
  }

  @Get('/switch-org')
  @ApiOperation({ operationId: 'SwitchOrg' })
  async SwitchOrg(): Promise<ApiResponse<SwitchOrgDto[]>> {
    return this.organizationService.SwitchOrg();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ApiResponse<OrganizationDto>> {
    return this.organizationService.GetUserByOrgId(id);
  }
  @Get(':orgId/roles')
  @ApiOperation({ operationId: 'getRoleOrg' })
  async getRolesByOrg(@Param('orgId') orgId: string): Promise<ApiResponse<RoleOrgDto[]>> {
    return this.roleService.findAllByOrg(orgId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrganizationDto: UpdateOrganizationDto) {
    return this.organizationService.update(+id, updateOrganizationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizationService.remove(+id);
  }
}
