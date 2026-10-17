import { Column, Entity, Index, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Order } from './order.entity';
import { TicketType } from '../../ticket-type/entities/ticket-type.entity';

@Entity('order_items')
@Unique('UQ_order_items_order_ticket_type', ['order', 'ticketType'])
export class OrderItem extends BaseEntity {
  @Index()
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @ManyToOne(() => TicketType, { nullable: false })
  ticketType: TicketType;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;
}
