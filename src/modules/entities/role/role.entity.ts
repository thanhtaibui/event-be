import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../userRole/userRole.entity';
import { BaseEntity } from '../../../shared/base/base.entity';

@Entity('roles')
export class Role extends BaseEntity {

    @Column()
    name: string;

    @Column()
    description: string;

    @OneToMany(() => UserRole, (ur) => ur.role)
    userRoles: UserRole[];
}