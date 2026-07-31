import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
  ) {}

  async create(createTicketDto: CreateTicketDto): Promise<ApiResponse<any>> {
    const user = await this.userRepo.findOne({
      where: { id: createTicketDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ticketType = await this.ticketTypeRepo.findOne({
      where: { id: createTicketDto.ticketTypeId },
      relations: ['event'],
    });

    if (!ticketType) {
      throw new NotFoundException('Ticket type not found');
    }

    const ticket = this.ticketRepo.create({
      user,
      ticketType,
    });

    const savedTicket = await this.ticketRepo.save(ticket);
    const result = await this.findTicketEntityById(savedTicket.id);

    return Response(201, 'Ticket created successfully', this.toTicketDto(result));
  }

  async findAll(): Promise<ApiResponse<any[]>> {
    console.time('GET_TICKETS');
    try {
      const tickets = await this.ticketRepo.find({
        relations: ['user', 'ticketType', 'ticketType.event'],
        order: { createdAt: 'DESC' },
      });

      return Response(
        200,
        'Get all tickets successfully',
        tickets.map((ticket) => this.toTicketDto(ticket)),
      );
    } finally {
      console.timeEnd('GET_TICKETS');
    }
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const timer = `GET_TICKET_BY_ID:${id}`;
    console.time(timer);
    try {
      const ticket = await this.findTicketEntityById(id);
      return Response(200, 'Get ticket successfully', this.toTicketDto(ticket));
    } finally {
      console.timeEnd(timer);
    }
  }

  update(id: number, updateTicketDto: UpdateTicketDto) {
    return `This action updates a #${id} ticket`;
  }

  remove(id: number) {
    return `This action removes a #${id} ticket`;
  }

  private async findTicketEntityById(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['user', 'ticketType', 'ticketType.event'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  private toTicketDto(ticket: Ticket) {
    return {
      id: ticket.id,
      createdAt: ticket.createdAt,
      user: {
        id: ticket.user?.id,
        fullName: ticket.user?.fullName,
        email: ticket.user?.email,
      },
      ticketType: {
        id: ticket.ticketType?.id,
        name: ticket.ticketType?.name,
        price: ticket.ticketType?.price,
      },
      event: ticket.ticketType?.event
        ? {
            id: ticket.ticketType.event.id,
            title: ticket.ticketType.event.title,
            startDateTime: ticket.ticketType.event.startDateTime,
            endDateTime: ticket.ticketType.event.endDateTime,
            place: ticket.ticketType.event.place,
          }
        : null,
    };
  }
}
