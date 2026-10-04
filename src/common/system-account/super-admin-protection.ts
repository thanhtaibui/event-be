import { ForbiddenException } from '@nestjs/common';

export const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

type RoleLike = {
  role_code?: string | null;
};

type MembershipLike = {
  role?: RoleLike | null;
};

type UserLike = {
  memberships?: MembershipLike[] | null;
};

export function isSuperAdminRoleCode(roleCode?: string | null): boolean {
  return roleCode?.trim().toUpperCase() === SUPER_ADMIN_ROLE_CODE;
}

export function isSuperAdminRole(role?: RoleLike | null): boolean {
  return isSuperAdminRoleCode(role?.role_code);
}

export function hasSuperAdminMembership(user?: UserLike | null): boolean {
  return Boolean(
    user?.memberships?.some((membership) => isSuperAdminRole(membership.role)),
  );
}

export function assertNotSuperAdminSystemUser(
  user: UserLike,
  message: string,
): void {
  if (hasSuperAdminMembership(user)) {
    throw new ForbiddenException(message);
  }
}

export function assertNotSuperAdminSystemMembership(
  membership: MembershipLike,
  message: string,
): void {
  if (isSuperAdminRole(membership.role)) {
    throw new ForbiddenException(message);
  }
}

export function assertNotSuperAdminSystemRole(
  role: RoleLike,
  message: string,
): void {
  if (isSuperAdminRole(role)) {
    throw new ForbiddenException(message);
  }
}
