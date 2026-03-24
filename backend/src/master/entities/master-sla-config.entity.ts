import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AdminUser } from '../../users/entities/admin-user.entity';

@Entity('master_sla_config')
export class MasterSlaConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  config_key: string;

  @Column({ type: 'text' })
  config_value: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by' })
  updatedByAdmin: AdminUser;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
