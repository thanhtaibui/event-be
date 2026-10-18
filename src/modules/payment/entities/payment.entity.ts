import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  RelationId,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Order } from '../../order/entities/order.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { PaymentStatus } from '../../../shared/enum/enum';

@Entity('payments')
export class Payment extends BaseEntity {
  @OneToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  order: Order;

  @RelationId((payment: Payment) => payment.order)
  orderId: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'RESTRICT' })
  organization: Organization;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'VND' })
  currency: string;

  @Column({ length: 20, default: 'VIETQR' })
  method: string;

  @Column({ length: 50, unique: true })
  reference: string;

  @Index()
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'varchar', nullable: true, unique: true, length: 120 })
  providerTransactionId: string | null;

  @Column({ type: 'varchar', nullable: true, length: 80 })
  provider: string | null;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

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
