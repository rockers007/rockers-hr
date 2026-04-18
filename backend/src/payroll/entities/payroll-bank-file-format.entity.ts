import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('payroll_bank_file_formats')
export class PayrollBankFileFormat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  display_name: string;

  @Column({ type: 'varchar', length: 10, default: 'txt' })
  file_extension: string;

  @Column({ type: 'varchar', length: 5, default: '|' })
  delimiter: string;

  @Column({ type: 'boolean', default: true })
  has_header_row: boolean;

  @Column({ type: 'jsonb' })
  column_order: string[];

  @Column({ type: 'varchar', length: 20, default: 'YYYY-MM-DD' })
  date_format: string;

  @Column({ type: 'varchar', length: 20, default: 'INR_2DEC' })
  amount_format: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  template_notes: string | null;
}
