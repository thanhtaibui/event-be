import { Column, ManyToOne, OneToMany, PrimaryGeneratedColumn, Entity } from "typeorm";
import { User } from "../user/user.entity";
import { CreateDateColumn, UpdateDateColumn } from "typeorm";
import { EventPost } from "../eventPost/eventPost.entity";
import { EventInvitation } from "../eventInvitation/eventInvitation.entity";
import { BaseEntity } from '../../../shared/base/base.entity';
import { Participant } from "../participant/participant.entity";
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