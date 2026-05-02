import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../user/entities/user.entity';
import { VerificationStatus } from "../../../shared/enum/enum"


@Entity('org_verifications')
export class OrgVerification extends BaseEntity {
  @Column()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  // Người gửi yêu cầu xác minh
  @ManyToOne(() => User)
  requester: User;

  // Thông tin pháp lý
  @Column({ nullable: true })
  taxIdNumber: string; // Mã số thuế/Số GPKD

  @Column({ nullable: true })
  documentUrl: string; // Link ảnh giấy phép kinh doanh/CCCD

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @Column({ nullable: true })
  adminNote: string; // Lý do từ chối hoặc ghi chú từ Admin

  @Column({ nullable: true })
  verifiedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  verifiedBy: User; // Admin nào đã duyệt
}