import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { EventStatus } from 'src/shared/enum/enum';
import { Event } from '../event/entities/event.entity';

const PURCHASABLE_EVENT_STATUSES = [
  EventStatus.PUBLISHED,
  EventStatus.UPCOMING,
  EventStatus.ONGOING,
];

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
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
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

    const requestedQuantityByTicketTypeId = new Map<string, number>();
    for (const item of createOrderDto.items) {
      requestedQuantityByTicketTypeId.set(
        item.ticketTypeId,
        (requestedQuantityByTicketTypeId.get(item.ticketTypeId) || 0) +
          item.quantity,
      );
    }

    await this.validateTicketTypesCanBePurchased(
      ticketTypes,
      requestedQuantityByTicketTypeId,
    );

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
    return Response(
      201,
      'Order created successfully',
      this.toOrderDto(savedOrder),
    );
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
      relations: [
        'user',
        'tickets',
        'tickets.ticketType',
        'tickets.ticketType.event',
      ],
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

  private async validateTicketTypesCanBePurchased(
    ticketTypes: TicketType[],
    requestedQuantityByTicketTypeId: Map<string, number>,
  ): Promise<void> {
    const now = new Date();

    for (const ticketType of ticketTypes) {
      if (!ticketType.event) {
        throw new BadRequestException('Ticket type does not belong to an event');
      }

      await this.syncEventStatus(ticketType.event, now);

      if (!PURCHASABLE_EVENT_STATUSES.includes(ticketType.event.status)) {
        throw new BadRequestException(
          `Cannot buy ticket when event status is ${ticketType.event.status}`,
        );
      }

      if (ticketType.event.registrationEndDate < now) {
        throw new BadRequestException('Event registration time has expired');
      }

      if (ticketType.event.endDateTime <= now) {
        throw new BadRequestException('Event has ended');
      }

      const requestedQuantity =
        requestedQuantityByTicketTypeId.get(ticketType.id) || 0;
      const soldQuantity = await this.ticketRepo.count({
        where: { ticketType: { id: ticketType.id } },
      });
      const availableQuantity = ticketType.quantity - soldQuantity;

      if (requestedQuantity > availableQuantity) {
        throw new BadRequestException(
          `Only ${availableQuantity} tickets left for ${ticketType.name}`,
        );
      }
    }
  }

  private async syncEventStatus(event: Event, now: Date): Promise<void> {
    if (
      [
        EventStatus.CANCELLED,
        EventStatus.POSTPONED,
        EventStatus.DRAFT,
      ].includes(event.status)
    ) {
      return;
    }

    let nextStatus = event.status;

    if (event.endDateTime <= now) {
      nextStatus = EventStatus.ENDED;
    } else if (event.startDateTime <= now) {
      nextStatus = EventStatus.ONGOING;
    } else {
      nextStatus = EventStatus.UPCOMING;
    }

    if (nextStatus !== event.status) {
      event.status = nextStatus;
      await this.eventRepo.update(event.id, { status: nextStatus });
    }
  }
}
