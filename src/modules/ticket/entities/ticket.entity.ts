import { BaseEntity } from '../../../shared/base/base.entity';
import { Entity, ManyToOne, OneToMany } from 'typeorm';
import { TicketType } from '../../ticket-type/entities/ticket-type.entity';
import { User } from '../../user/entities/user.entity';
@Entity('tickets')
export class Ticket extends BaseEntity {
  @ManyToOne(() => TicketType, (type) => type.tickets)
  ticketType: TicketType;

  @ManyToOne(() => User, (user) => user.tickets)
  user: User;
}
