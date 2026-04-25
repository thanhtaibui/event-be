import { Entity, Column, ManyToOne, Unique } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Event } from '../../event/entities/event.entity';
import { BaseEntity } from '../../../shared/base/base.entity';

@Entity('feedbacks')
@Unique(['user', 'event'])
export class Feedback extends BaseEntity {

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Event)
  event: Event;

  @Column()
  rating: number;

  @Column({ nullable: true })
  comment: string;

}