import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createOrderDto: CreateOrderDto,
    currentUserId?: string,
  ): Promise<ApiResponse<any>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let orderId = '';
    try {
      const manager = queryRunner.manager;
      const user = await manager.findOne(User, {
        where: { id: currentUserId || createOrderDto.userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const ticketTypeIds = createOrderDto.items.map(
        (item) => item.ticketTypeId,
      );
      const uniqueTicketTypeIds = [...new Set(ticketTypeIds)];
      const ticketTypes = await manager
        .getRepository(TicketType)
        .createQueryBuilder('ticketType')
        .setLock('pessimistic_write')
        .innerJoinAndSelect('ticketType.event', 'event')
        .where('ticketType.id IN (:...ticketTypeIds)', {
          ticketTypeIds: uniqueTicketTypeIds,
        })
        .getMany();

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

      const soldQuantityByTicketTypeId =
        await this.getSoldQuantityByTicketTypeIds(
          uniqueTicketTypeIds,
          manager,
        );

      await this.validateTicketTypesCanBePurchased(
        ticketTypes,
        requestedQuantityByTicketTypeId,
        soldQuantityByTicketTypeId,
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

      const order = manager.create(Order, {
        user,
        totalPrice,
      });
      const savedOrder = await manager.save(Order, order);
      orderId = savedOrder.id;

      const tickets = createOrderDto.items.flatMap((item) => {
        const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
        return Array.from({ length: item.quantity }, () =>
          manager.create(Ticket, {
            user,
            ticketType,
            order: savedOrder,
          }),
        );
      });

      await manager.save(Ticket, tickets);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const savedOrder = await this.findOrderEntityById(orderId!);
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

  async findOne(id: string, currentUser?: any): Promise<ApiResponse<any>> {
    const timer = `GET_ORDER_BY_ID:${id}`;
    console.time(timer);
    try {
      const order = await this.findOrderEntityById(id);
      this.assertCanAccessOrder(order, currentUser);
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

  private assertCanAccessOrder(order: Order, currentUser?: any): void {
    if (!currentUser || currentUser.role?.isSuperAdmin) {
      return;
    }

    if (order.user?.id === currentUser.userId) {
      return;
    }

    throw new ForbiddenException('You do not have permission to access order');
  }

  private async validateTicketTypesCanBePurchased(
    ticketTypes: TicketType[],
    requestedQuantityByTicketTypeId: Map<string, number>,
    soldQuantityByTicketTypeId: Map<string, number>,
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
      const soldQuantity = soldQuantityByTicketTypeId.get(ticketType.id) || 0;
      const availableQuantity = ticketType.quantity - soldQuantity;

      if (requestedQuantity > availableQuantity) {
        throw new BadRequestException(
          `Only ${availableQuantity} tickets left for ${ticketType.name}`,
        );
      }
    }
  }

  private async getSoldQuantityByTicketTypeIds(
    ticketTypeIds: string[],
    manager?: EntityManager,
  ): Promise<Map<string, number>> {
    if (ticketTypeIds.length === 0) {
      return new Map();
    }

    const ticketRepo = manager
      ? manager.getRepository(Ticket)
      : this.ticketRepo;

    const rows = await ticketRepo
      .createQueryBuilder('ticket')
      .leftJoin('ticket.ticketType', 'ticketType')
      .select('ticketType.id', 'ticketTypeId')
      .addSelect('COUNT(ticket.id)', 'soldQuantity')
      .where('ticketType.id IN (:...ticketTypeIds)', { ticketTypeIds })
      .groupBy('ticketType.id')
      .getRawMany<{ ticketTypeId: string; soldQuantity: string }>();

    return new Map(
      rows.map((row) => [row.ticketTypeId, Number(row.soldQuantity)]),
    );
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
