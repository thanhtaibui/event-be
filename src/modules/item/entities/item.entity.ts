import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Event } from '../../event/entities/event.entity';
import { TicketTypeItem } from 'src/modules/ticket-type-item/entities/ticket-type-item.entity';

@Entity('items')
export class Item extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column()
  price: number;

  @ManyToOne(() => Event, (event) => event.items)
  event: Event;

  @OneToMany(() => TicketTypeItem, (tti) => tti.item)
  ticketItems?: TicketTypeItem[];
}
