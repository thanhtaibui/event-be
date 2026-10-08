import { PermissionCode } from '../../common/constants/permission-codes';
import {
  CANONICAL_PERMISSION_CODES,
  PERMISSION_TREE,
  ROLE_PERMISSION_CODES,
  getMissingPermissionCodes,
  selectPermissionsForRole,
} from './permission-seed.service';

const makePermission = (permission_code: string) => ({ permission_code });

describe('permission normalization', () => {
  const configuredCodes = [...CANONICAL_PERMISSION_CODES];
  const legacyCodes = [
    'CREATE_USER',
    'UPDATE_USER',
    'DELETE_USER',
    'CREATE_ROLE',
    'UPDATE_ROLE',
    'CREATE_EVENT',
    'DELETE_EVENT',
    'VIEW_REPORT',
    'EXPORT_REPORT',
    'DOWNLOAD_REPORT',
    'PERMISSION',
    'PERMISSION_VIEW',
    'PERMISSION_CREATE',
    'PERMISSION_UPDATE',
    'PERMISSION_DELETE',
  ];
  const allPermissions = [...configuredCodes, ...legacyCodes].map(makePermission);

  it('keeps only canonical permission codes in the configured tree', () => {
    expect(CANONICAL_PERMISSION_CODES.has('PERMISSION')).toBe(false);
    expect(CANONICAL_PERMISSION_CODES.has('PERMISSION_VIEW')).toBe(false);
    expect(CANONICAL_PERMISSION_CODES.has('CREATE_USER')).toBe(false);
    expect(CANONICAL_PERMISSION_CODES.has(PermissionCode.PERMISSION_OWNER)).toBe(
      true,
    );
    expect(
      CANONICAL_PERMISSION_CODES.has(PermissionCode.PERMISSION_SUPER_ADMIN),
    ).toBe(true);
  });

  it('keeps permission resources to exactly two runtime access permissions', () => {
    const permissionAccessCodes = configuredCodes.filter((permissionCode) =>
      permissionCode.startsWith('PERMISSION_'),
    );

    expect(permissionAccessCodes.sort()).toEqual([
      PermissionCode.PERMISSION_OWNER,
      PermissionCode.PERMISSION_SUPER_ADMIN,
    ]);
  });

  it('assigns canonical permissions, not legacy database rows, to SUPER_ADMIN', () => {
    const selected = selectPermissionsForRole(
      'SUPER_ADMIN',
      ROLE_PERMISSION_CODES.SUPER_ADMIN,
      allPermissions,
    );
    const selectedCodes = selected.map((permission) => permission.permission_code);

    expect(selectedCodes).toHaveLength(ROLE_PERMISSION_CODES.SUPER_ADMIN.length);
    expect(selectedCodes).toEqual(
      expect.arrayContaining([
        PermissionCode.PERMISSION_SUPER_ADMIN,
        PermissionCode.PERMISSION_OWNER,
      ]),
    );
    expect(selectedCodes).not.toEqual(expect.arrayContaining(legacyCodes));
  });

  it('assigns OWNER canonical permissions without PERMISSION_SUPER_ADMIN', () => {
    const selected = selectPermissionsForRole(
      'OWNER',
      ROLE_PERMISSION_CODES.OWNER,
      allPermissions,
    );
    const selectedCodes = selected.map((permission) => permission.permission_code);

    expect(selectedCodes).toEqual(
      expect.arrayContaining([PermissionCode.PERMISSION_OWNER]),
    );
    expect(selectedCodes).not.toEqual(
      expect.arrayContaining([PermissionCode.PERMISSION_SUPER_ADMIN]),
    );
    expect(selectedCodes).not.toEqual(expect.arrayContaining(legacyCodes));
  });

  it('reports missing canonical permission codes for diagnostics', () => {
    const assignedPermissions = configuredCodes
      .filter(
        (permissionCode) =>
          permissionCode !== PermissionCode.PERMISSION_SUPER_ADMIN,
      )
      .map(makePermission);

    expect(
      getMissingPermissionCodes(
        configuredCodes.map(makePermission),
        assignedPermissions,
      ),
    ).toEqual([PermissionCode.PERMISSION_SUPER_ADMIN]);
  });

  it('keeps tree codes aligned with role mappings', () => {
    const treeCodes = PERMISSION_TREE.flatMap((parent) => [
      parent.code,
      ...parent.children.map((child) => child.code),
    ]);

    expect(new Set(treeCodes)).toEqual(CANONICAL_PERMISSION_CODES);
    expect(ROLE_PERMISSION_CODES.SUPER_ADMIN).toEqual(treeCodes);
  });
});
