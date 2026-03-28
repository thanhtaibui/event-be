import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OneToMany } from 'typeorm';
import { Event } from '../event/event.entity';
import { UserRole } from '../userRole/userRole.entity';
import { EventInvitation } from '../eventInvitation/eventInvitation.entity';
import { BaseEntity } from '../../../shared/base/base.entity';
import { EventPost } from '../eventPost/eventPost.entity';
import { Participant } from '../participant/participant.entity';
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
