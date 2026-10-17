import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Payment } from './payment.entity';

@Entity('payment_transactions')
export class PaymentTransaction extends BaseEntity {
  @ManyToOne(() => Payment, { nullable: false, onDelete: 'CASCADE' })
  payment: Payment;

  @Column({ length: 120, unique: true })
  providerTransactionId: string;

  @Column({ length: 80 })
  provider: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ length: 4 })
  receivingAccountLast4: string;

  @Column({ type: 'timestamp' })
  occurredAt: Date;
}
