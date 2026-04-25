import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { SortDto } from '../../common/dtos/sort.dto';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';
import { ReportDto } from "./dto/report.dto";
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginateArray } from '../../common/utils/paginate-array';
import { Report } from "./entities/report.entity"
import { User } from "../user/entities/user.entity"
import { Organization } from '../organization/entities/organization.entity';
import { applySearch } from 'src/common/utils/applySort';

@Injectable()
export class ReportService {
  constructor(@InjectRepository(Report) private reportRepo: Repository<Report>, @InjectRepository(User) private userRepo: Repository<User>, @InjectRepository(Organization) private organizationRepo: Repository<Organization>) { }
  async create(createReportDto: CreateReportDto): Promise<ApiResponse<ReportDto>> {
    const user = await this.userRepo.findOne({ where: { id: createReportDto.userId } });
    const organization = await this.organizationRepo.findOne({ where: { id: createReportDto.organizationId } });
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
    const reportResponse: ReportDto = {
      reason: savedReport.reason,
      status: savedReport.status,
      user: {
        id: savedReport.user.id,
        fullName: savedReport.user.fullName,
        email: savedReport.user.email
      },
      organization: {
        id: savedReport.organization.id,
        name: savedReport.organization.name
      },
      createAt: savedReport.createdAt
    };
    return Response(
      201,
      'Report created successfully',
      reportResponse
    );
  }

  async findAll(query: SortDto): Promise<ApiResponse<PaginationResult<ReportDto>>> {
    const { search } = query
    const reports = await this.reportRepo.find({
      relations: ['user', 'organization'],
      order: { createdAt: 'desc' }
    })
    const searchData = applySearch(
      reports,
      search,
      ['user.fullName', 'organization.name', 'status']
    )
    const items = searchData.map(report => ({
      user: {
        id: report.user?.id,
        fullName: report.user.fullName,
        email: report.user.email
      },
      organization: {
        id: report.organization.id,
        name: report.organization.name
      },
      reason: report.reason,
      status: report.status,
      createAt: report.createdAt,
    }));

    return Response(
      200,
      'Get all reports successfully',
      paginateArray<ReportDto>(items, query),
    );
  }

  findOne(id: number) {
    return `This action returns a #${id} report`;
  }

  update(id: number, updateReportDto: UpdateReportDto) {
    return `This action updates a #${id} report`;
  }

  remove(id: number) {
    return `This action removes a #${id} report`;
  }
}
