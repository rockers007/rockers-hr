import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

export type BankFileType = 'NEFT' | 'RTGS' | 'MIXED';

@Entity('bank_transfer_files')
export class BankTransferFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  run_id: string;

  @Column({
    type: 'enum',
    enum: ['NEFT', 'RTGS', 'MIXED'],
    enumName: 'bank_file_type',
    default: 'NEFT',
  })
  file_type: BankFileType;

  @Column({ type: 'int' })
  employee_count: number;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  total_amount: string;

  @Column({ type: 'text' })
  s3_key: string;

  @Column({ type: 'varchar', length: 30, default: 'BANK_CUSTOM' })
  file_format: string;

  @Column({ type: 'boolean', default: true })
  is_latest: boolean;

  @Column({ type: 'uuid' })
  approved_by: string;

  @Column({ type: 'timestamptz' })
  approved_at: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  generated_at: Date;
}
