import { ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Role } from "../../role/entities/role.entity";
import { Column, Entity } from "typeorm";
import { BaseEntity } from '../../../shared/base/base.entity';

@Entity('user_roles')
export class UserRole extends BaseEntity {

    @ManyToOne(() => User, (user) => user.userRoles)
    user: User;

    @ManyToOne(() => Role, (role) => role.userRoles)
    role: Role;

}