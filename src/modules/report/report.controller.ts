import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger"
import { SortDto } from '../../common/dtos/sort.dto';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ReportDto } from "./dto/report.dto";
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { Query } from '@nestjs/common';
import { JwtGuard } from 'src/common/guards/jwt.guard';
// @ApiBearerAuth('access-token')
// @UseGuards(JwtGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) { }

  @Post()
  @ApiOperation({ operationId: 'CreateReport' })
  create(@Body() createReportDto: CreateReportDto): Promise<ApiResponse<ReportDto>> {
    return this.reportService.create(createReportDto);
  }

  @Get()
  @ApiOperation({ operationId: 'GetReports' })
  async findAll(@Query() query: SortDto): Promise<ApiResponse<PaginationResult<ReportDto>>> {
    return await this.reportService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateReportDto: UpdateReportDto) {
    return this.reportService.update(+id, updateReportDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reportService.remove(+id);
  }
}
