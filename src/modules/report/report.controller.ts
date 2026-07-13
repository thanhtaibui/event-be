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
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) { }

  @Post()
  @ApiOperation({ operationId: 'CreateReport' })
  create(
    @Body() createReportDto: CreateReportDto,
  ): Promise<ApiResponse<ReportDto>> {
    return this.reportService.create(createReportDto);
  }

  @Get()
  @ApiOperation({ operationId: 'GetReports' })
  async findAll(
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<ReportDto>>> {
    return await this.reportService.findAll(query);
  }

  @Get('org/:slug')
  @ApiOperation({ operationId: 'GetReportsByOrgSlug' })
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
  findOne(@Param('id') id: string) {
    return this.reportService.findOne(id);
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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReportDto: UpdateReportDto,
  ) {
    return this.reportService.update(id, updateReportDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reportService.remove(+id);
  }
}
