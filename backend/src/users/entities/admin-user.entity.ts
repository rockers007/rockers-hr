import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { MasterAdminRole } from '../../master/entities/master-admin-role.entity';

@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  role_id: string;

  @ManyToOne(() => MasterAdminRole, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role: MasterAdminRole;

  @Column({ type: 'text' })
  password_hash: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  // --- Login lockout tracking (see migration 1712000000040) ---
  @Column({ type: 'int', default: 0 })
  failed_login_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  locked_until: Date | null;

  // --- Session invalidation cutoff (see migration 1712000000050) ---
  @Column({ type: 'timestamptz', default: () => 'now()' })
  tokens_valid_from: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByAdmin: AdminUser;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
