import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ReportDto } from './dto/report.dto';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { Query } from '@nestjs/common';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { Paginate } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) { }

  private assertSuperAdmin(req: any) {
    if (!req.user?.role?.isSuperAdmin) {
      throw new ForbiddenException();
    }
  }

  @Post()
  @ApiOperation({ operationId: 'CreateReport' })
  @Permissions(PermissionCode.REPORT_CREATE)
  create(
    @Body() createReportDto: CreateReportDto,
  ): Promise<ApiResponse<ReportDto>> {
    return this.reportService.create(createReportDto);
  }

  @Get()
  @ApiOperation({ operationId: 'GetReports' })
  @Permissions(PermissionCode.REPORT_VIEW)
  async findAll(
    @Req() req: any,
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<ReportDto>>> {
    return await this.reportService.findAll(query, req.user);
  }

  @Get('org/:slug')
  @ApiOperation({ operationId: 'GetReportsByOrgSlug' })
  @Permissions(PermissionCode.REPORT_VIEW)
  async findAllByOrgSlug(
    @Param('slug') slug: string,
    @Req() req: any,
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<ReportDto>>> {
    return await this.reportService.findAllByOrgSlug(
      slug,
      req.user.userId,
      query,
    );
  }

  @Get(':id')
  @Permissions(PermissionCode.REPORT_VIEW)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.reportService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'ReviewReport' })
  @ApiBody({
    type: UpdateReportDto,
    examples: {
      keepOrg: {
        value: {
          status: 'resolved',
        },
      },
      suspendOrg: {
        value: {
          status: 'resolved',
          organizationStatus: 'SUSPENDED',
        },
      },
    },
  })
  @Permissions(PermissionCode.REPORT_UPDATE)
  update(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReportDto: UpdateReportDto,
  ) {
    return this.reportService.update(id, updateReportDto, req.user);
  }

  @Delete(':id')
  @Permissions(PermissionCode.REPORT_DELETE)
  remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.reportService.remove(id, req.user);
  }
}
