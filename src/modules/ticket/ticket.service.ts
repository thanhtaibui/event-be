import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { Membership } from '../membership/entities/membership.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
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
      relations: ['event', 'event.organization'],
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

  async findOne(id: string, currentUser?: any): Promise<ApiResponse<any>> {
    const timer = `GET_TICKET_BY_ID:${id}`;
    console.time(timer);
    try {
      const ticket = await this.findTicketEntityById(id);
      await this.assertCanAccessTicket(ticket, currentUser);
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
      relations: [
        'user',
        'ticketType',
        'ticketType.event',
        'ticketType.event.organization',
      ],
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

  private async assertCanAccessTicket(
    ticket: Ticket,
    currentUser?: any,
  ): Promise<void> {
    if (!currentUser || currentUser.role?.isSuperAdmin) {
      return;
    }

    if (ticket.user?.id === currentUser.userId) {
      return;
    }

    const orgId = ticket.ticketType?.event?.organization?.id;
    if (orgId) {
      const membership = await this.membershipRepo.findOne({
        where: {
          user: { id: currentUser.userId },
          organization: { id: orgId },
          isActive: true,
        },
      });

      if (membership) {
        return;
      }
    }

    throw new ForbiddenException('You do not have permission to access ticket');
  }
}
