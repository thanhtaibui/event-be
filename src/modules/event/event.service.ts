import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { EventDto } from './dto/event.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { In, Repository } from 'typeorm';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { EventStatus, InvitationStatus } from 'src/shared/enum/enum';
import { FilterOperator, paginate, PaginateQuery } from 'nestjs-paginate';
import { plainToInstance } from 'class-transformer';
import { CancelledDto } from './dto/cancelled-event.dto';
import { Organization } from '../organization/entities/organization.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { Invite } from '../invite/entities/invite.entity';
import { TicketTypeDto } from '../ticket-type/dto/ticket-type.dto';
import { InviteDashboardDto } from '../invite/dto/invites-dashboard';
import { UploadService } from '../upload/upload.service';
import { Membership } from '../membership/entities/membership.entity';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
    @InjectRepository(Membership)
    private membershipRepo: Repository<Membership>,
    // @InjectRepository(TicketType) private ticketTypeRepo: Repository<TicketType>,
    // @InjectRepository(Invite) private inviteRepo: Repository<Invite>
    private readonly uploadService: UploadService,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<ApiResponse<EventDto>> {
    const status = EventStatus.DRAFT;
    const event = this.eventRepo.create({
      ...createEventDto,
      status,
      organization: { id: createEventDto.organizationId },
    });
    const saveEvent = await this.eventRepo.save(event);
    const item: EventDto = {
      id: saveEvent.id,
      title: saveEvent.title,
      eventPoster: saveEvent.eventPoster,
      eventBanner: saveEvent.eventBanner,
      startDateTime: saveEvent.startDateTime,
      endDateTime: saveEvent.endDateTime,
      registrationEndDate: saveEvent.registrationEndDate,
      capacity: saveEvent.capacity,
      status: saveEvent.status,
      organization: saveEvent.organization,
      description: saveEvent.description,
      place: saveEvent.place,
    };
    return Response(201, 'Create Event Successfully', item);
  }

  async findAll(
    query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<EventDto>>> {
    const result = await paginate(query, this.eventRepo, {
      sortableColumns: ['title', 'capacity'],
      searchableColumns: ['title', 'organization.name'],
      filterableColumns: {
        status: [FilterOperator.EQ],
        capacity: [FilterOperator.GTE, FilterOperator.LTE],
      },
      relations: ['organization'],
      defaultSortBy: [['createdAt', 'DESC']],
    });

    // soldTickets phải query riêng vì là virtual field
    const eventIds = result.data.map((e) => e.id);
    const soldMapById: Record<string, number> = {};

    if (eventIds.length > 0) {
      const soldMap = await this.eventRepo
        .createQueryBuilder('event')
        .leftJoin('event.ticketTypes', 'ticketType')
        .leftJoin('ticketType.tickets', 'ticket')
        .select('event.id', 'eventId')
        .addSelect('COUNT(ticket.id)', 'soldTickets')
        .where('event.id IN (:...ids)', { ids: eventIds })
        .groupBy('event.id')
        .getRawMany();

      soldMap.forEach((r) => {
        soldMapById[r.eventId] = Number(r.soldTickets);
      });
    }

    const items = plainToInstance(
      EventDto,
      result.data.map((e) => ({
        ...e,
        eventPoster: e.eventBanner ?? e.eventPoster,
        soldTickets: soldMapById[e.id] ?? 0,
      })),
      { excludeExtraneousValues: true },
    );

    return Response(200, 'Get All Events Successfully', {
      items,
      page: result.meta.currentPage ?? 1,
      limit: result.meta.itemsPerPage,
      total: result.meta.totalItems ?? 0,
      totalPages: result.meta.totalPages ?? 0,
    });
  }

  async findAllByOrgSlug(
    slug: string,
    userId: string,
    query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<EventDto>>> {
    const organization = await this.assertUserInOrganization(slug, userId);

    const result = await paginate(query, this.eventRepo, {
      sortableColumns: ['title', 'capacity'],
      searchableColumns: ['title', 'organization.name'],
      filterableColumns: {
        status: [FilterOperator.EQ],
        capacity: [FilterOperator.GTE, FilterOperator.LTE],
      },
      where: { organization: { id: organization.id } },
      relations: ['organization'],
      defaultSortBy: [['createdAt', 'DESC']],
    });

    const eventIds = result.data.map((e) => e.id);
    const soldMapById: Record<string, number> = {};

    if (eventIds.length > 0) {
      const soldMap = await this.eventRepo
        .createQueryBuilder('event')
        .leftJoin('event.ticketTypes', 'ticketType')
        .leftJoin('ticketType.tickets', 'ticket')
        .select('event.id', 'eventId')
        .addSelect('COUNT(ticket.id)', 'soldTickets')
        .where('event.id IN (:...ids)', { ids: eventIds })
        .groupBy('event.id')
        .getRawMany();

      soldMap.forEach((r) => {
        soldMapById[r.eventId] = Number(r.soldTickets);
      });
    }

    const items = plainToInstance(
      EventDto,
      result.data.map((e) => ({
        ...e,
        eventPoster: e.eventBanner ?? e.eventPoster,
        soldTickets: soldMapById[e.id] ?? 0,
      })),
      { excludeExtraneousValues: true },
    );

    return Response(200, 'Get Events Of Organization Successfully', {
      items,
      page: result.meta.currentPage ?? 1,
      limit: result.meta.itemsPerPage,
      total: result.meta.totalItems ?? 0,
      totalPages: result.meta.totalPages ?? 0,
    });
  }

  private async assertUserInOrganization(
    slug: string,
    userId: string,
  ): Promise<Organization> {
    const organization = await this.organizationRepo.findOne({
      where: { slug },
    });

    if (!organization) {
      throw new BadRequestException('Organization not found');
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: userId },
        organization: { id: organization.id },
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    return organization;
  }

  async cancelled(cancelled: CancelledDto): Promise<ApiResponse<CancelledDto>> {
    const events = await this.eventRepo.find({
      where: { id: In(cancelled.ids) },
    });
    if (events.length !== cancelled.ids.length) {
      throw new BadRequestException('Invalid ids');
    }
    const invalidEvents = events.filter(
      (e) =>
        e.status === EventStatus.ENDED || e.status === EventStatus.CANCELLED,
    );
    if (invalidEvents.length > 0) {
      throw new BadRequestException(
        `Cannot cancel events that are already ${EventStatus.ENDED} or ${EventStatus.CANCELLED}`,
      );
    }
    await this.eventRepo.update(
      { id: In(cancelled.ids) },
      { status: EventStatus.CANCELLED },
    );

    return Response(200, `Cancelled successfully`, cancelled);
  }

  async findOne(id: string): Promise<ApiResponse<EventDto>> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['organization'],
    });
    if (!event) throw new BadRequestException('Event not found');
    const soldResult = await this.eventRepo
      .createQueryBuilder('event')
      .leftJoin('event.ticketTypes', 'ticketType')
      .leftJoin('ticketType.tickets', 'ticket')
      .select('event.id', 'eventId')
      .addSelect('COUNT(ticket.id)', 'soldTickets')
      .where('event.id = :id', { id })
      .groupBy('event.id')
      .getRawOne();
    const eventWithSold = {
      ...event,
      soldTickets: parseInt(soldResult?.soldTickets || '0', 10),
    };
    return Response(
      200,
      'Get Event By Id Successfully',
      plainToInstance(EventDto, eventWithSold, {
        excludeExtraneousValues: true,
      }),
    );
  }

  async getTicketTypes(id: string): Promise<ApiResponse<TicketTypeDto[]>> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['ticketTypes'],
    });
    if (!event) throw new BadRequestException('Event not found');
    return Response(
      200,
      'Get Ticket Types of Event Successfully',
      plainToInstance(TicketTypeDto, event.ticketTypes, {
        excludeExtraneousValues: true,
      }),
    );
  }

  async getInvites(id: string): Promise<ApiResponse<InviteDashboardDto>> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['invites'],
    });
    if (!event) throw new BadRequestException('Event not found');
    const inviteDashboard = new InviteDashboardDto();
    inviteDashboard.totalInvites = event.invites.length;
    inviteDashboard.acceptedInvites = event.invites.filter(
      (invite) => invite.status === InvitationStatus.ACCEPTED,
    ).length;
    inviteDashboard.pendingInvites = event.invites.filter(
      (invite) => invite.status === InvitationStatus.PENDING,
    ).length;
    inviteDashboard.rejectedInvites = event.invites.filter(
      (invite) => invite.status === InvitationStatus.REJECTED,
    ).length;
    return Response(200, 'Get Invites of Event Successfully', inviteDashboard);
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
  ): Promise<ApiResponse<EventDto>> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['organization'],
    });
    const oldPosterUrl = event?.eventPoster;
    const oldBannerUrl = event?.eventBanner;

    if (!event) throw new BadRequestException('Event not found');

    // nếu đổi organization
    if (
      updateEventDto.organizationId &&
      updateEventDto.organizationId !== event.organization?.id
    ) {
      const org = await this.organizationRepo.findOne({
        where: { id: updateEventDto.organizationId },
      });
      if (!org) throw new BadRequestException('Organization not found');
      event.organization = org;
    }

    Object.assign(event, updateEventDto);

    const saved = await this.eventRepo.save(event);
    if (oldPosterUrl && saved.eventPoster !== oldPosterUrl) {
      await this.uploadService.deleteFile(oldPosterUrl);
    }
    if (oldBannerUrl && saved.eventBanner !== oldBannerUrl) {
      await this.uploadService.deleteFile(oldBannerUrl);
    }
    return Response(
      200,
      'Update Event Successfully',
      plainToInstance(EventDto, saved, {
        excludeExtraneousValues: true,
      }),
    );
  }

  remove(id: number) {
    return `This action removes a #${id} event`;
  }
}
