import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { DashboardDto } from './dto/dashboard.dto';
import { EventStatus } from 'src/shared/enum/enum';
import { Event } from '../event/entities/event.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Ticket } from '../ticket/entities/ticket.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Event) private eventRepo: Repository<Event>,
    @InjectRepository(Organization)
    private OrganizationRepo: Repository<Organization>,
    @InjectRepository(Ticket) private ticketRepo: Repository<Ticket>,
  ) {}

  async GetAllDashboard(): Promise<ApiResponse<DashboardDto>> {
    const now = new Date();

    // Ngày 1 của tháng này — VD: 2024-05-01
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Ngày 1 của tháng trước — VD: 2024-04-01
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Ngày cuối của tháng trước — VD: 2024-04-30 23:59:59
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const OrgThisMonth = await this.OrganizationRepo.count({
      where: {
        isActive: true,
        createdAt: MoreThanOrEqual(startOfThisMonth),
      },
    });

    const OrgLastMonth = await this.OrganizationRepo.count({
      where: {
        isActive: true,
        createdAt: Between(startOfLastMonth, endOfLastMonth),
      },
    });

    const trendOrg =
      OrgLastMonth === 0
        ? 0
        : Number(
            (((OrgThisMonth - OrgLastMonth) / OrgLastMonth) * 100).toFixed(1),
          );

    const totalOrganization = await this.OrganizationRepo.count({
      where: { isActive: true },
    });
    const EventThisMonth = await this.eventRepo.count({
      where: { createdAt: MoreThanOrEqual(startOfThisMonth) },
    });
    const EventLastMonth = await this.eventRepo.count({
      where: { createdAt: Between(startOfLastMonth, endOfLastMonth) },
    });
    const trendEvent =
      EventLastMonth === 0
        ? 0
        : Number(
            (
              ((EventThisMonth - EventLastMonth) / EventLastMonth) *
              100
            ).toFixed(1),
          );

    // Ticket trend
    const TicketThisMonth = await this.ticketRepo.count({
      where: { createdAt: MoreThanOrEqual(startOfThisMonth) },
    });
    const TicketLastMonth = await this.ticketRepo.count({
      where: { createdAt: Between(startOfLastMonth, endOfLastMonth) },
    });

    const trendTicket =
      TicketLastMonth === 0
        ? 0
        : Number(
            (
              ((TicketThisMonth - TicketLastMonth) / TicketLastMonth) *
              100
            ).toFixed(1),
          );
    const totalTickets = await this.ticketRepo.count();
    // Revenue trend (tính theo giá vé * số vé bán)
    const revenueThisMonth = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .select('SUM(ticketType.price)', 'total')
      .where('ticket.createdAt >= :start', { start: startOfThisMonth })
      .getRawOne();

    const revenueLastMonth = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .select('SUM(ticketType.price)', 'total')
      .where('ticket.createdAt BETWEEN :start AND :end', {
        start: startOfLastMonth,
        end: endOfLastMonth,
      })
      .getRawOne();

    const thisRevenue = Number(revenueThisMonth?.total ?? 0);
    const lastRevenue = Number(revenueLastMonth?.total ?? 0);
    const trendRevenue =
      lastRevenue === 0
        ? 0
        : Number(
            (((thisRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1),
          );

    const totalRevenue = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .select('SUM(ticketType.price)', 'total')
      .getRawOne();

    const totalEvents = await this.eventRepo.count();
    const [upcoming, ongoing, ended, cancelled] = await Promise.all([
      this.eventRepo.count({ where: { status: EventStatus.UPCOMING } }),
      this.eventRepo.count({ where: { status: EventStatus.ONGOING } }),
      this.eventRepo.count({ where: { status: EventStatus.ENDED } }),
      this.eventRepo.count({ where: { status: EventStatus.CANCELLED } }),
    ]);
    const dashboardData: DashboardDto = {
      cards: [
        {
          key: 'organizations',
          title: 'Organizations',
          value: totalOrganization,
          trend: trendOrg,
        },
        {
          key: 'events',
          title: 'Events',
          value: totalEvents,
          trend: trendEvent,
        },
        {
          key: 'revenue',
          title: 'Revenue',
          value: Number(totalRevenue?.total ?? 0),
          trend: trendRevenue,
        },
        {
          key: 'tickets',
          title: 'Tickets',
          value: totalTickets,
          trend: trendTicket,
        },
      ],
      lineChart: [],
      pieChart: [
        { label: 'Upcoming', value: upcoming },
        { label: 'Ongoing', value: ongoing },
        { label: 'Ended', value: ended },
        { label: 'Cancelled', value: cancelled },
      ],
    };
    return {
      statusCode: 200,
      message: 'Get dashboard successfully',
      data: dashboardData,
    };
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
    };
    return {
      statusCode: 200,
      message: 'Get dashboard by id successfully',
      data: dashboardData,
    };
  }

  async GetDashboardByOrgSlug(
    slug: string,
  ): Promise<ApiResponse<DashboardDto>> {
    const organization = await this.OrganizationRepo.findOne({
      where: { slug },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const EventThisMonth = await this.eventRepo.count({
      where: {
        organization: { id: organization.id },
        createdAt: MoreThanOrEqual(startOfThisMonth),
      },
    });
    const EventLastMonth = await this.eventRepo.count({
      where: {
        organization: { id: organization.id },
        createdAt: Between(startOfLastMonth, endOfLastMonth),
      },
    });
    const trendEvent =
      EventLastMonth === 0
        ? 0
        : Number(
            (
              ((EventThisMonth - EventLastMonth) / EventLastMonth) *
              100
            ).toFixed(1),
          );

    const ticketQuery = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .leftJoin('ticketType.event', 'event')
      .where('event.organizationId = :orgId', { orgId: organization.id });

    const totalTickets = await ticketQuery.getCount();

    const TicketThisMonth = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .leftJoin('ticketType.event', 'event')
      .where('event.organizationId = :orgId', { orgId: organization.id })
      .andWhere('ticket.createdAt >= :start', { start: startOfThisMonth })
      .getCount();
    const TicketLastMonth = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .leftJoin('ticketType.event', 'event')
      .where('event.organizationId = :orgId', { orgId: organization.id })
      .andWhere('ticket.createdAt BETWEEN :start AND :end', {
        start: startOfLastMonth,
        end: endOfLastMonth,
      })
      .getCount();
    const trendTicket =
      TicketLastMonth === 0
        ? 0
        : Number(
            (
              ((TicketThisMonth - TicketLastMonth) / TicketLastMonth) *
              100
            ).toFixed(1),
          );

    const revenueThisMonth = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .leftJoin('ticketType.event', 'event')
      .select('SUM(ticketType.price)', 'total')
      .where('event.organizationId = :orgId', { orgId: organization.id })
      .andWhere('ticket.createdAt >= :start', { start: startOfThisMonth })
      .getRawOne();
    const revenueLastMonth = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .leftJoin('ticketType.event', 'event')
      .select('SUM(ticketType.price)', 'total')
      .where('event.organizationId = :orgId', { orgId: organization.id })
      .andWhere('ticket.createdAt BETWEEN :start AND :end', {
        start: startOfLastMonth,
        end: endOfLastMonth,
      })
      .getRawOne();
    const thisRevenue = Number(revenueThisMonth?.total ?? 0);
    const lastRevenue = Number(revenueLastMonth?.total ?? 0);
    const trendRevenue =
      lastRevenue === 0
        ? 0
        : Number(
            (((thisRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1),
          );

    const totalRevenue = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .leftJoin('ticketType.event', 'event')
      .select('SUM(ticketType.price)', 'total')
      .where('event.organizationId = :orgId', { orgId: organization.id })
      .getRawOne();

    const totalEvents = await this.eventRepo.count({
      where: { organization: { id: organization.id } },
    });
    const [upcoming, ongoing, ended, cancelled] = await Promise.all([
      this.eventRepo.count({
        where: {
          organization: { id: organization.id },
          status: EventStatus.UPCOMING,
        },
      }),
      this.eventRepo.count({
        where: {
          organization: { id: organization.id },
          status: EventStatus.ONGOING,
        },
      }),
      this.eventRepo.count({
        where: {
          organization: { id: organization.id },
          status: EventStatus.ENDED,
        },
      }),
      this.eventRepo.count({
        where: {
          organization: { id: organization.id },
          status: EventStatus.CANCELLED,
        },
      }),
    ]);

    const dashboardData: DashboardDto = {
      cards: [
        {
          key: 'events',
          title: 'Events',
          value: totalEvents,
          trend: trendEvent,
        },
        {
          key: 'revenue',
          title: 'Revenue',
          value: Number(totalRevenue?.total ?? 0),
          trend: trendRevenue,
        },
        {
          key: 'tickets',
          title: 'Tickets',
          value: totalTickets,
          trend: trendTicket,
        },
      ],
      lineChart: [],
      pieChart: [
        { label: 'Upcoming', value: upcoming },
        { label: 'Ongoing', value: ongoing },
        { label: 'Ended', value: ended },
        { label: 'Cancelled', value: cancelled },
      ],
    };

    return {
      statusCode: 200,
      message: 'Get organization dashboard successfully',
      data: dashboardData,
    };
  }
}
