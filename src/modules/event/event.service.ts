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
import { In, IsNull, Repository } from 'typeorm';
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
import { Category } from '../category/entities/category.entity';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
    @InjectRepository(Membership)
    private membershipRepo: Repository<Membership>,
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,
    // @InjectRepository(TicketType) private ticketTypeRepo: Repository<TicketType>,
    // @InjectRepository(Invite) private inviteRepo: Repository<Invite>
    private readonly uploadService: UploadService,
  ) {}

  async create(
    createEventDto: CreateEventDto,
    currentUser?: any,
  ): Promise<ApiResponse<EventDto>> {
    console.time('POST_EVENT_CREATE');
    try {
      this.validateEventDates(createEventDto);
      const status = EventStatus.DRAFT;
      const { categoryIds, ...eventData } = createEventDto;
      const organization = await this.findOrganizationOrThrow(
        createEventDto.organizationId,
      );

      await this.assertUserCanManageOrganization(
        organization.id,
        currentUser,
      );
      const categories = await this.findCategoriesByIds(categoryIds);

      const event = this.eventRepo.create({
        ...eventData,
        status,
        organization,
        categories,
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
        categories: saveEvent.categories,
        description: saveEvent.description,
        place: saveEvent.place,
      };
      return Response(201, 'Create Event Successfully', item);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      console.error('POST_EVENT_CREATE_UNEXPECTED_FAILED', error);
      throw error;
    } finally {
      console.timeEnd('POST_EVENT_CREATE');
    }
  }

  async findAll(
    query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<EventDto>>> {
    console.time('GET_EVENTS');
    try {
      await this.syncEventStatuses();
      const now = new Date();
      const eventQuery = this.eventRepo
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.organization', 'organization')
        .leftJoinAndSelect('event.categories', 'categories')
        .where('event.status IN (:...statuses)', {
          statuses: [
            EventStatus.PUBLISHED,
            EventStatus.UPCOMING,
            EventStatus.ONGOING,
          ],
        })
        .andWhere('event.registrationEndDate >= :now', { now });

      const result = await paginate(query, eventQuery, {
        sortableColumns: ['title', 'capacity', 'categories.name'],
        searchableColumns: ['title', 'organization.name', 'categories.name'],
        filterableColumns: {
          status: [FilterOperator.EQ],
          capacity: [FilterOperator.GTE, FilterOperator.LTE],
          'categories.id': [FilterOperator.EQ],
          'categories.name': [FilterOperator.EQ],
        },
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
    } finally {
      console.timeEnd('GET_EVENTS');
    }
  }

  async findAllByOrgSlug(
    slug: string,
    userId: string,
    query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<EventDto>>> {
    console.time('GET_EVENTS_BY_ORG_SLUG');
    try {
      await this.syncEventStatuses();
      const organization = await this.assertUserInOrganization(slug, userId);

      const result = await paginate(query, this.eventRepo, {
        sortableColumns: ['title', 'capacity', 'categories.name'],
        searchableColumns: ['title', 'organization.name', 'categories.name'],
        filterableColumns: {
          status: [FilterOperator.EQ],
          capacity: [FilterOperator.GTE, FilterOperator.LTE],
          'categories.id': [FilterOperator.EQ],
          'categories.name': [FilterOperator.EQ],
        },
        where: { organization: { id: organization.id } },
        relations: ['organization', 'categories'],
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
    } finally {
      console.timeEnd('GET_EVENTS_BY_ORG_SLUG');
    }
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

  async cancelled(
    cancelled: CancelledDto,
    currentUser?: any,
  ): Promise<ApiResponse<CancelledDto>> {
    const events = await this.eventRepo.find({
      where: { id: In(cancelled.ids) },
      relations: ['organization'],
    });
    if (events.length !== cancelled.ids.length) {
      throw new BadRequestException('Invalid ids');
    }
    for (const event of events) {
      await this.assertUserCanManageOrganization(
        event.organization.id,
        currentUser,
      );
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
    console.time('GET_EVENT_BY_ID');
    try {
      await this.syncEventStatuses([id]);
      const event = await this.eventRepo.findOne({
        where: { id },
        relations: ['organization', 'categories'],
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
    } finally {
      console.timeEnd('GET_EVENT_BY_ID');
    }
  }

  async getTicketTypes(id: string): Promise<ApiResponse<TicketTypeDto[]>> {
    const timer = `GET_EVENT_TICKET_TYPES:${id}`;
    console.time(timer);
    try {
      await this.syncEventStatuses([id]);
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
    } finally {
      console.timeEnd(timer);
    }
  }

  async getInvites(
    id: string,
    currentUser?: any,
  ): Promise<ApiResponse<InviteDashboardDto>> {
    const timer = `GET_EVENT_INVITES:${id}`;
    console.time(timer);
    try {
      const event = await this.eventRepo.findOne({
        where: { id },
        relations: ['organization', 'invites'],
      });
      if (!event) throw new BadRequestException('Event not found');
      await this.assertUserCanManageOrganization(
        event.organization.id,
        currentUser,
      );
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
      return Response(
        200,
        'Get Invites of Event Successfully',
        inviteDashboard,
      );
    } finally {
      console.timeEnd(timer);
    }
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    currentUser?: any,
  ): Promise<ApiResponse<EventDto>> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['organization', 'categories'],
    });
    const oldPosterUrl = event?.eventPoster;
    const oldBannerUrl = event?.eventBanner;

    if (!event) throw new BadRequestException('Event not found');
    await this.assertUserCanManageOrganization(
      event.organization.id,
      currentUser,
    );
    this.validateEventDates({
      startDateTime: updateEventDto.startDateTime ?? event.startDateTime,
      endDateTime: updateEventDto.endDateTime ?? event.endDateTime,
      registrationEndDate:
        updateEventDto.registrationEndDate ?? event.registrationEndDate,
    });

    // nếu đổi organization
    if (
      updateEventDto.organizationId &&
      updateEventDto.organizationId !== event.organization?.id
    ) {
      await this.assertUserCanManageOrganization(
        updateEventDto.organizationId,
        currentUser,
      );
      const org = await this.findOrganizationOrThrow(
        updateEventDto.organizationId,
      );
      event.organization = org;
    }

    if (updateEventDto.categoryIds !== undefined) {
      event.categories = await this.findCategoriesByIds(
        updateEventDto.categoryIds,
      );
    }

    const { categoryIds, ...eventData } = updateEventDto;
    Object.assign(event, eventData);

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

  async remove(id: string, currentUser?: any): Promise<ApiResponse<{ id: string }>> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!event) {
      throw new BadRequestException('Event not found');
    }

    await this.assertUserCanManageOrganization(
      event.organization.id,
      currentUser,
    );

    if ([EventStatus.ENDED, EventStatus.CANCELLED].includes(event.status)) {
      throw new BadRequestException(
        `Cannot cancel event that is already ${event.status}`,
      );
    }

    event.status = EventStatus.CANCELLED;
    await this.eventRepo.save(event);

    return Response(200, 'Event cancelled successfully', { id });
  }

  private async findCategoriesByIds(
    categoryIds?: string[],
  ): Promise<Category[]> {
    if (!categoryIds || categoryIds.length === 0) {
      return [];
    }

    const uniqueCategoryIds = [...new Set(categoryIds)];
    if (uniqueCategoryIds.length !== categoryIds.length) {
      throw new BadRequestException('DUPLICATE_CATEGORY_IDS');
    }

    const categories = await this.categoryRepo.find({
      where: { id: In(uniqueCategoryIds), deletedAt: IsNull() },
    });

    if (categories.length !== uniqueCategoryIds.length) {
      throw new BadRequestException('CATEGORY_NOT_FOUND');
    }

    return categories;
  }

  private async findOrganizationOrThrow(orgId: string): Promise<Organization> {
    const organization = await this.organizationRepo.findOne({
      where: { id: orgId },
    });

    if (!organization) {
      throw new BadRequestException('ORGANIZATION_NOT_FOUND');
    }

    return organization;
  }

  private validateEventDates(dto: {
    startDateTime?: Date | string;
    endDateTime?: Date | string;
    registrationEndDate?: Date | string;
  }): void {
    const startDateTime = this.parseDate(dto.startDateTime);
    const endDateTime = this.parseDate(dto.endDateTime);
    const registrationEndDate = this.parseDate(dto.registrationEndDate);

    if (startDateTime && endDateTime && startDateTime >= endDateTime) {
      throw new BadRequestException('INVALID_EVENT_DATES');
    }

    if (
      startDateTime &&
      registrationEndDate &&
      registrationEndDate > startDateTime
    ) {
      throw new BadRequestException('INVALID_EVENT_DATES');
    }
  }

  private parseDate(value?: Date | string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('INVALID_EVENT_DATES');
    }

    return date;
  }

  private async syncEventStatuses(eventIds?: string[]): Promise<void> {
    const now = new Date();
    const lockedStatuses = [
      EventStatus.CANCELLED,
      EventStatus.POSTPONED,
      EventStatus.DRAFT,
    ];
    const params: any[] = [
      now,
      EventStatus.ENDED,
      EventStatus.ONGOING,
      EventStatus.UPCOMING,
      ...lockedStatuses,
    ];
    const idFilter = eventIds?.length
      ? `AND id = ANY($${params.length + 1}::uuid[])`
      : '';

    if (eventIds?.length) {
      params.push(eventIds);
    }

    await this.eventRepo.query(
      `
        UPDATE events
        SET
          status = CASE
            WHEN "endDateTime" <= $1 THEN $2
            WHEN "startDateTime" <= $1 AND "endDateTime" > $1 THEN $3
            WHEN "startDateTime" > $1 THEN $4
            ELSE status
          END,
          "updatedAt" = NOW()
        WHERE status NOT IN ($5, $6, $7)
          ${idFilter}
          AND (
            (status != $2 AND "endDateTime" <= $1)
            OR (status != $3 AND "startDateTime" <= $1 AND "endDateTime" > $1)
            OR (status != $4 AND "startDateTime" > $1)
          )
      `,
      params,
    );
  }

  private async assertUserCanManageOrganization(
    orgId: string,
    currentUser?: any,
  ): Promise<void> {
    if (currentUser?.role?.isSuperAdmin) {
      return;
    }

    if (!currentUser?.userId) {
      throw new ForbiddenException('EVENT_CREATE_FORBIDDEN');
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: currentUser.userId },
        organization: { id: orgId },
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('EVENT_CREATE_FORBIDDEN');
    }
  }
}
