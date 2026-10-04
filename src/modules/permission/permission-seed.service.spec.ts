import {
  PERMISSION_TREE,
  ROLE_PERMISSION_CODES,
  getMissingPermissionCodes,
  selectPermissionsForRole,
} from './permission-seed.service';

const makePermission = (permission_code: string) => ({ permission_code });

describe('role permission selection', () => {
  const configuredCodes = ROLE_PERMISSION_CODES.SUPER_ADMIN;
  const extraCodes = Array.from({ length: 10 }, (_, index) => {
    return `LEGACY_PERMISSION_${index + 1}`;
  });
  const allPermissions = [...configuredCodes, ...extraCodes].map(makePermission);

  it('keeps the configured permission tree at 56 permissions', () => {
    const parentCount = PERMISSION_TREE.length;
    const childCount = PERMISSION_TREE.reduce((total, parent) => {
      return total + parent.children.length;
    }, 0);

    expect(parentCount).toBe(12);
    expect(childCount).toBe(44);
    expect(configuredCodes).toHaveLength(56);
  });

  it('assigns every database permission to SUPER_ADMIN', () => {
    const selected = selectPermissionsForRole(
      'SUPER_ADMIN',
      configuredCodes,
      allPermissions,
    );

    expect(selected).toHaveLength(66);
    expect(selected.map((permission) => permission.permission_code)).toEqual(
      allPermissions.map((permission) => permission.permission_code),
    );
  });

  it('keeps other roles limited to ROLE_PERMISSION_CODES mapping', () => {
    const selected = selectPermissionsForRole(
      'OWNER',
      ROLE_PERMISSION_CODES.OWNER,
      allPermissions,
    );
    const selectedCodes = selected.map((permission) => permission.permission_code);

    expect(selectedCodes).toEqual(
      expect.arrayContaining(ROLE_PERMISSION_CODES.OWNER),
    );
    expect(selectedCodes).not.toEqual(expect.arrayContaining(extraCodes));
  });

  it('reports missing permission codes for diagnostics', () => {
    const assignedPermissions = allPermissions.slice(0, 56);

    expect(getMissingPermissionCodes(allPermissions, assignedPermissions)).toEqual(
      [...extraCodes].sort(),
    );
  });
});
