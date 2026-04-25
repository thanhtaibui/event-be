
import { Entity, ManyToOne, Column, OneToMany } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { TicketType } from '../../ticket-type/entities/ticket-type.entity';
import { BaseEntity } from '../../../shared/base/base.entity';

@Entity('orders')
export class Order extends BaseEntity {

  @ManyToOne(() => User)
  user: User;

  @Column()
  totalPrice: number;

  @OneToMany(() => TicketType, (ticketType) => ticketType.order, { cascade: true })
  ticketType: TicketType[];
}
