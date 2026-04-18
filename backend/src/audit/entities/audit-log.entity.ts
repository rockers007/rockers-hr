import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  actor_id: string;

  @Column({ type: 'text' })
  action: string;

  @Column({ type: 'text', nullable: true })
  method: string | null;

  @Column({ type: 'text' })
  entity_type: string;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  on_behalf_of: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'on_behalf_of' })
  onBehalfOfUser: User;

  @Column({ type: 'jsonb', nullable: true })
  before_state: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  after_state: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  ip_address: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
