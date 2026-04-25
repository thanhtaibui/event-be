import { Entity } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Column, OneToMany, ManyToOne } from 'typeorm'
import { Event } from '../../event/entities/event.entity';
import { Membership } from '../../membership/entities/membership.entity';
import { User } from '../../user/entities/user.entity';
import { Role } from '../../role/entities/role.entity';
import { OrgRequestStatus } from 'src/shared/enum/enum';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  bio: string;

  @OneToMany(() => Event, (event) => event.organization)
  events: Event[];

  @OneToMany(() => Membership, (membership) => membership.organization)
  memberships: Membership[];

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true })
  owner: User;

  @Column({ nullable: true })
  Slug: string;

  @OneToMany(() => Role, (role) => role.organization)
  roles: Role[];

  @Column({
    type: 'enum',
    enum: OrgRequestStatus,
    default: OrgRequestStatus.PENDING,
  })
  status: OrgRequestStatus;

}
