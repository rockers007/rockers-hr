import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('payroll_earning_types')
export class PayrollEarningType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 60 })
  display_name: string;

  @Column({ type: 'varchar', length: 30 })
  payslip_label: string;

  @Column({ type: 'boolean', default: true })
  is_manual: boolean;

  @Column({ type: 'boolean', default: false })
  is_auto_from_leave: boolean;

  @Column({ type: 'smallint' })
  display_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
