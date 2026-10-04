import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { DashboardDto } from './dto/dashboard.dto';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  private assertSuperAdmin(req: any) {
    if (!req.user?.role?.isSuperAdmin) {
      throw new ForbiddenException();
    }
  }

  @Get()
  @Permissions(PermissionCode.DASHBOARD_VIEW)
  findAll(@Req() req: any): Promise<ApiResponse<DashboardDto>> {
    return this.dashboardService.GetAllDashboard();
  }

  @Get('org/:slug')
  @Permissions(PermissionCode.DASHBOARD_VIEW)
  getDashboardByOrgSlug(
    @Param('slug') slug: string,
    @Req() req: any,
  ): Promise<ApiResponse<DashboardDto>> {
    return this.dashboardService.GetDashboardByOrgSlug(slug, req.user.userId);
  }

  @Get(':id')
  @Permissions(PermissionCode.DASHBOARD_VIEW)
  getDashboardById(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<ApiResponse<DashboardDto>> {
    if (!req.user?.role?.isSuperAdmin && req.user?.userId !== id) {
      throw new ForbiddenException();
    }
    return this.dashboardService.GetDashboardById(id);
  }
}
