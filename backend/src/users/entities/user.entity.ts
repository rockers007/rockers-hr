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

  @Column({ type: 'date', nullable: true })
  resignation_date: string | null;

  @Column({ type: 'date', nullable: true })
  last_working_day: string | null;

  @Column({
    type: 'text',
    default: 'active',
  })
  employment_status: string; // 'active' | 'resigned' | 'terminated' | 'absconded'

  @Column({ type: 'text', nullable: true })
  fcm_token: string | null;

  @Column({ type: 'text', nullable: true })
  google_access_token: string | null;

  @Column({ type: 'text', nullable: true })
  google_refresh_token: string | null;

  // --- v2.0 admin-invite auth (AUTH_REGISTRATION.md) ---
  @Column({ type: 'varchar', length: 80, nullable: true })
  password_hash: string | null;

  @Column({ type: 'uuid', nullable: true })
  invite_token: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  invite_token_expires_at: Date | null;

  @Column({ type: 'boolean', default: false })
  first_login_required: boolean;

  // --- Login lockout tracking (see migration 1712000000040) ---
  @Column({ type: 'int', default: 0 })
  failed_login_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  locked_until: Date | null;

  // --- Extended profile ---
  @Column({ type: 'uuid', nullable: true })
  marital_status_id: string | null;

  @Column({ type: 'text', nullable: true })
  current_address: string | null;

  @Column({ type: 'text', nullable: true })
  permanent_address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  emergency_phone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pf_uan_no: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  esic_no: string | null;

  // --- Payroll fields (PAYROLL_DATABASE_SCHEMA.md §1) ---
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  gross: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  incentive: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  tds: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  loan_emi: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  sal_deduction: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  security_return: string;

  @Column({ type: 'boolean', default: true })
  pf_applicable: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bank_name: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  bank_account_no: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  bank_ifsc: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  emp_number: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  designation: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
