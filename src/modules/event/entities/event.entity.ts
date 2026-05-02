import { Column, ManyToOne, OneToMany, Entity } from "typeorm";
import { BaseEntity } from '../../../shared/base/base.entity';
import { EventStatus } from "../../../shared/enum/enum";
import { Organization } from '../../organization/entities/organization.entity';
import { TicketType } from '../../ticket-type/entities/ticket-type.entity';
import { Invite } from '../../invite/entities/invite.entity';
@Entity('events')
export class Event extends BaseEntity {

  @Column()
  title: string;

  @Column({ nullable: true })
  eventPoster: string;

  @Column()
  description: string

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

  @Column()
  isPublic: boolean;

  @Column({
    type: 'enum',
    enum: EventStatus,
  })
  status: EventStatus;

  @ManyToOne(() => Organization, (org) => org.events)
  organization: Organization;

  @OneToMany(() => TicketType, (type) => type.event)
  ticketTypes: TicketType[];

  @OneToMany(() => Invite, (invite) => invite.event)
  invites: Invite[];
}