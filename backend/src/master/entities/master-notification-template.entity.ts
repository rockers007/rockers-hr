import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AdminUser } from '../../users/entities/admin-user.entity';

@Entity('master_notification_templates')
export class MasterNotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  event_key: string;

  @Column({ type: 'text', nullable: true })
  subject_template: string | null;

  @Column({ type: 'text' })
  body_template: string;

  @Column({ type: 'text' })
  channel: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by' })
  updatedByAdmin: AdminUser;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
