import { Column, Entity, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('organization_payment_accounts')
export class OrganizationPaymentAccount extends BaseEntity {
  @OneToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  organization: Organization;

  @Column({ length: 10 })
  bankBin: string;

  @Column({ length: 100 })
  bankName: string;

  @Column({ length: 100 })
  accountName: string;

  @Column({ type: 'text' })
  accountNumberEncrypted: string;

  @Column({ length: 32 })
  accountNumberIv: string;

  @Column({ length: 32 })
  accountNumberTag: string;
}
