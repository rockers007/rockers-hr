import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('payroll_items')
export class PayrollItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_payroll_items_run')
  @Column({ type: 'uuid' })
  run_id: string;

  @Index('idx_payroll_items_user')
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  run_employee_id: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  lwp_deduction: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  sal_for_calc: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  basic_actual: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  basic_payable: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  hra_actual: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  hra_payable: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  sp_allow_actual: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  sp_allow_payable: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  conveyance_actual: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  conveyance_payable: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  ltc_actual: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  ltc_payable: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  re_medical_actual: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  re_medical_payable: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  education_actual: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  education_payable: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  fix_variable: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  ot_per_hour: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  ot_rate: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  ot_pay: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  security_return: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  employee_pf: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  employer_pf: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  employee_esic: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  employer_esic: string;

  @Column({ type: 'boolean', default: false })
  esic_applied: boolean;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  professional_tax: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  tds: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  loan_emi: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  sal_deduction: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total_earnings: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total_deductions: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  net_payable: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  ctc: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  ctc_as_per_it: string;

  @Column({ type: 'boolean', default: true })
  is_current: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  superseded_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  superseded_by: string | null;

  @Column({ type: 'smallint', default: 1 })
  calculation_version: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  computed_at: Date;
}
