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
import { MasterDepartment } from './master-department.entity';

/**
 * Designations (job titles) scoped per department. Seeded + managed by HR
 * admins via the generic /master/designations endpoints.
 */
@Entity('master_designations')
@Index('idx_master_designations_dept', ['department_id'])
export class MasterDesignation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  department_id: string;

  @ManyToOne(() => MasterDepartment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department: MasterDepartment;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
