import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';
import { ReportDto } from './dto/report.dto';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { User } from '../user/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { paginate, type PaginateQuery } from 'nestjs-paginate';
import { ReportStatus } from 'src/shared/enum/enum';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report) private reportRepo: Repository<Report>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
  ) {}
  async create(
    createReportDto: CreateReportDto,
  ): Promise<ApiResponse<ReportDto>> {
    const user = await this.userRepo.findOne({
      where: { id: createReportDto.userId },
    });
    const organization = await this.organizationRepo.findOne({
      where: { id: createReportDto.organizationId },
    });
    if (!user) {
      throw new BadRequestException('User does not exist');
    }
    if (!organization) {
      throw new BadRequestException('Organization does not exist');
    }
    const newReport = this.reportRepo.create({
      ...createReportDto,
      user: user,
      organization: organization,
    });

    // 3. Lưu vào Database
    const savedReport = await this.reportRepo.save(newReport);
    const reportResponse = this.toReportDto(savedReport);
    return Response(201, 'Report created successfully', reportResponse);
  }

  async findAll(
    query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<ReportDto>>> {
    const result = await paginate(query, this.reportRepo, {
      sortableColumns: ['user.fullName', 'organization.name', 'status'],
      searchableColumns: ['user.fullName', 'organization.name', 'status'],
      where: {
        status: Not(ReportStatus.SPAM),
      },
      relations: ['user', 'organization'],
      defaultSortBy: [['createdAt', 'DESC']],
    });

    const items = result.data.map((report) => this.toReportDto(report));

    return Response(200, 'Get all reports successfully', {
      items: items,
      page: result.meta.currentPage ?? 1,
      limit: result.meta.itemsPerPage,
      total: result.meta.totalItems ?? 0,
      totalPages: result.meta.totalPages ?? 1,
    });
  }

  async findAllByOrgSlug(
    slug: string,
    query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<ReportDto>>> {
    const organization = await this.organizationRepo.findOne({
      where: { slug },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const result = await paginate(query, this.reportRepo, {
      sortableColumns: ['user.fullName', 'organization.name', 'status'],
      searchableColumns: ['user.fullName', 'organization.name', 'status'],
      where: {
        status: Not(ReportStatus.SPAM),
        organization: { id: organization.id },
      },
      relations: ['user', 'organization'],
      defaultSortBy: [['createdAt', 'DESC']],
    });

    const items = result.data.map((report) => this.toReportDto(report));

    return Response(200, 'Get reports of organization successfully', {
      items,
      page: result.meta.currentPage ?? 1,
      limit: result.meta.itemsPerPage,
      total: result.meta.totalItems ?? 0,
      totalPages: result.meta.totalPages ?? 1,
    });
  }

  async findOne(id: string): Promise<ApiResponse<ReportDto>> {
    const report = await this.findReportById(id);

    return Response(200, 'Get report successfully', this.toReportDto(report));
  }

  async update(
    id: string,
    updateReportDto: UpdateReportDto,
  ): Promise<ApiResponse<ReportDto>> {
    const report = await this.findReportById(id);

    if (updateReportDto.status) {
      report.status = updateReportDto.status;
    }

    if (updateReportDto.organizationStatus) {
      report.organization.status = updateReportDto.organizationStatus;
      await this.organizationRepo.save(report.organization);
    }

    const savedReport = await this.reportRepo.save(report);

    return Response(
      200,
      'Update report review successfully',
      this.toReportDto(savedReport),
    );
  }

  remove(id: number) {
    return `This action removes a #${id} report`;
  }

  private async findReportById(id: string): Promise<Report> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: ['user', 'organization'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  private toReportDto(report: Report): ReportDto {
    return {
      id: report.id,
      user: {
        id: report.user?.id,
        fullName: report.user.fullName,
        email: report.user.email,
      },
      organization: {
        id: report.organization.id,
        name: report.organization.name,
      },
      reason: report.reason,
      status: report.status,
      createAt: report.createdAt,
    };
  }
}
