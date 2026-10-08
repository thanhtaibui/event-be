import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { PermissionTreeDto } from './dto/permission.dto';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('super-admin')
  @ApiOperation({ operationId: 'GetSuperAdminPermissions' })
  @Permissions(PermissionCode.PERMISSION_SUPER_ADMIN)
  findSuperAdminPermissions(): Promise<ApiResponse<PermissionTreeDto[]>> {
    return this.permissionService.findSuperAdminPermissions();
  }

  @Get('owner')
  @ApiOperation({ operationId: 'GetOwnerPermissions' })
  @Permissions(PermissionCode.PERMISSION_OWNER)
  findOwnerPermissions(): Promise<ApiResponse<PermissionTreeDto[]>> {
    return this.permissionService.findOwnerPermissions();
  }
}
