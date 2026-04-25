import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SortDto } from 'src/common/dtos/sort.dto';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { RoleDto } from './dto/role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { In, Repository } from 'typeorm';
import { applySearch, applySort } from 'src/common/utils/applySort';
import { paginateArray } from 'src/common/utils/paginate-array';
import { Permission } from '../permission/entities/permission.entity';
import { RoleOrgDto } from './dto/role-org.dto';
import { Organization } from '../organization/entities/organization.entity';
import { relative } from 'path';
import { response } from 'express';

@Injectable()
export class RoleService {

  constructor(@InjectRepository(Role) private roleRepo: Repository<Role>, @InjectRepository(Organization) private orgRepo: Repository<Organization>, @InjectRepository(Permission) private permissionRepo: Repository<Permission>) { }
  async create(createRoleDto: CreateRoleDto): Promise<ApiResponse<RoleDto>> {

    const existRoleName = await this.roleRepo.findOne({
      where: { role_name: createRoleDto.role_name.toUpperCase() },
    });
    if (existRoleName) {
      throw new BadRequestException('Role Name already exists');
    }
    const existRoleCode = await this.roleRepo.findOne({
      where: { role_code: createRoleDto.role_code.toUpperCase() },
    });
    if (existRoleCode) {
      throw new BadRequestException('Role Code already exists');
    }

    const permissions = await this.permissionRepo.findBy({
      id: In(createRoleDto.permissionIds),
    });

    if (permissions.length !== createRoleDto.permissionIds.length) {
      throw new BadRequestException('Some permissions not found');
    }

    const role = this.roleRepo.create({
      role_name: createRoleDto.role_name,
      role_code: createRoleDto.role_code.toUpperCase(),
      permissions,
      organization: { id: createRoleDto.orgId },
      colorKey: createRoleDto.colorKey
    });

    const savedRole = await this.roleRepo.save(role);

    const roleDto: RoleDto = {
      id: savedRole.id,
      role_name: savedRole.role_name,
      role_code: savedRole.role_code,
      colorKey: savedRole.colorKey,
      orgName: savedRole.organization.name,
      permissions: savedRole.permissions?.map((p) => ({
        permission_name: p.permission_name,
        permission_code: p.permission_code,
      })) || [],
    };

    return {
      statusCode: 201,
      message: 'Create role successfully',
      data: roleDto,
    };
  }

  async findAll(query: SortDto): Promise<ApiResponse<PaginationResult<RoleDto>>> {
    const { search } = query
    const roles = await this.roleRepo.find({ relations: ['permissions', 'permissions.parent', 'organization'] });
    const searchData = applySearch(
      roles,
      search,
      ['role_name', 'permissions.permission_name', 'organization.name'],
    )
    const itemPromises = searchData.map(async (r) => {
      return {
        id: r.id,
        role_name: r.role_name,
        role_code: r.role_code,
        colorKey: r.colorKey,
        orgName: r.organization?.name,
        permissions: await this.buildPermissionTree(r.permissions),
      };
    });
    const items = await Promise.all(itemPromises);
    return Response(200, "get all roles successfully", paginateArray<RoleDto>(items, query));
  }

  async findAllByOrg(orgId: string): Promise<ApiResponse<RoleOrgDto[]>> {
    const exOrg = await this.orgRepo.findOne({ where: { id: orgId } })
    if (!exOrg) {
      throw new BadRequestException('orgId not found');
    }
    const roleOrg = await this.roleRepo.find({
      where: {
        organization: {
          id: orgId
        },
      },
      relations: ['organization']
    })
    const result: RoleOrgDto[] = roleOrg.map((r) => ({
      id: r.id,
      role_name: r.role_name,
    }));

    return Response(200, "Get All Role Of Org Successfully", result)
  }
  async buildPermissionTree(permissions: any[]) {
    // Logger.warn("permissions", permissions)
    const map = new Map<string, any>();
    permissions.forEach((p) => {
      if (!p.parent?.id) {
        map.set(p.id, { id: p.id, permission_name: p.permission_name, permission_code: p.permission_code, children: [] });
      }
    });

    const tree: any[] = [];
    permissions.forEach((p) => {
      if (p.parent?.id) {
        map.get(p.parent?.id)?.children.push({ permission_name: p.permission_name, permission_code: p.permission_code });
      } else {
        tree.push(map.get(p.id));
      }
    });

    for (const tr of tree) {
      const totalChildren = await this.permissionRepo.count({
        where: {
          parent: { id: tr.id }
        }
      });
      tr.isAll = tr.children.length === totalChildren;
    }
    return tree.filter(tr => tr.children && tr.children.length > 0);
  }


  findOne(id: number) {
    return `This action returns a #${id} role`;
  }

  update(id: number, updateRoleDto: UpdateRoleDto) {
    return `This action updates a #${id} role`;
  }

  remove(id: number) {
    return `This action removes a #${id} role`;
  }
}
