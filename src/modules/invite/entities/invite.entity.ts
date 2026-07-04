import { BaseEntity } from '../../../shared/base/base.entity';
import { Column, Entity, ManyToOne } from 'typeorm';
import { Event } from '../../event/entities/event.entity';
import { InvitationStatus } from '../../../shared/enum/enum';
@Entity('invites')
export class Invite extends BaseEntity {
  @Column()
  emailInvite: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: 'pending',
  })
  status: InvitationStatus;

  @ManyToOne(() => Event, (event) => event.invites)
  event: Event;

  @Column({ unique: true })
  token: string;

  @Column({ nullable: true })
  message?: string;
}
