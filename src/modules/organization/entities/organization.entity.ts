import { Entity, Column, OneToMany, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Event } from '../../event/entities/event.entity';
import { Membership } from '../../membership/entities/membership.entity';
import { User } from '../../user/entities/user.entity';
import { Role } from '../../role/entities/role.entity';
import { OrgRequestStatus } from 'src/shared/enum/enum';
// ... các import cũ giữ nguyên
import { OrgVerification } from '../../org-verification/entities/org-verification.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  legalName: string;

  @Column({ nullable: true })
  bio: string;

  // --- Branding & Contact (Thêm mới cho UI) ---
  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  bannerUrl: string;

  @Column()
  industry: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  address: string;

  // --- Trạng thái xác minh (Dùng để hiển thị tích xanh) ---
  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true })
  verifiedAt: Date;

  // Quan hệ tới các yêu cầu xác minh
  @OneToMany(() => OrgVerification, (v) => v.organization)
  verificationRequests: OrgVerification[];

  // --- Các trường cũ giữ nguyên ---
  @OneToMany(() => Event, (event) => event.organization)
  events: Event[];

  @OneToMany(() => Membership, (membership) => membership.organization)
  memberships: Membership[];

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true })
  owner: User;

  @Column({ nullable: true, unique: true })
  slug: string;

  @OneToMany(() => Role, (role) => role.organization)
  roles: Role[];

  @Column({
    type: 'enum',
    enum: OrgRequestStatus,
    default: OrgRequestStatus.PENDING,
  })
  status: OrgRequestStatus;
}