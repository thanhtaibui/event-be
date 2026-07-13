import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { EventDto } from './dto/event.dto';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { ApiOperation } from '@nestjs/swagger';
import { ApiPaginationQuery, FilterOperator, Paginate } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { CancelledDto } from './dto/cancelled-event.dto';
import { TicketTypeDto } from '../ticket-type/dto/ticket-type.dto';
import { InviteDashboardDto } from '../invite/dto/invites-dashboard';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) { }

  @Post()
  async create(
    @Body() createEventDto: CreateEventDto,
  ): Promise<ApiResponse<EventDto>> {
    return this.eventService.create(createEventDto);
  }

  @Get()
  @ApiPaginationQuery({
    sortableColumns: ['title', 'capacity'],
    searchableColumns: ['title', 'organization.name'],
    filterableColumns: {
      status: [FilterOperator.EQ],
      capacity: [FilterOperator.GTE, FilterOperator.LTE],
    },
  })
  @ApiOperation({ operationId: 'getEvents' })
  async findAll(
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<EventDto>>> {
    return await this.eventService.findAll(query);
  }

  @Get('org/:slug')
  @ApiPaginationQuery({
    sortableColumns: ['title', 'capacity'],
    searchableColumns: ['title', 'organization.name'],
    filterableColumns: {
      status: [FilterOperator.EQ],
      capacity: [FilterOperator.GTE, FilterOperator.LTE],
    },
  })
  @ApiOperation({ operationId: 'getEventsByOrgSlug' })
  async findAllByOrgSlug(
    @Param('slug') slug: string,
    @Req() req: any,
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<EventDto>>> {
    return await this.eventService.findAllByOrgSlug(
      slug,
      req.user.userId,
      query,
    );
  }

  @Patch('/cancelled')
  @ApiOperation({ operationId: 'cancelled' })
  deleteSort(
    @Body() cancelledDto: CancelledDto,
  ): Promise<ApiResponse<CancelledDto>> {
    return this.eventService.cancelled(cancelledDto);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<EventDto>> {
    return this.eventService.findOne(id);
  }
  @Get(':id/ticket-types')
  async getTicketTypes(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<TicketTypeDto[]>> {
    return this.eventService.getTicketTypes(id);
  }
  @Get(':id/invites')
  async getInvites(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<InviteDashboardDto>> {
    return this.eventService.getInvites(id);
  }
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ): Promise<ApiResponse<EventDto>> {
    return this.eventService.update(id, updateEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventService.remove(+id);
  }
}
