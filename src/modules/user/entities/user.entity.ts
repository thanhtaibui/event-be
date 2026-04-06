import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OneToMany } from 'typeorm';
import { Event } from '../../event/entities/event.entity';
import { UserRole } from '../../user-role/entities/userRole.entity';
import { EventInvitation } from '../../event-invitation/entities/eventInvitation.entity';
import { BaseEntity } from '../../../shared/base/base.entity';
import { EventPost } from '../../event-post/entities/eventPost.entity';
import { Participant } from '../../participant/entities/participant.entity';
@Entity('users')
export class User extends BaseEntity {

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column()
    fullName: string;

    @Column({ nullable: true })
    phoneNumber: Number;

    @Column({ nullable: true })
    bio: string;

    @Column({ default: true })
    isActive: boolean;

    @OneToMany(() => Event, (event) => event.createdBy)
    events: Event[];

    @OneToMany(() => UserRole, (ur) => ur.user)
    userRoles: UserRole[];

    @OneToMany(() => EventInvitation, (inv) => inv.user)
    invitations: EventInvitation[];

    @OneToMany(() => EventPost, (post) => post.user)
    posts: EventPost[];

    @OneToMany(() => Participant, (participant) => participant.user)
    participants: Participant[];
}
