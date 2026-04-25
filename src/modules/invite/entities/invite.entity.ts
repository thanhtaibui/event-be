import { BaseEntity } from '../../../shared/base/base.entity';
import { Column, Entity, ManyToOne } from "typeorm"
import { Event } from '../../event/entities/event.entity';
import { InvitationStatus } from "../../../shared/enum/enum"
@Entity('invites')
export class Invite extends BaseEntity {
  @Column()
  emailInvite: string;

  @Column({ default: 'PENDING' })
  status: InvitationStatus;

  @ManyToOne(() => Event, (event) => event.invites)
  event: Event;


}
