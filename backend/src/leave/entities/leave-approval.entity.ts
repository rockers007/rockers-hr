import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LeaveRequest } from './leave-request.entity';

@Entity('leave_approvals')
export class LeaveApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  leave_request_id: string;

  @ManyToOne(() => LeaveRequest, (request) => request.approvals, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_request_id' })
  leaveRequest: LeaveRequest;

  @Column({ type: 'int' })
  level: number;

  @Column({ type: 'uuid' })
  approver_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  @Column({ type: 'text', nullable: true })
  action: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'timestamptz' })
  sla_deadline: Date;

  @Column({ type: 'timestamptz' })
  reminder_deadline: Date;

  @Column({ type: 'boolean', default: false })
  reminder_sent: boolean;

  @Column({ type: 'boolean', default: false })
  escalated: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  escalated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  actioned_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
