import { Entity, Column, ManyToOne } from 'typeorm';
import { Ticket } from '../../ticket/entities/ticket.entity';
import { BaseEntity } from '../../../shared/base/base.entity';

@Entity('items')
export class Item extends BaseEntity {

  @Column()
  name: string;

  @Column()
  price: number;

  @ManyToOne(() => Ticket, (ticket) => ticket.items)
  ticket: Ticket;
}