import { Entity, ManyToOne, Column, OneToMany } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Ticket } from '../../ticket/entities/ticket.entity';

@Entity('orders')
export class Order extends BaseEntity {
  @ManyToOne(() => User)
  user: User;

  @Column()
  totalPrice: number;

  @OneToMany(() => Ticket, (ticket) => ticket.order)
  tickets: Ticket[];
}
