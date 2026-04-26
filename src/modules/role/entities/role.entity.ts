import { Column, Entity, OneToMany, ManyToMany, JoinTable, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Membership } from '../../membership/entities/membership.entity';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Permission } from '../../permission/entities/permission.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('roles')
@Unique(["role_code", "organization", "isDelete"])
export class Role extends BaseEntity {
  @Column()
  role_name: string;

  @Column()
  role_code: string;

  @OneToMany(() => Membership, (m) => m.role)
  memberships: Membership[];

  @ManyToMany(() => Permission, (p) => p.roles)
  @JoinTable({
    name: 'role_permissions',
  })
  permissions: Permission[];

  @ManyToOne(() => Organization, (org) => org.roles, { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ nullable: true })
  colorKey?: string;

  @Column({ type: 'boolean', name: 'is_delete', default: false })
  isDelete: boolean;
}
