import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { PermissionCode } from 'src/common/constants/permission-codes';
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
    code: 'PERMISSION',
    name: 'Permission',
    children: [
      { code: PermissionCode.PERMISSION_VIEW, name: 'View Permission' },
      { code: PermissionCode.PERMISSION_CREATE, name: 'Create Permission' },
      { code: PermissionCode.PERMISSION_UPDATE, name: 'Update Permission' },
      { code: PermissionCode.PERMISSION_DELETE, name: 'Delete Permission' },
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

      const permissions = await this.permissionRepo.find({
        where: { permission_code: In([...new Set(permissionCodes)]) },
      });

      for (const role of roles) {
        const currentPermissionIds = new Set(
          (role.permissions || []).map((permission) => permission.id),
        );
        const mergedPermissions = [
          ...(role.permissions || []),
          ...permissions.filter(
            (permission) => !currentPermissionIds.has(permission.id),
          ),
        ];

        if (mergedPermissions.length !== (role.permissions || []).length) {
          role.permissions = mergedPermissions;
          await this.roleRepo.save(role);
          this.logger.log(
            `Seeded ${permissions.length} permissions for role ${role.role_code}`,
          );
        }
      }
    }
  }
}
