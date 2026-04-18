import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payroll_salary_components')
export class PayrollSalaryComponent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 60 })
  display_name: string;

  @Column({ type: 'varchar', length: 30 })
  payslip_label: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  percentage: string;

  @Column({ type: 'smallint' })
  display_order: number;

  @Column({ type: 'boolean', default: false })
  is_pf_base: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
