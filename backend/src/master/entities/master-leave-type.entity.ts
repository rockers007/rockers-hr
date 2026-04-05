import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AdminUser } from '../../users/entities/admin-user.entity';

@Entity('master_leave_types')
export class MasterLeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'text', unique: true, nullable: true })
  system_key: string | null; // CL, SL, PL, LWP, EARLY, ML, EL, MPL

  @Column({ type: 'int' })
  annual_days: number;

  @Column({ type: 'text', default: 'days' })
  unit: string; // 'days' or 'hours'

  @Column({ type: 'text', default: 'fixed' })
  accrual_type: string; // 'fixed' = full upfront, 'monthly' = pro-rata

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  accrual_rate_per_month: number | null; // e.g. 0.50 for CL/SL

  @Column({ type: 'int', default: 0 })
  min_tenure_months: number; // min months of service before eligible (PL=12)

  @Column({ type: 'int', nullable: true })
  max_days_per_request: number | null; // PL max 5 days per request

  @Column({ type: 'int', default: 0 })
  min_advance_days: number; // PL requires 15 days advance booking

  @Column({ type: 'boolean', default: false })
  requires_doc_for_future: boolean; // SL: doc required when applied for future date

  @Column({ type: 'boolean', default: false })
  probation_allowed: boolean;

  @Column({ type: 'boolean', default: false })
  doc_required: boolean;

  @Column({ type: 'int', nullable: true })
  doc_threshold_days: number | null;

  @Column({ type: 'int', default: 0 })
  carry_over: number;

  @Column({ type: 'text', default: '#6b7280' })
  color: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByAdmin: AdminUser;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
