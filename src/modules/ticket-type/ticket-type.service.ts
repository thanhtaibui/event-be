import {
  BadGatewayException,
  BadRequestException,
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
const LOCKED_STATUSES = [EventStatus.ENDED, EventStatus.CANCELLED];

@Injectable()
export class TicketTypeService {
  constructor(
    @InjectRepository(TicketType)
    private ticketTypeRepo: Repository<TicketType>,
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
  ) {}

  async create(
    createTicketTypeDto: CreateTicketTypeDto,
  ): Promise<ApiResponse<TicketTypeDto>> {
    const event = await this.eventRepo.findOne({
      where: { id: createTicketTypeDto.eventId },
      relations: ['ticketTypes'],
    });
    if (!event) throw new BadRequestException('Event not found');
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

  findAll() {
    return `This action returns all ticketType`;
  }

  async findOne(id: string): Promise<ApiResponse<TicketTypeDto>> {
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
  }

  async update(
    id: string,
    updateTicketTypeDto: UpdateTicketTypeDto,
  ): Promise<ApiResponse<TicketTypeDto>> {
    const ticketType = await this.ticketTypeRepo.findOne({
      where: { id },
      relations: ['event'],
    });
    if (!ticketType) throw new BadRequestException('Ticket Type not found');
    if (LOCKED_STATUSES.includes(ticketType.event.status)) {
      throw new BadRequestException(
        `Cannot update ticket type when status is ${ticketType.event.status}`,
      );
    }

    Object.assign(ticketType, updateTicketTypeDto);
    const updated = await this.ticketTypeRepo.save(ticketType);

    return Response(
      200,
      'Ticket Type updated',
      plainToInstance(TicketTypeDto, updated, {
        excludeExtraneousValues: true,
      }),
    );
  }

  remove(id: number) {
    return `This action removes a #${id} ticketType`;
  }
}
