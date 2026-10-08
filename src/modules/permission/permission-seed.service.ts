import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PermissionCode } from '../../common/constants/permission-codes';
import { Permission } from './entities/permission.entity';
import { Role } from '../role/entities/role.entity';

type PermissionChildDefinition = {
  code: string;
  name: string;
};

type PermissionParentDefinition = {
  code: string;
  name: string;
  children: PermissionChildDefinition[];
};

export const PERMISSION_TREE: PermissionParentDefinition[] = [
  {
    code: 'USER',
    name: 'User',
    children: [
      { code: PermissionCode.USER_VIEW, name: 'View User' },
      { code: PermissionCode.USER_CREATE, name: 'Create User' },
      { code: PermissionCode.USER_UPDATE, name: 'Update User' },
      { code: PermissionCode.USER_DELETE, name: 'Delete User' },
    ],
  },
  {
    code: 'ORGANIZATION',
    name: 'Organization',
    children: [
      { code: PermissionCode.ORGANIZATION_VIEW, name: 'View Organization' },
      { code: PermissionCode.ORGANIZATION_CREATE, name: 'Create Organization' },
      { code: PermissionCode.ORGANIZATION_UPDATE, name: 'Update Organization' },
      { code: PermissionCode.ORGANIZATION_DELETE, name: 'Delete Organization' },
      { code: PermissionCode.ORGANIZATION_VERIFY, name: 'Verify Organization' },
      {
        code: PermissionCode.ORGANIZATION_MEMBER_MANAGE,
        name: 'Manage Organization Members',
      },
    ],
  },
  {
    code: 'EVENT',
    name: 'Event',
    children: [
      { code: PermissionCode.EVENT_VIEW, name: 'View Event' },
      { code: PermissionCode.EVENT_CREATE, name: 'Create Event' },
      { code: PermissionCode.EVENT_UPDATE, name: 'Update Event' },
      { code: PermissionCode.EVENT_DELETE, name: 'Delete Event' },
      { code: PermissionCode.EVENT_MANAGE, name: 'Manage Event' },
    ],
  },
  {
    code: 'TICKET',
    name: 'Ticket',
    children: [
      { code: PermissionCode.TICKET_VIEW, name: 'View Ticket' },
      { code: PermissionCode.TICKET_CREATE, name: 'Create Ticket' },
      { code: PermissionCode.TICKET_UPDATE, name: 'Update Ticket' },
      { code: PermissionCode.TICKET_MANAGE, name: 'Manage Ticket' },
    ],
  },
  {
    code: 'ROLE',
    name: 'Role',
    children: [
      { code: PermissionCode.ROLE_VIEW, name: 'View Role' },
      { code: PermissionCode.ROLE_CREATE, name: 'Create Role' },
      { code: PermissionCode.ROLE_UPDATE, name: 'Update Role' },
      { code: PermissionCode.ROLE_DELETE, name: 'Delete Role' },
    ],
  },
  {
    code: 'REPORT',
    name: 'Report',
    children: [
      { code: PermissionCode.REPORT_VIEW, name: 'View Report' },
      { code: PermissionCode.REPORT_CREATE, name: 'Create Report' },
      { code: PermissionCode.REPORT_UPDATE, name: 'Update Report' },
      { code: PermissionCode.REPORT_DELETE, name: 'Delete Report' },
    ],
  },
  {
    code: 'VERIFICATION',
    name: 'Verification',
    children: [
      { code: PermissionCode.VERIFICATION_VIEW, name: 'View Verification' },
      {
        code: PermissionCode.VERIFICATION_APPROVE,
        name: 'Approve Verification',
      },
      {
        code: PermissionCode.VERIFICATION_REJECT,
        name: 'Reject Verification',
      },
    ],
  },
  {
    code: 'INVITATION',
    name: 'Invitation',
    children: [
      { code: PermissionCode.INVITATION_VIEW, name: 'View Invitation' },
      { code: PermissionCode.INVITATION_CREATE, name: 'Create Invitation' },
      { code: PermissionCode.INVITATION_UPDATE, name: 'Update Invitation' },
      { code: PermissionCode.INVITATION_DELETE, name: 'Delete Invitation' },
    ],
  },
  {
    code: 'DASHBOARD',
    name: 'Dashboard',
    children: [
      { code: PermissionCode.DASHBOARD_VIEW, name: 'View Dashboard' },
    ],
  },
  {
    code: 'UPLOAD',
    name: 'Upload',
    children: [{ code: PermissionCode.UPLOAD_CREATE, name: 'Create Upload' }],
  },
  {
    code: 'SYSTEM',
    name: 'System',
    children: [
      {
        code: PermissionCode.PERMISSION_SUPER_ADMIN,
        name: 'View Super Admin Permissions',
      },
      { code: PermissionCode.PERMISSION_OWNER, name: 'View Owner Permissions' },
    ],
  },
  {
    code: 'CATEGORY',
    name: 'Category',
    children: [
      { code: PermissionCode.CATEGORY_VIEW, name: 'View Category' },
      { code: PermissionCode.CATEGORY_CREATE, name: 'Create Category' },
      { code: PermissionCode.CATEGORY_UPDATE, name: 'Update Category' },
      { code: PermissionCode.CATEGORY_DELETE, name: 'Delete Category' },
    ],
  },
];

export const ROLE_PERMISSION_CODES: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSION_TREE.flatMap((parent) => [
    parent.code,
    ...parent.children.map((child) => child.code),
  ]),
  OWNER: [
    'ORGANIZATION',
    PermissionCode.ORGANIZATION_VIEW,
    PermissionCode.ORGANIZATION_UPDATE,
    PermissionCode.ORGANIZATION_VERIFY,
    PermissionCode.ORGANIZATION_MEMBER_MANAGE,
    'EVENT',
    PermissionCode.EVENT_VIEW,
    PermissionCode.EVENT_CREATE,
    PermissionCode.EVENT_UPDATE,
    PermissionCode.EVENT_DELETE,
    PermissionCode.EVENT_MANAGE,
    'TICKET',
    PermissionCode.TICKET_VIEW,
    PermissionCode.TICKET_CREATE,
    PermissionCode.TICKET_UPDATE,
    PermissionCode.TICKET_MANAGE,
    'ROLE',
    PermissionCode.ROLE_VIEW,
    PermissionCode.ROLE_CREATE,
    PermissionCode.ROLE_UPDATE,
    PermissionCode.ROLE_DELETE,
    'REPORT',
    PermissionCode.REPORT_VIEW,
    PermissionCode.REPORT_CREATE,
    PermissionCode.REPORT_UPDATE,
    'INVITATION',
    PermissionCode.INVITATION_VIEW,
    PermissionCode.INVITATION_CREATE,
    PermissionCode.INVITATION_UPDATE,
    PermissionCode.INVITATION_DELETE,
    'DASHBOARD',
    PermissionCode.DASHBOARD_VIEW,
    'UPLOAD',
    PermissionCode.UPLOAD_CREATE,
    'SYSTEM',
    PermissionCode.PERMISSION_OWNER,
    'CATEGORY',
    PermissionCode.CATEGORY_VIEW,
    PermissionCode.CATEGORY_CREATE,
    PermissionCode.CATEGORY_UPDATE,
    PermissionCode.CATEGORY_DELETE,
  ],
  ADMIN: [
    PermissionCode.ORGANIZATION_VIEW,
    PermissionCode.ORGANIZATION_UPDATE,
    PermissionCode.ORGANIZATION_MEMBER_MANAGE,
    PermissionCode.EVENT_VIEW,
    PermissionCode.EVENT_CREATE,
    PermissionCode.EVENT_UPDATE,
    PermissionCode.EVENT_DELETE,
    PermissionCode.EVENT_MANAGE,
    PermissionCode.TICKET_VIEW,
    PermissionCode.TICKET_CREATE,
    PermissionCode.TICKET_UPDATE,
    PermissionCode.TICKET_MANAGE,
    PermissionCode.ROLE_VIEW,
    PermissionCode.ROLE_CREATE,
    PermissionCode.ROLE_UPDATE,
    PermissionCode.INVITATION_VIEW,
    PermissionCode.INVITATION_CREATE,
    PermissionCode.INVITATION_UPDATE,
    PermissionCode.INVITATION_DELETE,
    PermissionCode.DASHBOARD_VIEW,
    PermissionCode.UPLOAD_CREATE,
    PermissionCode.CATEGORY_VIEW,
    PermissionCode.CATEGORY_CREATE,
    PermissionCode.CATEGORY_UPDATE,
  ],
  ORGANIZER: [
    PermissionCode.ORGANIZATION_VIEW,
    PermissionCode.EVENT_VIEW,
    PermissionCode.EVENT_CREATE,
    PermissionCode.EVENT_UPDATE,
    PermissionCode.EVENT_MANAGE,
    PermissionCode.TICKET_VIEW,
    PermissionCode.TICKET_CREATE,
    PermissionCode.TICKET_UPDATE,
    PermissionCode.TICKET_MANAGE,
    PermissionCode.INVITATION_VIEW,
    PermissionCode.INVITATION_CREATE,
    PermissionCode.INVITATION_UPDATE,
    PermissionCode.DASHBOARD_VIEW,
    PermissionCode.UPLOAD_CREATE,
    PermissionCode.CATEGORY_VIEW,
  ],
  MEMBER: [
    PermissionCode.ORGANIZATION_VIEW,
    PermissionCode.EVENT_VIEW,
    PermissionCode.TICKET_VIEW,
    PermissionCode.REPORT_CREATE,
    PermissionCode.CATEGORY_VIEW,
  ],
  USER: [
    PermissionCode.ORGANIZATION_VIEW,
    PermissionCode.ORGANIZATION_CREATE,
    PermissionCode.EVENT_VIEW,
    PermissionCode.TICKET_VIEW,
    PermissionCode.TICKET_CREATE,
    PermissionCode.REPORT_CREATE,
    PermissionCode.UPLOAD_CREATE,
    PermissionCode.CATEGORY_VIEW,
  ],
  GUEST: [
    PermissionCode.EVENT_VIEW,
    PermissionCode.TICKET_VIEW,
    PermissionCode.TICKET_CREATE,
    PermissionCode.REPORT_CREATE,
    PermissionCode.CATEGORY_VIEW,
  ],
};

const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

type PermissionLike = Pick<Permission, 'permission_code'>;

export function selectPermissionsForRole<T extends PermissionLike>(
  roleCode: string,
  permissionCodes: string[],
  allPermissions: T[],
): T[] {
  const permissionCodeSet = new Set(permissionCodes);
  return allPermissions.filter((permission) =>
    permissionCodeSet.has(permission.permission_code),
  );
}

export function getMissingPermissionCodes<T extends PermissionLike>(
  allPermissions: T[],
  assignedPermissions: T[],
): string[] {
  const assignedCodes = new Set(
    assignedPermissions.map((permission) => permission.permission_code),
  );

  return allPermissions
    .map((permission) => permission.permission_code)
    .filter((permissionCode) => !assignedCodes.has(permissionCode))
    .sort();
}

export const CANONICAL_PERMISSION_CODES = new Set(
  PERMISSION_TREE.flatMap((parent) => [
    parent.code,
    ...parent.children.map((child) => child.code),
  ]),
);

@Injectable()
export class PermissionSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionSeedService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedPermissionTree();
    await this.cleanObsoletePermissions();
    await this.seedRolePermissions();
  }

  private async seedPermissionTree(): Promise<void> {
    for (const parentDefinition of PERMISSION_TREE) {
      const parent = await this.ensurePermission({
        code: parentDefinition.code,
        name: parentDefinition.name,
        parent: null,
      });

      for (const childDefinition of parentDefinition.children) {
        await this.ensurePermission({
          code: childDefinition.code,
          name: childDefinition.name,
          parent,
        });
      }
    }
  }

  private async ensurePermission(input: {
    code: string;
    name: string;
    parent: Permission | null;
  }): Promise<Permission> {
    let permission = await this.permissionRepo.findOne({
      where: { permission_code: input.code },
      relations: ['parent'],
    });

    if (!permission) {
      permission = this.permissionRepo.create({
        permission_code: input.code,
        permission_name: input.name,
        parent: input.parent ?? undefined,
      });
      return this.permissionRepo.save(permission);
    }

    let changed = false;
    if (permission.permission_name !== input.name) {
      permission.permission_name = input.name;
      changed = true;
    }

    const expectedParentId = input.parent?.id ?? null;
    const currentParentId = permission.parent?.id ?? null;
    if (currentParentId !== expectedParentId) {
      permission.parent = input.parent ?? (null as unknown as Permission);
      changed = true;
    }

    return changed ? this.permissionRepo.save(permission) : permission;
  }

  private async seedRolePermissions(): Promise<void> {
    const allPermissions = await this.permissionRepo.find();
    await this.pruneObsoleteRolePermissions();

    for (const [roleCode, permissionCodes] of Object.entries(
      ROLE_PERMISSION_CODES,
    )) {
      const roles = await this.roleRepo.find({
        where: {
          role_code: roleCode,
          deletedAt: IsNull(),
        },
        relations: ['permissions'],
      });

      if (roles.length === 0) {
        continue;
      }

      const permissions = selectPermissionsForRole(
        roleCode,
        permissionCodes,
        allPermissions,
      );

      for (const role of roles) {
        const currentPermissionCodes = new Set(
          (role.permissions || []).map((permission) => permission.permission_code),
        );
        const nextPermissionCodes = new Set(
          permissions.map((permission) => permission.permission_code),
        );
        const changed =
          currentPermissionCodes.size !== nextPermissionCodes.size ||
          [...nextPermissionCodes].some(
            (permissionCode) => !currentPermissionCodes.has(permissionCode),
          );

        if (changed) {
          role.permissions = permissions;
          await this.roleRepo.save(role);
          this.logger.log(
            `Seeded ${permissions.length} permissions for role ${role.role_code}`,
          );
        }
      }
    }
  }

  private async pruneObsoleteRolePermissions(): Promise<void> {
    const roles = await this.roleRepo.find({ relations: ['permissions'] });

    for (const role of roles) {
      const canonicalPermissions = (role.permissions || []).filter(
        (permission) =>
          CANONICAL_PERMISSION_CODES.has(permission.permission_code),
      );

      if (canonicalPermissions.length !== (role.permissions || []).length) {
        role.permissions = canonicalPermissions;
        await this.roleRepo.save(role);
      }
    }
  }

  private async cleanObsoletePermissions(): Promise<void> {
    const permissions = await this.permissionRepo.find({ relations: ['parent'] });
    const obsoletePermissions = permissions
      .filter(
        (permission) =>
          !CANONICAL_PERMISSION_CODES.has(permission.permission_code),
      )
      .sort((left, right) => {
        if (left.parent && !right.parent) {
          return -1;
        }
        if (!left.parent && right.parent) {
          return 1;
        }
        return left.permission_code.localeCompare(right.permission_code);
      });

    if (!obsoletePermissions.length) {
      return;
    }

    await this.pruneObsoleteRolePermissions();
    await this.permissionRepo.remove(obsoletePermissions);
    this.logger.log(
      `Removed obsolete permissions: ${obsoletePermissions
        .map((permission) => permission.permission_code)
        .join(', ')}`,
    );
  }
}
