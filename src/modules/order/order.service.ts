import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<ApiResponse<any>> {
    const user = await this.userRepo.findOne({
      where: { id: createOrderDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ticketTypeIds = createOrderDto.items.map((item) => item.ticketTypeId);
    const uniqueTicketTypeIds = [...new Set(ticketTypeIds)];
    const ticketTypes = await this.ticketTypeRepo.find({
      where: { id: In(uniqueTicketTypeIds) },
      relations: ['event'],
    });

    if (ticketTypes.length !== uniqueTicketTypeIds.length) {
      throw new NotFoundException('Some ticket types not found');
    }

    const ticketTypeMap = new Map(
      ticketTypes.map((ticketType) => [ticketType.id, ticketType]),
    );

    const totalPrice = createOrderDto.items.reduce((total, item) => {
      const ticketType = ticketTypeMap.get(item.ticketTypeId);
      if (!ticketType) {
        throw new BadRequestException('Invalid ticket type');
      }
      return total + ticketType.price * item.quantity;
    }, 0);

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        user,
        totalPrice,
      }),
    );

    const tickets = createOrderDto.items.flatMap((item) => {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      return Array.from({ length: item.quantity }, () =>
        this.ticketRepo.create({
          user,
          ticketType,
          order,
        }),
      );
    });

    await this.ticketRepo.save(tickets);

    const savedOrder = await this.findOrderEntityById(order.id);
    return Response(201, 'Order created successfully', this.toOrderDto(savedOrder));
  }

  async findAll(): Promise<ApiResponse<any[]>> {
    console.time('GET_ORDERS');
    try {
      const orders = await this.orderRepo.find({
        relations: [
          'user',
          'tickets',
          'tickets.ticketType',
          'tickets.ticketType.event',
        ],
        order: { createdAt: 'DESC' },
      });

      return Response(
        200,
        'Get all orders successfully',
        orders.map((order) => this.toOrderDto(order)),
      );
    } finally {
      console.timeEnd('GET_ORDERS');
    }
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const timer = `GET_ORDER_BY_ID:${id}`;
    console.time(timer);
    try {
      const order = await this.findOrderEntityById(id);
      return Response(200, 'Get order successfully', this.toOrderDto(order));
    } finally {
      console.timeEnd(timer);
    }
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }

  private async findOrderEntityById(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['user', 'tickets', 'tickets.ticketType', 'tickets.ticketType.event'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  private toOrderDto(order: Order) {
    return {
      id: order.id,
      totalPrice: order.totalPrice,
      createdAt: order.createdAt,
      user: {
        id: order.user?.id,
        fullName: order.user?.fullName,
        email: order.user?.email,
      },
      tickets: (order.tickets || []).map((ticket) => ({
        id: ticket.id,
        createdAt: ticket.createdAt,
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
      })),
    };
  }
}
