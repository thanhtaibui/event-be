import { BaseEntity } from '../../../shared/base/base.entity';
import { Order } from '../../order/entities/order.entity';
import { Column, Entity, ManyToOne, OneToMany } from "typeorm"
import { Event } from '../../event/entities/event.entity';
import { Ticket } from '../../ticket/entities/ticket.entity';
@Entity('ticketTypes')
export class TicketType extends BaseEntity {
  @Column()
  name: string; // VIP, STANDARD

  @Column()
  price: number;

  @Column()
  quantity: number;

  @ManyToOne(() => Event, (event) => event.ticketTypes)
  event: Event;

  @OneToMany(() => Ticket, (ticket) => ticket.ticketType)
  tickets: Ticket[];

  @ManyToOne(() => Order, (order) => order.ticketType)
  order: Order;
}
