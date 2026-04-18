import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'jsonb' })
  response: unknown;

  @Index('idx_ik_created')
  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;
}
