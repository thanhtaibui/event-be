import { Entity, ManyToOne, Column, OneToMany, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Ticket } from '../../ticket/entities/ticket.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatus } from '../../../shared/enum/enum';

@Entity('orders')
export class Order extends BaseEntity {
  @ManyToOne(() => User)
  user: User;

  @Column()
  totalPrice: number;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  organization: Organization;

  @Index()
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PAID })
  status: OrderStatus;

  @Index()
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => Ticket, (ticket) => ticket.order)
  tickets: Ticket[];
}
