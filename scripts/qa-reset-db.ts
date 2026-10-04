import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import {
  DataSource,
  DataSourceOptions,
  EntityTarget,
  In,
  IsNull,
  Repository,
} from 'typeorm';
import { databaseConfig } from '../src/configs/database.config';
import { Permission } from '../src/modules/permission/entities/permission.entity';
import { Role } from '../src/modules/role/entities/role.entity';
import { User } from '../src/modules/user/entities/user.entity';
import { Organization } from '../src/modules/organization/entities/organization.entity';
import { Membership } from '../src/modules/membership/entities/membership.entity';
import { Event } from '../src/modules/event/entities/event.entity';
import { TicketType } from '../src/modules/ticket-type/entities/ticket-type.entity';
import { Ticket } from '../src/modules/ticket/entities/ticket.entity';
import { Order } from '../src/modules/order/entities/order.entity';
import { Invite } from '../src/modules/invite/entities/invite.entity';
import { Report } from '../src/modules/report/entities/report.entity';
import { OrgVerification } from '../src/modules/org-verification/entities/org-verification.entity';
import { Notification } from '../src/modules/notification/entities/notification.entity';
import { Feedback } from '../src/modules/feedback/entities/feedback.entity';
import { Item } from '../src/modules/item/entities/item.entity';
import { TicketTypeItem } from '../src/modules/ticket-type-item/entities/ticket-type-item.entity';
import { Category } from '../src/modules/category/entities/category.entity';
import {
  PERMISSION_TREE,
  ROLE_PERMISSION_CODES,
} from '../src/modules/permission/permission-seed.service';

type CountMap = Record<string, number>;

const SUPER_ADMIN_EMAIL = 'buitaia9@gmail.com';
const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

const BUSINESS_ENTITIES: EntityTarget<any>[] = [
  Notification,
  Feedback,
  Report,
  Invite,
  Ticket,
  Order,
  TicketTypeItem,
  Item,
  TicketType,
  Event,
  OrgVerification,
  Membership,
  Category,
];

const ALL_COUNT_ENTITIES: EntityTarget<any>[] = [
  Notification,
  Feedback,
  Report,
  Invite,
  Ticket,
  Order,
  TicketTypeItem,
  Item,
  TicketType,
  Event,
  OrgVerification,
  Membership,
  Organization,
  User,
  Role,
  Permission,
  Category,
];

function loadLocalEnv(): void {
  const loader = process.loadEnvFile;
  if (typeof loader === 'function') {
    try {
      loader('.env');
    } catch {
      // Render injects env vars directly; local .env is optional for this script.
    }
  }
}

function getDatabaseIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.replace(/^\//, ''),
      environment: process.env.NODE_ENV || 'unknown',
    };
  }

  return {
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: process.env.DB_PORT || process.env.POSTGRES_PORT || '5432',
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'unknown',
    environment: process.env.NODE_ENV || 'unknown',
  };
}

function assertResetAllowed(): void {
  if (process.env.ALLOW_QA_DB_RESET !== 'true') {
    throw new Error('ALLOW_QA_DB_RESET must be true to run QA database reset');
  }

  if (!process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD is required to bootstrap super admin',
    );
  }
}

async function countEntities(
  dataSource: DataSource,
  entities: EntityTarget<any>[],
): Promise<CountMap> {
  const counts: CountMap = {};

  for (const entity of entities) {
    const metadata = dataSource.getMetadata(entity);
    counts[metadata.tableName] = await dataSource.getRepository(entity).count();
  }

  counts.role_permissions = await safeCountTable(dataSource, 'role_permissions');
  counts.event_categories = await safeCountTable(dataSource, 'event_categories');

  return counts;
}

async function safeCountTable(
  dataSource: DataSource,
  tableName: string,
): Promise<number> {
  const exists = await dataSource.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName],
  );

  if (!exists[0]?.exists) {
    return 0;
  }

  const rows = await dataSource.query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
  return Number(rows[0]?.count ?? 0);
}

function writeAuditSnapshot(
  phase: 'before' | 'after',
  identity: ReturnType<typeof getDatabaseIdentity>,
  counts: CountMap,
): void {
  if (process.env.QA_RESET_WRITE_AUDIT !== 'true') {
    return;
  }

  const dir = process.env.QA_RESET_AUDIT_DIR || 'qa-db-audit';
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${phase}-${Date.now()}.json`),
    JSON.stringify(
      {
        phase,
        identity,
        counts,
      },
      null,
      2,
    ),
  );
}

async function resetBusinessData(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager.query('DELETE FROM "role_permissions"');
    await manager.query('DELETE FROM "event_categories"');

    for (const entity of BUSINESS_ENTITIES) {
      await manager.getRepository(entity).createQueryBuilder().delete().execute();
    }

    await manager.getRepository(Role).delete({});
    await manager.getRepository(Organization).delete({});
    await manager.getRepository(User).delete({});
  });
}

async function ensureSystemRoles(
  roleRepo: Repository<Role>,
  permissionRepo: Repository<Permission>,
): Promise<void> {
  const permissions = await permissionRepo.find();
  const permissionByCode = new Map(
    permissions.map((permission) => [permission.permission_code, permission]),
  );

  for (const [roleCode, permissionCodes] of Object.entries(
    ROLE_PERMISSION_CODES,
  )) {
    const role = new Role();
    role.role_code = roleCode;
    role.role_name = toRoleName(roleCode);
    role.colorKey = roleCode === SUPER_ADMIN_ROLE_CODE ? 'red' : 'blue';
    role.organization = null as any;
    role.permissions = permissionCodes
      .map((code) => permissionByCode.get(code))
      .filter((permission): permission is Permission => Boolean(permission));

    await roleRepo.save(role);
  }
}

async function ensureBootstrapAdmin(
  userRepo: Repository<User>,
  membershipRepo: Repository<Membership>,
  roleRepo: Repository<Role>,
): Promise<void> {
  const superAdminRole = await roleRepo.findOne({
    where: {
      role_code: SUPER_ADMIN_ROLE_CODE,
      organization: IsNull(),
      deletedAt: IsNull(),
    },
  });

  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role was not created');
  }

  let user = await userRepo.findOne({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  const password = await bcrypt.hash(
    process.env.BOOTSTRAP_ADMIN_PASSWORD as string,
    10,
  );

  if (!user) {
    user = new User();
    user.email = SUPER_ADMIN_EMAIL;
    user.password = password;
    user.fullName = 'Bùi Thành Tài';
    user.phoneNumber = null as any;
    user.isActive = true;
    user.isDelete = false;
    user.refreshToken = null as any;
  } else {
    user.password = password;
    user.fullName = user.fullName || 'Bùi Thành Tài';
    user.isActive = true;
    user.isDelete = false;
    user.refreshToken = null as any;
  }

  const savedUser = await userRepo.save(user);

  const membership = new Membership();
  membership.user = savedUser;
  membership.organization = null as any;
  membership.role = superAdminRole;
  membership.isActive = true;

  await membershipRepo.save(membership);
}

async function verifyPermissionTree(permissionRepo: Repository<Permission>) {
  const permissions = await permissionRepo.find({ relations: ['parent'] });
  const parents = permissions.filter((permission) => !permission.parent);
  const children = permissions.filter((permission) => permission.parent);
  const duplicates = await permissionRepo
    .createQueryBuilder('permission')
    .select('permission.permission_code', 'code')
    .addSelect('COUNT(permission.id)', 'total')
    .groupBy('permission.permission_code')
    .having('COUNT(permission.id) > 1')
    .getRawMany();

  const expectedParents = new Set(PERMISSION_TREE.map((parent) => parent.code));
  const missingParents = [...expectedParents].filter(
    (code) =>
      !parents.some((permission) => permission.permission_code === code),
  );

  const missingChildren = PERMISSION_TREE.flatMap((parent) =>
    parent.children
      .filter(
        (child) =>
          !children.some(
            (permission) =>
              permission.permission_code === child.code &&
              permission.parent?.permission_code === parent.code,
          ),
      )
      .map((child) => `${parent.code}.${child.code}`),
  );

  return {
    parents: parents.length,
    children: children.length,
    total: permissions.length,
    duplicates: duplicates.length,
    missingParents,
    missingChildren,
  };
}

async function verifySuperAdmin(
  roleRepo: Repository<Role>,
  permissionRepo: Repository<Permission>,
) {
  const permissionCount = await permissionRepo.count();
  const role = await roleRepo.findOne({
    where: {
      role_code: SUPER_ADMIN_ROLE_CODE,
      organization: IsNull(),
      deletedAt: IsNull(),
    },
    relations: ['permissions'],
  });

  return {
    exists: Boolean(role),
    permissionCount: role?.permissions?.length ?? 0,
    expectedPermissionCount: permissionCount,
  };
}

function toRoleName(roleCode: string): string {
  return roleCode
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

async function main() {
  loadLocalEnv();
  assertResetAllowed();

  const identity = getDatabaseIdentity();
  console.log('QA DB RESET TARGET');
  console.log(`host=${identity.host}`);
  console.log(`port=${identity.port}`);
  console.log(`database=${identity.database}`);
  console.log(`environment=${identity.environment}`);
  console.log('password=REDACTED');
  console.log('');
  console.log('PRESERVE: permissions');
  console.log('RESET: business data, roles, role_permissions');
  console.log('RECREATE: system roles, role_permissions, bootstrap admin');

  const dataSource = new DataSource(databaseConfig() as DataSourceOptions);
  await dataSource.initialize();

  try {
    const beforeCounts = await countEntities(dataSource, ALL_COUNT_ENTITIES);
    writeAuditSnapshot('before', identity, beforeCounts);
    console.log('BEFORE_RESET_COUNTS');
    console.table(beforeCounts);

    if (process.env.QA_RESET_DRY_RUN === 'true') {
      console.log('QA_RESET_DRY_RUN=true, no data was deleted');
      return;
    }

    await resetBusinessData(dataSource);

    const permissionRepo = dataSource.getRepository(Permission);
    const roleRepo = dataSource.getRepository(Role);
    const userRepo = dataSource.getRepository(User);
    const membershipRepo = dataSource.getRepository(Membership);

    await ensureSystemRoles(roleRepo, permissionRepo);
    await ensureBootstrapAdmin(userRepo, membershipRepo, roleRepo);

    const afterCounts = await countEntities(dataSource, ALL_COUNT_ENTITIES);
    writeAuditSnapshot('after', identity, afterCounts);
    const tree = await verifyPermissionTree(permissionRepo);
    const superAdmin = await verifySuperAdmin(roleRepo, permissionRepo);

    console.log('AFTER_RESET_COUNTS');
    console.table(afterCounts);
    console.log('PERMISSION_TREE');
    console.table(tree);
    console.log('SUPER_ADMIN');
    console.table(superAdmin);

    if (tree.missingParents.length || tree.missingChildren.length) {
      throw new Error('Permission tree verification failed');
    }
    if (!superAdmin.exists) {
      throw new Error('SUPER_ADMIN role verification failed');
    }
    if (superAdmin.permissionCount !== superAdmin.expectedPermissionCount) {
      throw new Error('SUPER_ADMIN does not have all permissions');
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
