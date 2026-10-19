import { Column, Entity, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Organization } from '../../organization/entities/organization.entity';

export enum PaymentAccountVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
}

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

  @Column({
    type: 'enum',
    enum: PaymentAccountVerificationStatus,
    default: PaymentAccountVerificationStatus.PENDING,
  })
  verificationStatus: PaymentAccountVerificationStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  verifiedAccountName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  verificationProvider: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verificationFailureReason: string | null;

  @Column({ type: 'text' })
  accountNumberEncrypted: string;

  @Column({ length: 32 })
  accountNumberIv: string;

  @Column({ length: 32 })
  accountNumberTag: string;
}
