import { Role } from "src/modules/role/entities/role.entity";
import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToMany } from "typeorm";
import { BaseEntity } from '../../../shared/base/base.entity';
@Entity('permissions')
export class Permission extends BaseEntity {

  @Column({ unique: true })
  permission_code: string;

  @Column()
  permission_name: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];

  @ManyToOne(() => Permission, (permission) => permission.children, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "parent_id" })
  parent: Permission;

  @OneToMany(() => Permission, (permission) => permission.parent)
  children: Permission[];
}
