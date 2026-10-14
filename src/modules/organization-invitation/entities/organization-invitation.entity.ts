import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { OrganizationInvitationStatus } from '../../../shared/enum/enum';
import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../user/entities/user.entity';

@Entity('organization_invitations')
@Index(['organization', 'email', 'status'])
export class OrganizationInvitation extends BaseEntity {
  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  email: string;

  @Column()
  role: string;

  @Column({
    type: 'enum',
    enum: OrganizationInvitationStatus,
    default: OrganizationInvitationStatus.PENDING,
  })
  status: OrganizationInvitationStatus;

  @Column({ unique: true })
  token: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'invitedById' })
  invitedBy: User;

  @Column({ type: 'timestamp' })
  expiresAt: Date;
}
