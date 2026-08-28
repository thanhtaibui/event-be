import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { RoleDto, RoleResDto } from './dto/role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { In, IsNull, Repository } from 'typeorm';
import { Permission } from '../permission/entities/permission.entity';
import { RoleOrgDto } from './dto/role-org.dto';
import { Organization } from '../organization/entities/organization.entity';
import { relative } from 'path';
import { response } from 'express';
import { DeleteSort } from '../user/dto/delete-sort-user.dto';
import { paginate, PaginateQuery } from 'nestjs-paginate';
import { Membership } from '../membership/entities/membership.entity';

const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(Membership)
    private membershipRepo: Repository<Membership>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {}
  async create(createRoleDto: CreateRoleDto): Promise<ApiResponse<RoleDto>> {
    const normalizedRoleCode = createRoleDto.role_code.trim().toUpperCase();
    if (this.isSuperAdminRoleCode(normalizedRoleCode)) {
      throw new BadRequestException('SUPER_ADMIN role cannot be created here');
    }

    // const existRoleName = await this.roleRepo.findOne({
    //   where: { role_name: createRoleDto.role_name.toUpperCase() },
    // });

    // if (existRoleName) {
    //   throw new BadRequestException('Role Name already exists');
    // }
    // const existRoleCode = await this.roleRepo.findOne({
    //   where: { role_code: createRoleDto.role_code.toUpperCase() },
    // });
    // if (existRoleCode) {
    //   throw new BadRequestException('Role Code already exists');
    // }

    const permissions = await this.permissionRepo.findBy({
      id: In(createRoleDto.permissionIds),
    });

    if (permissions.length !== createRoleDto.permissionIds.length) {
      throw new BadRequestException('Some permissions not found');
    }

    const role = this.roleRepo.create({
      role_name: createRoleDto.role_name,
      role_code: normalizedRoleCode,
      permissions,
      organization: { id: createRoleDto.orgId },
      colorKey: createRoleDto.colorKey,
    });

    const savedRole = await this.roleRepo.save(role);

    const roleDto: RoleDto = {
      id: savedRole.id,
      role_name: savedRole.role_name,
      role_code: savedRole.role_code,
      colorKey: savedRole.colorKey,
      org: {
        id: savedRole.organization.id,
        name: savedRole.organization.name,
      },
      permissions:
        savedRole.permissions?.map((p) => ({
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

  async findAll(
    query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<any>>> {
    console.time('GET_ROLES');
    try {
      const roleQuery = this.roleRepo
        .createQueryBuilder('role')
        .leftJoin('role.organization', 'organization')
        .select([
          'role.id',
          'role.role_name',
          'role.role_code',
          'role.colorKey',
          'organization.id',
          'organization.name',
        ])
        .where('role.deletedAt IS NULL')
        .andWhere('role.organizationId IS NOT NULL')
        .andWhere('role.role_code != :superAdminRoleCode', {
          superAdminRoleCode: SUPER_ADMIN_ROLE_CODE,
        });

      const result = await paginate(query, roleQuery, {
        sortableColumns: ['role_name', 'role_code', 'organization.name'],
        searchableColumns: ['role_name', 'role_code', 'organization.name'],
      });

      const items = result.data.map((r) => ({
        id: r.id,
        role_name: r.role_name,
        role_code: r.role_code,
        colorKey: r.colorKey,
        org: {
          id: r.organization.id,
          name: r.organization.name,
        },
      }));
      return Response(200, 'get all roles successfully', {
        items: items,
        page: result.meta.currentPage ?? 1,
        limit: result.meta.itemsPerPage,
        total: result.meta.totalItems ?? 0,
        totalPages: result.meta.totalPages ?? 1,
      });
    } finally {
      console.timeEnd('GET_ROLES');
    }
  }

  async findAllByOrg(orgId: string): Promise<ApiResponse<RoleOrgDto[]>> {
    console.time('GET_ROLES_BY_ORG');
    try {
      const exOrg = await this.orgRepo.findOne({ where: { id: orgId } });
      if (!exOrg) {
        throw new BadRequestException('orgId not found');
      }
      const roleOrg = await this.roleRepo.find({
        where: {
          organization: {
            id: orgId,
          },
          deletedAt: IsNull(),
        },
        relations: ['organization'],
      });
      const result: RoleOrgDto[] = roleOrg.map((r) => ({
        id: r.id,
        role_name: r.role_name,
      }));

      return Response(200, 'Get All Role Of Org Successfully', result);
    } finally {
      console.timeEnd('GET_ROLES_BY_ORG');
    }
  }

  async findAllByOrgSlug(
    slug: string,
    userId: string,
    query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<any>>> {
    console.time('GET_ROLES_BY_ORG_SLUG');
    try {
      const organization = await this.assertUserInOrganization(slug, userId);

      const result = await paginate(query, this.roleRepo, {
        sortableColumns: ['role_name', 'role_code', 'organization.name'],
        searchableColumns: ['role_name', 'role_code', 'organization.name'],
        where: {
          organization: { id: organization.id },
          deletedAt: IsNull(),
        },
        relations: ['organization'],
        defaultSortBy: [['createdAt', 'DESC']],
      });

      const items = result.data.map((r) => ({
        id: r.id,
        role_name: r.role_name,
        role_code: r.role_code,
        colorKey: r.colorKey,
        org: {
          id: r.organization.id,
          name: r.organization.name,
        },
      }));

      return Response(200, 'Get Roles Of Organization Successfully', {
        items,
        page: result.meta.currentPage ?? 1,
        limit: result.meta.itemsPerPage,
        total: result.meta.totalItems ?? 0,
        totalPages: result.meta.totalPages ?? 1,
      });
    } finally {
      console.timeEnd('GET_ROLES_BY_ORG_SLUG');
    }
  }

  private async assertUserInOrganization(
    slug: string,
    userId: string,
  ): Promise<Organization> {
    const organization = await this.orgRepo.findOne({ where: { slug } });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: userId },
        organization: { id: organization.id },
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    return organization;
  }

  async buildPermissionTree(permissions: any[]) {
    // Logger.warn("permissions", permissions)
    const map = new Map<string, any>();
    permissions.forEach((p) => {
      if (!p.parent?.id) {
        map.set(p.id, {
          id: p.id,
          permission_name: p.permission_name,
          permission_code: p.permission_code,
          children: [],
        });
      }
    });

    const tree: any[] = [];
    permissions.forEach((p) => {
      if (p.parent?.id) {
        map.get(p.parent?.id)?.children.push({
          id: p.id,
          permission_name: p.permission_name,
          permission_code: p.permission_code,
        });
      } else {
        tree.push(map.get(p.id));
      }
    });

    const parentIds = tree.map((tr) => tr.id);
    const childCountRows = parentIds.length
      ? await this.permissionRepo
          .createQueryBuilder('permission')
          .select('permission.parent_id', 'parentId')
          .addSelect('COUNT(permission.id)', 'total')
          .where('permission.parent_id IN (:...parentIds)', { parentIds })
          .groupBy('permission.parent_id')
          .getRawMany<{ parentId: string; total: string }>()
      : [];
    const childCountMap = new Map(
      childCountRows.map((row) => [row.parentId, Number(row.total)]),
    );

    for (const tr of tree) {
      const totalChildren = childCountMap.get(tr.id) ?? 0;
      tr.isAll = tr.children.length === totalChildren;
    }
    return tree.filter((tr) => tr.children && tr.children.length > 0);
  }

  async getRolePermissions(id: string): Promise<ApiResponse<any>> {
    console.time('GET_ROLE_PERMISSIONS');
    try {
      const role = await this.roleRepo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: ['permissions', 'permissions.parent'],
      });

      if (!role) {
        throw new NotFoundException('Role not found');
      }
      this.assertRoleIsEditable(role);

      return Response(200, 'get role permissions successfully', {
        permissions: await this.buildPermissionTree(role.permissions || []),
      });
    } finally {
      console.timeEnd('GET_ROLE_PERMISSIONS');
    }
  }

  async deleteSort(deleteSort: DeleteSort): Promise<ApiResponse<DeleteSort>> {
    const roles = await this.roleRepo.find({
      where: { id: In(deleteSort.ids) },
    });
    if (roles.length !== deleteSort.ids.length) {
      throw new BadRequestException('Invalid ids');
    }
    const hasSuperAdminRole = roles.some(
      (role) => this.isSuperAdminRole(role),
    );
    if (hasSuperAdminRole) {
      throw new BadRequestException('SUPER_ADMIN role cannot be deleted');
    }
    const names = roles.map((i) => i.role_name);
    await this.roleRepo.update(
      { id: In(deleteSort.ids) },
      { deletedAt: new Date() },
    );

    return Response(200, `Delete:${names.join(', ')} successfully`, deleteSort);
  }
  async GetRoleById(id: string): Promise<ApiResponse<RoleDto>> {
    console.time('GET_ROLE_BY_ID');
    try {
      const role = await this.roleRepo.findOne({
        where: { id },
        relations: ['organization', 'permissions', 'permissions.parent'],
      });
      if (!role) {
        throw new NotFoundException('Role not found');
      }
      this.assertRoleIsEditable(role);

      return Response(200, 'Get Role By Id Successfully', {
        id: role.id,
        role_name: role.role_name,
        role_code: role.role_code,
        permissions: await this.buildPermissionTree(role.permissions),
        colorKey: role.colorKey,
        org: {
          id: role.organization.id,
          name: role.organization.name,
        },
      });
    } finally {
      console.timeEnd('GET_ROLE_BY_ID');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} role`;
  }

  async update(
    id: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<ApiResponse<RoleResDto>> {
    const { permissionIds, orgId, ...roleData } = updateRoleDto;
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['permissions', 'organization'],
    });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found `);
    }
    this.assertRoleIsEditable(role);
    if (
      updateRoleDto.role_code &&
      this.isSuperAdminRoleCode(updateRoleDto.role_code)
    ) {
      throw new BadRequestException('Role code SUPER_ADMIN is reserved');
    }

    const [newPermissions, newOrg] = await Promise.all([
      permissionIds
        ? this.permissionRepo.findBy({ id: In(permissionIds) })
        : Promise.resolve(null),
      orgId
        ? this.orgRepo.findOne({ where: { id: orgId } })
        : Promise.resolve(null),
    ]);
    //  Gán dữ liệu mới
    Object.assign(role, roleData);
    // Gán quan hệ (Relations)
    if (newPermissions) {
      role.permissions = newPermissions;
    }
    if (newOrg) {
      role.organization = newOrg;
    }

    // 3. Lưu lại
    const savedRole = await this.roleRepo.save(role);
    const updatedRole = await this.roleRepo.findOne({
      where: { id: savedRole.id },
      relations: ['permissions', 'organization', 'permissions.parent'],
    });
    // 4. Trả về kết quả
    return Response(200, 'Update Role successfully', {
      id: updatedRole!.id,
      role_name: updatedRole!.role_name,
      role_code: updatedRole!.role_code,
      colorKey: updatedRole!.colorKey,
      permissions: await this.buildPermissionTree(
        updatedRole!.permissions || [],
      ),
      org: {
        id: updatedRole!.organization.id,
        name: updatedRole!.organization.name,
      },
    });
  }
  async remove(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    this.assertRoleIsEditable(role);
    return `This action removes a #${id} role`;
  }

  private isSuperAdminRole(role: Role): boolean {
    return this.isSuperAdminRoleCode(role.role_code);
  }

  private isSuperAdminRoleCode(roleCode?: string): boolean {
    return roleCode?.trim().toUpperCase() === SUPER_ADMIN_ROLE_CODE;
  }

  private assertRoleIsEditable(role: Role): void {
    if (this.isSuperAdminRole(role)) {
      throw new BadRequestException('SUPER_ADMIN role cannot be modified');
    }
  }
}
