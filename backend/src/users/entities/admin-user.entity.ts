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

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByAdmin: AdminUser;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
