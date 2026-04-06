import { Column, ManyToOne, OneToMany, PrimaryGeneratedColumn, Entity } from "typeorm";
import { User } from "../../user/entities/user.entity";
import { CreateDateColumn, UpdateDateColumn } from "typeorm";
import { EventPost } from "../../event-post/entities/eventPost.entity";
import { EventInvitation } from "../../event-invitation/entities/eventInvitation.entity";
import { BaseEntity } from '../../../shared/base/base.entity';
import { Participant } from "../../participant/entities/participant.entity";
import { EventStatus } from "../../../shared/enum/enum";
@Entity('events')
export class Event extends BaseEntity {

    @Column()
    name: string;

    @Column()
    description: string

    @Column()
    place: string;

    @Column()
    startDateTime: Date;

    @Column()
    endDateTime: Date;

    @Column()
    registrationEndDate: Date;

    @Column()
    capacity: number;

    @Column()
    price: number;

    @Column()
    isPublic: boolean;

    @Column()
    status: EventStatus; //enum add sau

    @ManyToOne(() => User, (user) => user.events)
    createdBy: User;

    @OneToMany(() => EventPost, (post) => post.event)
    posts: EventPost[];

    @OneToMany(() => EventInvitation, (inv) => inv.event)
    invitations: EventInvitation[];

    @OneToMany(() => Participant, (participant) => participant.event)
    participants: Participant[];
}