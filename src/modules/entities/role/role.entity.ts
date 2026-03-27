import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('roles')
export class RoleEntity {
    @PrimaryGeneratedColumn();
    id: number;

    @Column()
    name: string;

    @Column()
    description: string;
}