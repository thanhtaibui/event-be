import { Column, Entity } from 'typeorm';
import { OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Order } from '../../order/entities/order.entity';
import { Membership } from '../../membership/entities/membership.entity';
import { Report } from '../../report/entities/report.entity';
import { Feedback } from '../../feedback/entities/feedback.entity';
import { RoleUser } from '../../../shared/enum/enum'

@Entity('users')
export class User extends BaseEntity {

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_delete', default: false })
  isDelete: boolean;

  @OneToMany(() => Membership, (membership) => membership.user)
  memberships: Membership[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Report, (report) => report.user)
  reports: Report[];

  @OneToMany(() => Feedback, (feedback) => feedback.user)
  feedbacks: Feedback[];

  @Column({ nullable: true })
  refreshToken: string;
}
