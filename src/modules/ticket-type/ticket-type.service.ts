import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { TicketType } from './entities/ticket-type.entity';
import { Repository } from 'typeorm';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { TicketTypeDto } from './dto/ticket-type.dto';
import { plainToInstance } from 'class-transformer';
import { Event } from '../event/entities/event.entity';
import { EventStatus } from 'src/shared/enum/enum';
import { Membership } from '../membership/entities/membership.entity';
const LOCKED_STATUSES = [EventStatus.ENDED, EventStatus.CANCELLED];

@Injectable()
export class TicketTypeService {
  constructor(
    @InjectRepository(TicketType)
    private ticketTypeRepo: Repository<TicketType>,
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    @InjectRepository(Membership)
    private membershipRepo: Repository<Membership>,
  ) {}

  async create(
    createTicketTypeDto: CreateTicketTypeDto,
    currentUser?: any,
  ): Promise<ApiResponse<TicketTypeDto>> {
    const event = await this.eventRepo.findOne({
      where: { id: createTicketTypeDto.eventId },
      relations: ['organization', 'ticketTypes'],
    });
    if (!event) throw new BadRequestException('Event not found');
    await this.assertCanManageEvent(event, currentUser);
    const totalTickets =
      event.ticketTypes.reduce((sum, type) => sum + type.quantity, 0) +
      createTicketTypeDto.quantity;
    if (totalTickets > event.capacity) {
      throw new BadRequestException(
        `Total ticket quantity (${totalTickets}) exceeds event capacity (${event.capacity})`,
      );
    }
    const ticketType = this.ticketTypeRepo.create({
      ...createTicketTypeDto,
      event,
    });

    const saved = await this.ticketTypeRepo.save(ticketType);

    return Response(
      200,
      'Create Ticket Type Successfully',
      plainToInstance(TicketTypeDto, saved, {
        excludeExtraneousValues: true,
      }),
    );
  }

  async findAll(): Promise<ApiResponse<TicketTypeDto[]>> {
    console.time('GET_TICKET_TYPES');
    try {
      const ticketTypes = await this.ticketTypeRepo.find({
        relations: ['event'],
        order: { createdAt: 'DESC' },
      });
      return Response(
        200,
        'Get Ticket Types Successfully',
        plainToInstance(TicketTypeDto, ticketTypes, {
          excludeExtraneousValues: true,
          enableImplicitConversion: true,
        }),
      );
    } finally {
      console.timeEnd('GET_TICKET_TYPES');
    }
  }

  async findOne(id: string): Promise<ApiResponse<TicketTypeDto>> {
    const timer = `GET_TICKET_TYPE_BY_ID:${id}`;
    console.time(timer);
    try {
      const ticketType = await this.ticketTypeRepo.findOne({
        where: { id },
        relations: ['event'],
      });
      if (!ticketType) throw new BadRequestException('Ticket Type not found');
      return Response(
        200,
        'Ticket Type found',
        plainToInstance(TicketTypeDto, ticketType, {
          excludeExtraneousValues: true,
          enableImplicitConversion: true,
        }),
      );
    } finally {
      console.timeEnd(timer);
    }
  }

  async update(
    id: string,
    updateTicketTypeDto: UpdateTicketTypeDto,
    currentUser?: any,
  ): Promise<ApiResponse<TicketTypeDto>> {
    const ticketType = await this.ticketTypeRepo.findOne({
      where: { id },
      relations: ['event', 'event.organization'],
    });
    if (!ticketType) throw new BadRequestException('Ticket Type not found');
    await this.assertCanManageEvent(ticketType.event, currentUser);
    if (LOCKED_STATUSES.includes(ticketType.event.status)) {
      throw new BadRequestException(
        `Cannot update ticket type when status is ${ticketType.event.status}`,
      );
    }

    if (
      updateTicketTypeDto.eventId &&
      updateTicketTypeDto.eventId !== ticketType.event.id
    ) {
      const nextEvent = await this.eventRepo.findOne({
        where: { id: updateTicketTypeDto.eventId },
        relations: ['organization'],
      });
      if (!nextEvent) {
        throw new BadRequestException('Event not found');
      }
      await this.assertCanManageEvent(nextEvent, currentUser);
      ticketType.event = nextEvent;
    }

    const { eventId, ...ticketTypeData } = updateTicketTypeDto;
    Object.assign(ticketType, ticketTypeData);
    const updated = await this.ticketTypeRepo.save(ticketType);

    return Response(
      200,
      'Ticket Type updated',
      plainToInstance(TicketTypeDto, updated, {
        excludeExtraneousValues: true,
      }),
    );
  }

  async remove(
    id: string,
    currentUser?: any,
  ): Promise<ApiResponse<{ id: string }>> {
    const ticketType = await this.ticketTypeRepo.findOne({
      where: { id },
      relations: ['event', 'event.organization', 'tickets'],
    });
    if (!ticketType) {
      throw new BadRequestException('Ticket Type not found');
    }
    await this.assertCanManageEvent(ticketType.event, currentUser);
    if ((ticketType.tickets || []).length > 0) {
      throw new BadRequestException(
        'Cannot delete ticket type that already has tickets',
      );
    }
    await this.ticketTypeRepo.remove(ticketType);
    return Response(200, 'Ticket Type deleted successfully', { id });
  }

  private async assertCanManageEvent(
    event: Event,
    currentUser?: any,
  ): Promise<void> {
    if (!currentUser || currentUser.role?.isSuperAdmin) {
      return;
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: currentUser.userId },
        organization: { id: event.organization.id },
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('User does not belong to this organization');
    }
  }
}
