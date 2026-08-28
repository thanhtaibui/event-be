import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { NotificationType } from '../../../shared/enum/enum';

@Entity('notifications')
export class Notification extends BaseEntity {
  @ManyToOne(() => User, { nullable: false })
  user: User;

  @ManyToOne(() => Organization, { nullable: true })
  organization?: Organization | null;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;
}
