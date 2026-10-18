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
import {
  Brackets,
  DataSource,
  EntityManager,
  In,
  LessThan,
  Repository,
} from 'typeorm';
import { User } from '../user/entities/user.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import {
  EventStatus,
  OrderStatus,
  OrganizationStatus,
} from 'src/shared/enum/enum';
import { Event } from '../event/entities/event.entity';
import { OrderItem } from './entities/order-item.entity';
import {
  PaymentWebhookReceipt,
  PaymentWebhookReceiptStatus,
} from '../payment/entities/payment-webhook-receipt.entity';

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

    const orderIds: string[] = [];
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
      const uniqueTicketTypeIds = [...new Set(ticketTypeIds)].sort();
      const ticketTypes = await manager
        .getRepository(TicketType)
        .createQueryBuilder('ticketType')
        .setLock('pessimistic_write')
        .innerJoinAndSelect('ticketType.event', 'event')
        .innerJoinAndSelect('event.organization', 'organization')
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
        await this.getSoldQuantityByTicketTypeIds(uniqueTicketTypeIds, manager);
      const reservedQuantityByTicketTypeId =
        await this.getReservedQuantityByTicketTypeIds(
          uniqueTicketTypeIds,
          manager,
        );

      await this.validateTicketTypesCanBePurchased(
        ticketTypes,
        requestedQuantityByTicketTypeId,
        soldQuantityByTicketTypeId,
        reservedQuantityByTicketTypeId,
      );

      const ticketTypeMap = new Map(
        ticketTypes.map((ticketType) => [ticketType.id, ticketType]),
      );

      const groups = new Map<string, typeof createOrderDto.items>();
      for (const item of createOrderDto.items) {
        const ticketType = ticketTypeMap.get(item.ticketTypeId);
        const organization = ticketType?.event?.organization;
        if (!ticketType || !organization) {
          throw new BadRequestException(
            'Ticket type has no valid organization',
          );
        }
        if (organization.status !== OrganizationStatus.ACTIVE) {
          throw new BadRequestException('Organization cannot receive orders');
        }
        groups.set(organization.id, [
          ...(groups.get(organization.id) || []),
          item,
        ]);
      }

      const expiresAt = new Date(
        Date.now() + this.getPaymentExpiryMinutes() * 60_000,
      );
      for (const [organizationId, groupItems] of groups) {
        const quantities = new Map<string, number>();
        for (const item of groupItems) {
          quantities.set(
            item.ticketTypeId,
            (quantities.get(item.ticketTypeId) || 0) + item.quantity,
          );
        }
        const orderLines = Array.from(
          quantities,
          ([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }),
        );
        const totalPrice = orderLines.reduce((total, item) => {
          const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
          return total + Number(ticketType.price) * item.quantity;
        }, 0);
        if (!Number.isSafeInteger(totalPrice) || totalPrice <= 0) {
          throw new BadRequestException(
            'Order total must be a positive integer in VND',
          );
        }
        const savedOrder = await manager.save(
          Order,
          manager.create(Order, {
            user,
            organization: { id: organizationId } as any,
            totalPrice,
            status: OrderStatus.PENDING_PAYMENT,
            expiresAt,
          }),
        );
        orderIds.push(savedOrder.id);
        await manager.save(
          OrderItem,
          orderLines.map((item) => {
            const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
            return manager.create(OrderItem, {
              order: savedOrder,
              ticketType,
              quantity: item.quantity,
              unitPrice: Number(ticketType.price),
            });
          }),
        );
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const savedOrders = await Promise.all(
      orderIds.map((id) => this.findOrderEntityById(id)),
    );
    return Response(
      201,
      'Order created successfully',
      savedOrders.length === 1
        ? this.toOrderDto(savedOrders[0])
        : { orders: savedOrders.map((order) => this.toOrderDto(order)) },
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
          'items',
          'items.ticketType',
          'organization',
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
        'items',
        'items.ticketType',
        'organization',
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status === OrderStatus.PENDING_PAYMENT &&
      order.expiresAt &&
      order.expiresAt <= new Date()
    ) {
      order.status = OrderStatus.EXPIRED;
      await this.orderRepo.save(order);
    }

    return order;
  }

  private toOrderDto(order: Order) {
    return {
      id: order.id,
      totalPrice: order.totalPrice,
      status: order.status,
      expiresAt: order.expiresAt,
      organization: order.organization
        ? { id: order.organization.id, name: order.organization.name }
        : null,
      createdAt: order.createdAt,
      user: {
        id: order.user?.id,
        fullName: order.user?.fullName,
        email: order.user?.email,
      },
      tickets: (order.tickets || []).map((ticket) => ({
        id: ticket.id,
        createdAt: ticket.createdAt,
        status: ticket.status,
        usedAt: ticket.usedAt ?? null,
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
      items: (order.items || []).map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        ticketType: item.ticketType
          ? { id: item.ticketType.id, name: item.ticketType.name }
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
    reservedQuantityByTicketTypeId: Map<string, number>,
  ): Promise<void> {
    const now = new Date();

    for (const ticketType of ticketTypes) {
      if (!ticketType.event) {
        throw new BadRequestException(
          'Ticket type does not belong to an event',
        );
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
      const reservedQuantity =
        reservedQuantityByTicketTypeId.get(ticketType.id) || 0;
      const availableQuantity =
        ticketType.quantity - soldQuantity - reservedQuantity;

      if (requestedQuantity > availableQuantity) {
        throw new BadRequestException(
          `Only ${availableQuantity} tickets left for ${ticketType.name}`,
        );
      }
    }
  }

  private async getReservedQuantityByTicketTypeIds(
    ticketTypeIds: string[],
    manager: EntityManager,
  ): Promise<Map<string, number>> {
    if (!ticketTypeIds.length) return new Map();
    const now = new Date();
    const reconciliationOrders = manager
      .createQueryBuilder()
      .subQuery()
      .select('receipt.orderId')
      .from(PaymentWebhookReceipt, 'receipt')
      .where('receipt.status IN (:...reconciliationStatuses)')
      .getQuery();
    await manager
      .getRepository(Order)
      .update(
        { status: OrderStatus.PENDING_PAYMENT, expiresAt: LessThan(now) },
        { status: OrderStatus.EXPIRED },
      );
    const rows = await manager
      .getRepository(OrderItem)
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.ticketType', 'ticketType')
      .select('ticketType.id', 'ticketTypeId')
      .addSelect('SUM(item.quantity)', 'reservedQuantity')
      .where('ticketType.id IN (:...ticketTypeIds)', { ticketTypeIds })
      .andWhere(
        new Brackets((query) => {
          query
            .where('(order.status = :status AND order.expiresAt > :now)', {
              status: OrderStatus.PENDING_PAYMENT,
              now,
            })
            .orWhere(
              `(order.status != :paidStatus AND order.id IN ${reconciliationOrders})`,
              {
                reconciliationStatuses: [
                  PaymentWebhookReceiptStatus.RECEIVED,
                  PaymentWebhookReceiptStatus.RECONCILIATION_REQUIRED,
                ],
                paidStatus: OrderStatus.PAID,
              },
            );
        }),
      )
      .groupBy('ticketType.id')
      .getRawMany<{ ticketTypeId: string; reservedQuantity: string }>();
    return new Map(
      rows.map((row) => [row.ticketTypeId, Number(row.reservedQuantity)]),
    );
  }

  private getPaymentExpiryMinutes(): number {
    const configured = Number(process.env.PAYMENT_EXPIRY_MINUTES);
    return Number.isInteger(configured) && configured > 0 && configured <= 1440
      ? configured
      : 15;
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
