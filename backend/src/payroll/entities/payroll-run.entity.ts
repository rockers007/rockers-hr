import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PayrollRunState =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'LOCKED'
  | 'RELEASED'
  | 'BANK_FILE_APPROVED'
  | 'BANK_FILE_GENERATED'
  | 'CANCELLED';

@Entity('payroll_runs')
export class PayrollRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'smallint' })
  month: number;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ type: 'smallint', default: 30 })
  payroll_cycle_days: number;

  @Column({ type: 'enum', enum: ['DRAFT','IN_PROGRESS','REVIEW','LOCKED','RELEASED','BANK_FILE_APPROVED','BANK_FILE_GENERATED','CANCELLED'], enumName: 'payroll_run_state', default: 'DRAFT' })
  state: PayrollRunState;

  @Column({ type: 'int', default: 0 })
  total_employees: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  total_net_payable: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total_employer_pf: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total_employee_pf: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  total_pt: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total_tds: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total_incentive: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total_ot_pay: string;

  @Column({ type: 'date', nullable: true })
  release_date: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  imported_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  calculated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  locked_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  released_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  bank_file_approved_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  bank_file_generated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  locked_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  released_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  bank_file_approved_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
