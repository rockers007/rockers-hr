import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

export interface SnapshotComponent {
  code: string;
  percentage: number;
  is_pf_base: boolean;
  display_order: number;
  payslip_label: string;
}

export interface SnapshotStatutory {
  pf_cap_amount: number;
  pf_fixed_at_cap: number;
  pf_rate_below_cap: number;
  pf_employer_matches_employee: boolean;
  esic_active: boolean;
  esic_threshold_gross: number;
  esic_employer_rate: number;
  esic_employee_rate: number;
  pt_flat_amount: number;
  ot_multiplier: number;
  ot_divisor_day: number;
  ot_divisor_hour: number;
  payroll_cycle_days: number;
}

@Entity('payroll_run_employees')
@Unique(['run_id', 'user_id'])
export class PayrollRunEmployee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_pre_run')
  @Column({ type: 'uuid' })
  run_id: string;

  @Index('idx_pre_user')
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  snapshot_gross: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  snapshot_incentive: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  snapshot_tds: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  snapshot_loan_emi: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  snapshot_sal_deduction: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  snapshot_security_return: string;

  @Column({ type: 'boolean' })
  snapshot_pf_applicable: boolean;

  @Column({ type: 'jsonb' })
  snapshot_components: SnapshotComponent[];

  @Column({ type: 'jsonb' })
  snapshot_statutory: SnapshotStatutory;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  lwp_days: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  cl_days: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  sl_days: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  pl_days: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  wfh_days: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  comp_off_days: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  el_hours: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  ot_hours: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 30 })
  present_days: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
