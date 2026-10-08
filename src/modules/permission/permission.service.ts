import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { PermissionTreeDto } from './dto/permission.dto';
import { Permission } from './entities/permission.entity';
import {
  ROLE_PERMISSION_CODES,
  selectPermissionsForRole,
} from './permission-seed.service';

type PermissionTreeNode = PermissionTreeDto & {
  permission_code: string;
  children?: PermissionTreeNode[];
};

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission) private perRepo: Repository<Permission>,
  ) {}

  async findSuperAdminPermissions(): Promise<ApiResponse<PermissionTreeNode[]>> {
    const permissions = await this.findPermissionsForRole('SUPER_ADMIN');
    return {
      statusCode: 200,
      message: 'Get Super Admin Permissions Successfully',
      data: this.buildPermissionTree(permissions),
    };
  }

  async findOwnerPermissions(): Promise<ApiResponse<PermissionTreeNode[]>> {
    const permissions = await this.findPermissionsForRole('OWNER');
    return {
      statusCode: 200,
      message: 'Get Owner Permissions Successfully',
      data: this.buildPermissionTree(permissions),
    };
  }

  private async findPermissionsForRole(roleCode: 'SUPER_ADMIN' | 'OWNER') {
    const allPermissions = await this.perRepo.find({
      relations: ['parent'],
      order: {
        permission_code: 'ASC',
      },
    });

    return selectPermissionsForRole(
      roleCode,
      ROLE_PERMISSION_CODES[roleCode],
      allPermissions,
    );
  }

  private buildPermissionTree(permissions: Permission[]): PermissionTreeNode[] {
    const selectedIds = new Set(permissions.map((permission) => permission.id));
    const selectedByParentId = new Map<string, Permission[]>();

    for (const permission of permissions) {
      if (!permission.parent?.id) {
        continue;
      }

      if (!selectedByParentId.has(permission.parent.id)) {
        selectedByParentId.set(permission.parent.id, []);
      }

      selectedByParentId.get(permission.parent.id)!.push(permission);
    }

    return permissions
      .filter((permission) => !permission.parent?.id)
      .map((parent) => ({
        id: parent.id,
        permission_name: parent.permission_name,
        permission_code: parent.permission_code,
        children: (selectedByParentId.get(parent.id) || [])
          .filter((child) => selectedIds.has(child.id))
          .map((child) => ({
            id: child.id,
            permission_name: child.permission_name,
            permission_code: child.permission_code,
          })),
      }))
      .filter((parent) => parent.children.length > 0);
  }
}
