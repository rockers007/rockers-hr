import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('overtime_requests')
@Check(`"end_time" > "start_time"`)
@Check(`"hours" > 0`)
export class OvertimeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Employee who worked overtime
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Date of overtime
  @Column({ type: 'date' })
  date: string;

  // Time range
  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  // Calculated hours (decimal, e.g. 2.5)
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  hours: number;

  // Reason for overtime
  @Column({ type: 'text' })
  reason: string;

  // Approval status
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: 'pending' | 'approved' | 'declined';

  // Payment status — set by admin after approval
  @Column({
    type: 'varchar',
    length: 20,
    default: 'unpaid',
  })
  payment_status: 'unpaid' | 'paid' | 'comp_off';

  // Admin who approved/declined
  @Column({ type: 'uuid', nullable: true })
  reviewed_by_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: User;

  // Admin remarks on approval/decline
  @Column({ type: 'text', nullable: true })
  admin_remarks: string | null;

  // When admin reviewed
  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  // Payment details
  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'text', nullable: true })
  payment_remarks: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
