import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MasterLeaveType } from '../../master/entities/master-leave-type.entity';
import { MasterLeaveDuration } from '../../master/entities/master-leave-duration.entity';
import { LeaveApproval } from './leave-approval.entity';

@Entity('leave_requests')
@Check(`"end_date" >= "start_date"`)
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  leave_type_id: string;

  @ManyToOne(() => MasterLeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: MasterLeaveType;

  @Column({ type: 'uuid' })
  duration_type_id: string;

  @ManyToOne(() => MasterLeaveDuration, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'duration_type_id' })
  durationType: MasterLeaveDuration;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  working_days: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  doc_s3_key: string | null;

  @Column({ type: 'text', default: 'PENDING_L1' })
  status: string;

  @Column({ type: 'boolean', default: false })
  sandwich_flag: boolean;

  @Column({ type: 'uuid', nullable: true })
  submitted_by: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'submitted_by' })
  submittedByUser: User;

  @Column({ type: 'text', nullable: true })
  admin_notes: string | null;

  // Early leave time tracking (unit=hours)
  @Column({ type: 'date', nullable: true })
  early_leave_date: string | null;

  @Column({ type: 'time', nullable: true })
  early_leave_start_time: string | null;

  @Column({ type: 'time', nullable: true })
  early_leave_end_time: string | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  early_leave_hours: number | null;

  @Column({ type: 'text', nullable: true })
  calendar_event_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cancelled_by' })
  cancelledByUser: User;

  @Column({ type: 'text', nullable: true })
  cancelled_by_usertype: string | null;

  @OneToMany(() => LeaveApproval, (approval) => approval.leaveRequest)
  approvals: LeaveApproval[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
