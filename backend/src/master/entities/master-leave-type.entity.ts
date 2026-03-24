import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AdminUser } from '../../users/entities/admin-user.entity';

@Entity('master_leave_types')
export class MasterLeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'int' })
  annual_days: number;

  @Column({ type: 'boolean', default: false })
  probation_allowed: boolean;

  @Column({ type: 'boolean', default: false })
  doc_required: boolean;

  @Column({ type: 'int', nullable: true })
  doc_threshold_days: number | null;

  @Column({ type: 'int', default: 0 })
  carry_over: number;

  @Column({ type: 'text', default: '#6b7280' })
  color: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByAdmin: AdminUser;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
