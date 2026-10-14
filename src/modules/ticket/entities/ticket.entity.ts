import { BaseEntity } from '../../../shared/base/base.entity';
import { Column, Entity, ManyToOne } from 'typeorm';
import { TicketType } from '../../ticket-type/entities/ticket-type.entity';
import { User } from '../../user/entities/user.entity';
import { Order } from '../../order/entities/order.entity';
import { TicketStatus } from '../../../shared/enum/enum';
@Entity('tickets')
export class Ticket extends BaseEntity {
  @ManyToOne(() => TicketType, (type) => type.tickets)
  ticketType: TicketType;

  @ManyToOne(() => User, (user) => user.tickets)
  user: User;

  @ManyToOne(() => Order, (order) => order.tickets, { nullable: true })
  order: Order;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.VALID,
  })
  status: TicketStatus;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;
}
