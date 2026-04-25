import { Entity, Column, ManyToOne } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { BaseEntity } from '../../../shared/base/base.entity';
import { ReportStatus } from '../../../shared/enum/enum'
@Entity('reports')
export class Report extends BaseEntity {

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Organization)
  organization: Organization;

  @Column()
  reason: string;

  @Column({ default: 'pending' })
  status: ReportStatus;


}