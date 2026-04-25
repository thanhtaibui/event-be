import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { DashboardDto } from './dto/dashboard.dto';


@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get()
  findAll(): Promise<ApiResponse<DashboardDto>> {
    return this.dashboardService.GetAllDashboard();
  }
  @Get(':id')
  getDashboardById(@Param('id') id: string): Promise<ApiResponse<DashboardDto>> {
    return this.dashboardService.GetAllDashboard();
  }
}
