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

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  private assertSuperAdmin(req: any) {
    if (!req.user?.role?.isSuperAdmin) {
      throw new ForbiddenException();
    }
  }

  @Get()
  findAll(@Req() req: any): Promise<ApiResponse<DashboardDto>> {
    this.assertSuperAdmin(req);
    return this.dashboardService.GetAllDashboard();
  }

  @Get('org/:slug')
  getDashboardByOrgSlug(
    @Param('slug') slug: string,
    @Req() req: any,
  ): Promise<ApiResponse<DashboardDto>> {
    return this.dashboardService.GetDashboardByOrgSlug(slug, req.user.userId);
  }

  @Get(':id')
  getDashboardById(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<ApiResponse<DashboardDto>> {
    this.assertSuperAdmin(req);
    return this.dashboardService.GetAllDashboard();
  }
}
