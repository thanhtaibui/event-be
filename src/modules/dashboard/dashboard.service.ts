import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { DashboardDto } from './dto/dashboard.dto';
import { EventStatus } from 'src/shared/enum/enum';
import { Event } from '../event/entities/event.entity';
import { Organization } from '../organization/entities/organization.entity';


@Injectable()
export class DashboardService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>, @InjectRepository(Event) private eventRepo: Repository<Event>, @InjectRepository(Organization) private OrganizationRepo: Repository<Organization>) { }
  async GetAllDashboard(): Promise<ApiResponse<DashboardDto>> {
    const totalOrganization = await this.OrganizationRepo.count({
      where: { isActive: true },
    });

    const totalEvents = await this.eventRepo.count();
    const [upcoming, ongoing, ended, cancelled] = await Promise.all([
      this.eventRepo.count({ where: { status: EventStatus.UPCOMING } }),
      this.eventRepo.count({ where: { status: EventStatus.ONGOING } }),
      this.eventRepo.count({ where: { status: EventStatus.ENDED } }),
      this.eventRepo.count({ where: { status: EventStatus.CANCELLED } }),
    ]);
    const dashboardData: DashboardDto = {
      cards: [
        { key: 'organizations', title: 'Organizations', value: totalOrganization },
        { key: 'events', title: 'Events', value: totalEvents },
        { key: 'revenue', title: 'Revenue', value: 1200 },
        { key: 'tickets', title: 'Tickets', value: 300 },
      ],
      lineChart: [],
      pieChart: [
        { label: 'Upcoming', value: upcoming },
        { label: 'Ongoing', value: ongoing },
        { label: 'Ended', value: ended },
        { label: 'Cancelled', value: cancelled },
      ],
    }
    return {
      statusCode: 200,
      message: 'Get dashboard successfully',
      data: dashboardData,
    }
  }
  async GetDashboardById(idUser: string): Promise<ApiResponse<DashboardDto>> {
    const totalUser = await this.userRepo.count({
      where: { isActive: true },
    });
    const totalEvents = await this.eventRepo.count();
    const [upcoming, ongoing, ended, cancelled] = await Promise.all([
      this.eventRepo.count({ where: { status: EventStatus.UPCOMING } }),
      this.eventRepo.count({ where: { status: EventStatus.ONGOING } }),
      this.eventRepo.count({ where: { status: EventStatus.ENDED } }),
      this.eventRepo.count({ where: { status: EventStatus.CANCELLED } }),
    ]);
    const dashboardData: DashboardDto = {
      cards: [
        { key: 'users', title: 'Users', value: totalUser },
        { key: 'events', title: 'Events', value: totalEvents },
        { key: 'revenue', title: 'Revenue', value: 1200 },
        { key: 'tickets', title: 'Tickets', value: 300 },
      ],
      lineChart: [],
      pieChart: [
        { label: 'Upcoming', value: upcoming },
        { label: 'Ongoing', value: ongoing },
        { label: 'Ended', value: ended },
        { label: 'Cancelled', value: cancelled },
      ],
    }
    return {
      statusCode: 200,
      message: 'Get dashboard by id successfully',
      data: dashboardData,
    }
  }
}
