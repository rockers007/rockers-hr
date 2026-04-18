import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('investment_proofs')
export class InvestmentProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 9 })
  financial_year: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  amount: string | null;

  @Column({ type: 'text' })
  s3_key: string;

  @Column({ type: 'int', nullable: true })
  file_size_bytes: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mime_type: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Index('idx_ip_uploaded_at')
  @Column({ type: 'timestamptz', default: () => 'now()' })
  uploaded_at: Date;
}
