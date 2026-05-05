import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { EventDto } from './dto/event.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { In, Repository } from 'typeorm';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { EventStatus } from 'src/shared/enum/enum';
import { FilterOperator, paginate, PaginateQuery } from 'nestjs-paginate';
import { plainToInstance } from 'class-transformer';
import { CancelledDto } from './dto/cancelled-event.dto';
import { response } from 'express';
import { Organization } from '../organization/entities/organization.entity';

@Injectable()
export class EventService {
  constructor(@InjectRepository(Event) private readonly eventRepo: Repository<Event>, @InjectRepository(Organization) private organizationRepo: Repository<Organization>) { }

  async create(createEventDto: CreateEventDto): Promise<ApiResponse<EventDto>> {
    const status = EventStatus.DRAFT;
    const event = this.eventRepo.create({
      ...createEventDto,
      status,
      organization: { id: createEventDto.organizationId }
    });
    const saveEvent = await this.eventRepo.save(event);
    const item: EventDto = {
      id: saveEvent.id,
      title: saveEvent.title,
      eventPoster: saveEvent.eventPoster,
      startDateTime: saveEvent.startDateTime,
      endDateTime: saveEvent.endDateTime,
      registrationEndDate: saveEvent.registrationEndDate,
      capacity: saveEvent.capacity,
      status: saveEvent.status,
      organization: saveEvent.organization,
      description: saveEvent.description,
      place: saveEvent.place
    }
    return Response(201, "Create Event Successfully", item);
  }

  async findAll(query: PaginateQuery): Promise<ApiResponse<PaginationResult<EventDto>>> {
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
    const eventIds = result.data.map(e => e.id);
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

      soldMap.forEach(r => {
        soldMapById[r.eventId] = Number(r.soldTickets);
      });
    }

    const items = plainToInstance(EventDto, result.data.map(e => ({
      ...e,
      soldTickets: soldMapById[e.id] ?? 0,
    })), { excludeExtraneousValues: true });

    return Response(200, 'Get All Events Successfully', {
      items,
      page: result.meta.currentPage ?? 1,
      limit: result.meta.itemsPerPage,
      total: result.meta.totalItems ?? 0,
      totalPages: result.meta.totalPages ?? 0,
    });
  }

  async cancelled(cancelled: CancelledDto): Promise<ApiResponse<CancelledDto>> {
    const events = await this.eventRepo.find({ where: { id: In(cancelled.ids) } })
    if (events.length !== cancelled.ids.length) {
      throw new BadRequestException("Invalid ids");
    }
    const invalidEvents = events.filter(e =>
      e.status === EventStatus.ENDED || e.status === EventStatus.CANCELLED
    );
    if (invalidEvents.length > 0) {
      throw new BadRequestException(
        `Cannot cancel events that are already ${EventStatus.ENDED} or ${EventStatus.CANCELLED}`
      );
    }
    await this.eventRepo.update(
      { id: In(cancelled.ids) },
      { status: EventStatus.CANCELLED },
    );

    return Response(200, `Cancelled successfully`, cancelled)
  }

  async findOne(id: string): Promise<ApiResponse<EventDto>> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['organization'],
    });
    if (!event) throw new BadRequestException('Event not found');

    return Response(200, "Get Event By Id Successfully", plainToInstance(EventDto, event, { excludeExtraneousValues: true }));
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<ApiResponse<EventDto>> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!event) throw new BadRequestException('Event not found');

    // nếu đổi organization
    if (updateEventDto.organizationId && updateEventDto.organizationId !== event.organization?.id) {
      const org = await this.organizationRepo.findOne({ where: { id: updateEventDto.organizationId } });
      if (!org) throw new BadRequestException('Organization not found');
      event.organization = org;
    }

    Object.assign(event, updateEventDto);
    const saved = await this.eventRepo.save(event);

    return Response(200, 'Update Event Successfully', plainToInstance(EventDto, saved, {
      excludeExtraneousValues: true,
    }));
  }

  remove(id: number) {
    return `This action removes a #${id} event`;
  }
}
