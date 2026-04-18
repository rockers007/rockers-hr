import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payroll_statutory_config')
export class PayrollStatutoryConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, default: 'DEFAULT' })
  profile_name: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 15000.0 })
  pf_cap_amount: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 1800.0 })
  pf_fixed_at_cap: string;

  @Column({ type: 'numeric', precision: 5, scale: 4, default: 0.12 })
  pf_rate_below_cap: string;

  @Column({ type: 'boolean', default: true })
  pf_employer_matches_employee: boolean;

  @Column({ type: 'boolean', default: false })
  esic_active: boolean;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 21000.0 })
  esic_threshold_gross: string;

  @Column({ type: 'numeric', precision: 5, scale: 4, default: 0.0325 })
  esic_employer_rate: string;

  @Column({ type: 'numeric', precision: 5, scale: 4, default: 0.0075 })
  esic_employee_rate: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 200.0 })
  pt_flat_amount: string;

  @Column({ type: 'numeric', precision: 4, scale: 2, default: 1.5 })
  ot_multiplier: string;

  @Column({ type: 'numeric', precision: 4, scale: 0, default: 30 })
  ot_divisor_day: string;

  @Column({ type: 'numeric', precision: 4, scale: 0, default: 9 })
  ot_divisor_hour: string;

  @Column({ type: 'smallint', default: 30 })
  payroll_cycle_days: number;

  @Column({ type: 'smallint', default: 4 })
  financial_year_start_month: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'date' })
  effective_from: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
