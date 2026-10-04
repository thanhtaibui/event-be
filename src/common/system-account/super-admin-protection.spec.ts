import { ForbiddenException } from '@nestjs/common';
import {
  assertNotSuperAdminSystemMembership,
  assertNotSuperAdminSystemRole,
  assertNotSuperAdminSystemUser,
  hasSuperAdminMembership,
  isSuperAdminRoleCode,
} from './super-admin-protection';

describe('super admin system account protection', () => {
  const superAdminUser = {
    memberships: [{ role: { role_code: 'SUPER_ADMIN' } }],
  };

  const normalUser = {
    memberships: [{ role: { role_code: 'ADMIN' } }],
  };

  it('identifies SUPER_ADMIN by role code', () => {
    expect(isSuperAdminRoleCode('SUPER_ADMIN')).toBe(true);
    expect(isSuperAdminRoleCode(' super_admin ')).toBe(true);
    expect(isSuperAdminRoleCode('ADMIN')).toBe(false);
  });

  it('detects a user with SUPER_ADMIN membership', () => {
    expect(hasSuperAdminMembership(superAdminUser)).toBe(true);
    expect(hasSuperAdminMembership(normalUser)).toBe(false);
  });

  it('blocks normal admin update of SUPER_ADMIN target user', () => {
    expect(() =>
      assertNotSuperAdminSystemUser(
        superAdminUser,
        'SUPER_ADMIN system account cannot be updated.',
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks deleting SUPER_ADMIN, including self delete via CRUD', () => {
    expect(() =>
      assertNotSuperAdminSystemUser(
        superAdminUser,
        'SUPER_ADMIN system account cannot be deleted.',
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks downgrading/removing SUPER_ADMIN membership', () => {
    expect(() =>
      assertNotSuperAdminSystemMembership(
        { role: { role_code: 'SUPER_ADMIN' } },
        'SUPER_ADMIN system membership cannot be modified.',
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks modifying the SUPER_ADMIN system role', () => {
    expect(() =>
      assertNotSuperAdminSystemRole(
        { role_code: 'SUPER_ADMIN' },
        'SUPER_ADMIN system role cannot be modified.',
      ),
    ).toThrow(ForbiddenException);
  });
});
