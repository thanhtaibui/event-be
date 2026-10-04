import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionCodeValue } from '../constants/permission-codes';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<PermissionCodeValue[]>(
        PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) || [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const rolePayload = request.user?.role;

    if (rolePayload?.isSuperAdmin) {
      return true;
    }

    const userPermissions = new Set<string>(rolePayload?.permissions || []);
    if (userPermissions.has('*')) {
      return true;
    }

    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.has(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permission');
    }

    return true;
  }
}

