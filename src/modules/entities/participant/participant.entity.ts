import {
    Entity,
    PrimaryGeneratedColumn,
    ManyToOne,
    CreateDateColumn,
    Unique,
    Column,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Event } from '../event/event.entity';
import { BaseEntity } from '../../../shared/base/base.entity';
@Entity('participants')
@Unique(['user', 'event']) // 1 user chỉ join 1 event 1 lần
export class Participant extends BaseEntity {


    @ManyToOne(() => User, (user) => user.participants, {
        onDelete: 'CASCADE',
    })
    user: User;

    @ManyToOne(() => Event, (event) => event.participants, {
        onDelete: 'CASCADE',
    })
    event: Event;

    @Column({ default: 'attendee' })
    role: string;

    @CreateDateColumn()
    joinedAt: Date;
}