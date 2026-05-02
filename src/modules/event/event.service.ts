import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { SortDto } from 'src/common/dtos/sort.dto';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { EventDto } from './dto/event.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { Repository } from 'typeorm';
import { applySearch, applySort } from 'src/common/utils/applySort';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { paginateArray } from 'src/common/utils/paginate-array';

@Injectable()
export class EventService {
  constructor(@InjectRepository(Event) private readonly eventRepo: Repository<Event>) {

  }
  create(createEventDto: CreateEventDto) {
    return 'This action adds a new event';
  }

  async findAll(query: SortDto): Promise<ApiResponse<PaginationResult<EventDto>>> {
    const { sortBy, sortOrder, search } = query;
    const events = await this.eventRepo.find({ relations: ['organization'] })
    const soldTickets = await this.eventRepo
      .createQueryBuilder('event')
      .leftJoin('event.ticketTypes', 'ticketType')
      .leftJoin('ticketType.tickets', 'ticket')
      .loadRelationCountAndMap('event.soldTickets', 'ticketType.tickets')
      .getCount()
    const searchData = applySearch(
      events,
      search,
      ['title', 'status', 'organizations.name']
    );

    // 3. Sort dữ liệu
    const sortedData = applySort(
      searchData,
      sortBy as keyof Event,
      sortOrder,
      ['title', 'status']
    );
    const items = sortedData.map((s) => ({
      title: s.title,
      eventPoster: s.eventPoster,
      startDateTime: s.startDateTime,
      endDateTime: s.endDateTime,
      registrationEndDate: s.registrationEndDate,
      capacity: s.capacity,
      status: s.status,
      soldTickets: soldTickets,
      organization: {
        id: s.organization.id,
        name: s.organization.name,
      },
    }))
    return Response(200, `Get All Events Successfully`, paginateArray<EventDto>(items, query));
  }

  findOne(id: number) {
    return `This action returns a #${id} event`;
  }

  update(id: number, updateEventDto: UpdateEventDto) {
    return `This action updates a #${id} event`;
  }

  remove(id: number) {
    return `This action removes a #${id} event`;
  }
}
