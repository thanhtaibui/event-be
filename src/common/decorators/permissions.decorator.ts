import { SetMetadata } from '@nestjs/common';
import { PermissionCodeValue } from '../constants/permission-codes';

export const PERMISSIONS_KEY = 'permissions';

export const Permissions = (...permissions: PermissionCodeValue[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

