import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MasterLeaveType } from '../../master/entities/master-leave-type.entity';

@Entity('leave_balances')
@Unique(['user_id', 'leave_type_id', 'year'])
export class LeaveBalance {
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

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  total_days: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  used_days: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  pending_days: number;
}
