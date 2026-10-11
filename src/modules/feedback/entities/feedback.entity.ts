import { Entity, Column, ManyToOne, Unique, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Event } from '../../event/entities/event.entity';
import { BaseEntity } from '../../../shared/base/base.entity';

@Entity('feedbacks')
@Unique(['user', 'event'])
export class Feedback extends BaseEntity {
  @Column()
  userId: string;

  @Column()
  eventId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ nullable: true })
  rating?: number;

  @Column({ type: 'varchar', length: 1000 })
  comment: string;
}
