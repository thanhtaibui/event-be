
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Role } from '../../role/entities/role.entity';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Entity, ManyToOne, Column, ManyToMany, JoinTable, JoinColumn } from 'typeorm';

@Entity('memberships')
export class Membership extends BaseEntity {
  @ManyToOne(() => User, (user) => user.memberships)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => Role, (role) => role.memberships)
  role: Role;

  @Column({ default: true })
  isActive: boolean;

}
