import { Item } from "src/modules/item/entities/item.entity";
import { TicketType } from "src/modules/ticket-type/entities/ticket-type.entity";
import { BaseEntity } from "src/shared/base/base.entity";
import { Column, Entity, ManyToOne } from "typeorm";

@Entity('ticket_type_items')
export class TicketTypeItem extends BaseEntity {

  @Column({ default: false })
  isGift: boolean; // true = tặng, false = mua

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @ManyToOne(() => TicketType, (type) => type.ticketItems, { onDelete: 'CASCADE' })
  ticketType: TicketType;

  @ManyToOne(() => Item, (item) => item.ticketItems, { onDelete: 'CASCADE' })
  item: Item;

}