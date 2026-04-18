import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type BankChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

@Entity('bank_change_requests')
export class BankChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_bcr_user')
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  current_bank_name: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  current_account_no: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  current_ifsc: string | null;

  @Column({ type: 'varchar', length: 100 })
  new_bank_name: string;

  @Column({ type: 'varchar', length: 40 })
  new_account_no: string;

  @Column({ type: 'varchar', length: 15 })
  new_ifsc: string;

  @Column({ type: 'text', nullable: true })
  proof_s3_key: string | null;

  @Index('idx_bcr_status')
  @Column({
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    enumName: 'bank_change_status',
    default: 'PENDING',
  })
  status: BankChangeStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'submitted_at' })
  submitted_at: Date;

  @Column({ type: 'uuid', nullable: true })
  effective_from_run_id: string | null;
}
