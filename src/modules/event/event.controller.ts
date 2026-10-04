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
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) { }

  @Post()
  @Permissions(PermissionCode.EVENT_CREATE)
  async create(
    @Body() createEventDto: CreateEventDto,
    @Req() req: any,
  ): Promise<ApiResponse<EventDto>> {
    return this.eventService.create(createEventDto, req.user);
  }

  @Get()
  @ApiPaginationQuery({
    sortableColumns: ['title', 'capacity', 'categories.name'],
    searchableColumns: ['title', 'organization.name', 'categories.name'],
    filterableColumns: {
      status: [FilterOperator.EQ],
      capacity: [FilterOperator.GTE, FilterOperator.LTE],
      'categories.id': [FilterOperator.EQ],
      'categories.name': [FilterOperator.EQ],
    },
  })
  @ApiOperation({ operationId: 'getEvents' })
  @Permissions(PermissionCode.EVENT_VIEW)
  async findAll(
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<EventDto>>> {
    return await this.eventService.findAll(query);
  }

  @Get('org/:slug')
  @ApiPaginationQuery({
    sortableColumns: ['title', 'capacity', 'categories.name'],
    searchableColumns: ['title', 'organization.name', 'categories.name'],
    filterableColumns: {
      status: [FilterOperator.EQ],
      capacity: [FilterOperator.GTE, FilterOperator.LTE],
      'categories.id': [FilterOperator.EQ],
      'categories.name': [FilterOperator.EQ],
    },
  })
  @ApiOperation({ operationId: 'getEventsByOrgSlug' })
  @Permissions(PermissionCode.EVENT_VIEW)
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
  @Permissions(PermissionCode.EVENT_DELETE)
  deleteSort(
    @Body() cancelledDto: CancelledDto,
    @Req() req: any,
  ): Promise<ApiResponse<CancelledDto>> {
    return this.eventService.cancelled(cancelledDto, req.user);
  }

  @Get(':id')
  @Permissions(PermissionCode.EVENT_VIEW)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<EventDto>> {
    return this.eventService.findOne(id);
  }
  @Get(':id/ticket-types')
  @Permissions(PermissionCode.EVENT_VIEW)
  async getTicketTypes(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<TicketTypeDto[]>> {
    return this.eventService.getTicketTypes(id);
  }
  @Get(':id/invites')
  @Permissions(PermissionCode.INVITATION_VIEW)
  async getInvites(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<ApiResponse<InviteDashboardDto>> {
    return this.eventService.getInvites(id, req.user);
  }
  @Patch(':id')
  @Permissions(PermissionCode.EVENT_UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Req() req: any,
  ): Promise<ApiResponse<EventDto>> {
    return this.eventService.update(id, updateEventDto, req.user);
  }

  @Delete(':id')
  @Permissions(PermissionCode.EVENT_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.eventService.remove(id, req.user);
  }
}
