import { Column, Entity, ManyToOne } from 'typeorm';
import { Event } from '../event/event.entity';
import { BaseEntity } from '../../../shared/base/base.entity';
import { User } from '../user/user.entity';
@Entity('event_posts')
export class EventPost extends BaseEntity {
    @Column({ type: 'text' })
    content: string;

    @ManyToOne(() => Event, (event) => event.posts, { onDelete: 'CASCADE' })
    event: Event;

    @ManyToOne(() => User, (user) => user.posts)
    user: User;
}