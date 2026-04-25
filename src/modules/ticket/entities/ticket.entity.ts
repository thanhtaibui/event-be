import { BaseEntity } from '../../../shared/base/base.entity';
import { Entity, ManyToOne, OneToMany } from 'typeorm'
import { TicketType } from '../../ticket-type/entities/ticket-type.entity';
import { Item } from "../../item/entities/item.entity"
@Entity('tickets')
export class Ticket extends BaseEntity {

  @OneToMany(() => Item, (items) => items.ticket)
  items: Item[];

  @ManyToOne(() => TicketType, (type) => type.tickets)
  ticketType: TicketType;
}
