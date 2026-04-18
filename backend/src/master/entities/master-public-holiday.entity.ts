import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AdminUser } from '../../users/entities/admin-user.entity';

@Entity('master_public_holidays')
export class MasterPublicHoliday {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'date', unique: true })
  date: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'boolean', default: false })
  is_optional: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

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
