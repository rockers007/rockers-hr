import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

export type PayslipDeliveryStatus =
  | 'PENDING'
  | 'GENERATED'
  | 'EMAILED'
  | 'FAILED'
  | 'BOUNCED';

@Entity('payslip_deliveries')
@Unique(['run_id', 'user_id'])
export class PayslipDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_psd_run')
  @Column({ type: 'uuid' })
  run_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  payroll_item_id: string;

  @Column({ type: 'text', nullable: true })
  s3_key: string | null;

  @Column({ type: 'text', nullable: true })
  s3_url_signed: string | null;

  @Column({ type: 'int', nullable: true })
  pdf_size_bytes: number | null;

  @Column({ type: 'varchar', length: 20, default: 'DOB in DDMM' })
  pdf_password_hint: string;

  @Index('idx_psd_status')
  @Column({
    type: 'enum',
    enum: ['PENDING', 'GENERATED', 'EMAILED', 'FAILED', 'BOUNCED'],
    enumName: 'payslip_delivery_status',
    default: 'PENDING',
  })
  status: PayslipDeliveryStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  bounced_at: Date | null;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  @Column({ type: 'smallint', default: 0 })
  retry_count: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
