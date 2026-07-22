import {
  Column,
  ManyToOne,
  OneToMany,
  Entity,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { EventStatus } from '../../../shared/enum/enum';
import { Organization } from '../../organization/entities/organization.entity';
import { TicketType } from '../../ticket-type/entities/ticket-type.entity';
import { Invite } from '../../invite/entities/invite.entity';
import { Item } from 'src/modules/item/entities/item.entity';
import { Category } from 'src/modules/category/entities/category.entity';
@Entity('events')
export class Event extends BaseEntity {
  @Column()
  title: string;

  @Column({ nullable: true })
  eventPoster: string;

  @Column({ nullable: true })
  eventBanner: string;

  @Column()
  description: string;

  @Column()
  place: string;

  @Column()
  startDateTime: Date;

  @Column()
  endDateTime: Date;

  @Column()
  registrationEndDate: Date;

  @Column()
  capacity: number;

  // @Column()
  // price: number;

  @Column({ default: false })
  isPublic: boolean;

  @Column({
    type: 'enum',
    enum: EventStatus,
  })
  status: EventStatus;

  @ManyToOne(() => Organization, (org) => org.events)
  organization: Organization;

  @ManyToMany(() => Category, (category) => category.events)
  @JoinTable({
    name: 'event_categories',
    joinColumn: { name: 'eventId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories: Category[];

  @OneToMany(() => TicketType, (type) => type.event)
  ticketTypes: TicketType[];

  @OneToMany(() => Invite, (invite) => invite.event)
  invites: Invite[];

  @OneToMany(() => Item, (item) => item.event)
  items: Item[];
}
