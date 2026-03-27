import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OneToMany } from 'typeorm';
import { Event } from '../event/event.entity';
import { EventParticipant } from '../event-participant/event-participant.entity';
import { UserRole } from '../user-role/user-role.entity';
@Entity('users')
export class UserEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column()
    fullName: string;

    @OneToMany(() => Event, (event) => event.createdBy)
    events: Event[];

    @OneToMany(() => EventParticipant, (ep) => ep.user)
    participants: EventParticipant[];

    @OneToMany(() => UserRole, (ur) => ur.user)
    userRoles: UserRole[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
