import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { Order } from '../../order/entities/order.entity';

export enum PaymentWebhookReceiptStatus {
  RECEIVED = 'RECEIVED',
  PROCESSED = 'PROCESSED',
  RECONCILIATION_REQUIRED = 'RECONCILIATION_REQUIRED',
}

@Entity('payment_webhook_receipts')
export class PaymentWebhookReceipt extends BaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerTransactionId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  reference: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount: number | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  receivingAccountLast4: string | null;

  @Column({ type: 'timestamp', nullable: true })
  occurredAt: Date | null;

  @Column({ type: 'varchar', length: 64 })
  payloadSha256: string;

  @Column({
    type: 'enum',
    enum: PaymentWebhookReceiptStatus,
    default: PaymentWebhookReceiptStatus.RECEIVED,
  })
  status: PaymentWebhookReceiptStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reconciliationReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;
}
