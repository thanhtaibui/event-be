import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { CreateDateColumn, UpdateDateColumn } from "typeorm";
import { ManyToOne } from "typeorm";
import { Event } from "../event/event.entity";
import { User } from "../user/user.entity";
import { BaseEntity } from '../../../shared/base/base.entity';
import { InvitationStatus } from "../../../shared/enum/enum";
@Entity('event_invitations')
export class EventInvitation extends BaseEntity {

    @Column()
    inviteeEmail: string;

    @Column({ nullable: true })
    message: string;

    @Column({ nullable: true })
    responseAt: Date;

    @Column()
    status: InvitationStatus;

    @ManyToOne(() => Event, (event) => event.invitations, { onDelete: 'CASCADE' })
    event: Event;

    @ManyToOne(() => User, (user) => user.invitations)
    user: User;

    @ManyToOne(() => User)
    invitedBy: User;

}