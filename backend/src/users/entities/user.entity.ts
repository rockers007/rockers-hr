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
import { MasterGender } from '../../master/entities/master-gender.entity';
import { MasterRoleType } from '../../master/entities/master-role-type.entity';
import { MasterQualification } from '../../master/entities/master-qualification.entity';
import { MasterDepartment } from '../../master/entities/master-department.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  gmail: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'date', nullable: true })
  dob: string | null;

  @Column({ type: 'uuid', nullable: true })
  gender_id: string | null;

  @ManyToOne(() => MasterGender, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'gender_id' })
  gender: MasterGender;

  @Column({ type: 'uuid' })
  role_type_id: string;

  @ManyToOne(() => MasterRoleType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_type_id' })
  roleType: MasterRoleType;

  @Column({ type: 'uuid', nullable: true })
  qualification_id: string | null;

  @ManyToOne(() => MasterQualification, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'qualification_id' })
  qualification: MasterQualification;

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  @ManyToOne(() => MasterDepartment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: MasterDepartment;

  @Column({ type: 'text', nullable: true })
  extra_info: string | null;

  @Column({ type: 'text', nullable: true })
  photo_s3_key: string | null;

  @Column({ type: 'text', nullable: true })
  resume_s3_key: string | null;

  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  @Column({ type: 'date', nullable: true })
  join_date: string | null;

  @Column({ type: 'date', nullable: true })
  confirmation_date: string | null;

  @Column({ type: 'uuid', nullable: true })
  manager_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager: User;

  @Column({ type: 'boolean', default: false })
  is_manager: boolean;

  @Column({ type: 'text', default: 'self' })
  registration_method: string;

  @Column({ type: 'text', nullable: true })
  fcm_token: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
