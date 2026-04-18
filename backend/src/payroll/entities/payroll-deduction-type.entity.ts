import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('payroll_deduction_types')
export class PayrollDeductionType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 60 })
  display_name: string;

  @Column({ type: 'varchar', length: 30 })
  payslip_label: string;

  @Column({ type: 'boolean', default: false })
  is_statutory: boolean;

  @Column({ type: 'boolean', default: false })
  is_auto_calculated: boolean;

  @Column({ type: 'boolean', default: false })
  is_manual: boolean;

  @Column({ type: 'boolean', default: true })
  is_active_by_default: boolean;

  @Column({ type: 'smallint' })
  display_order: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
