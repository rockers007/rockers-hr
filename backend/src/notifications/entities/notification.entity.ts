import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MasterNotificationTemplate } from '../../master/entities/master-notification-template.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  template_id: string | null;

  @ManyToOne(() => MasterNotificationTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'template_id' })
  template: MasterNotificationTemplate;

  @Column({ type: 'text' })
  event_key: string;

  @Column({ type: 'text' })
  rendered_title: string;

  @Column({ type: 'text' })
  rendered_body: string;

  @Column({ type: 'text' })
  channel: string;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @Column({ type: 'boolean', default: false })
  email_sent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  email_sent_at: Date | null;

  @Column({ type: 'boolean', default: false })
  push_sent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  push_sent_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
