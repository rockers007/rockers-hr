import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_family_members')
export class UserFamilyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_ufm_user')
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 40 })
  relation: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  occupation: string | null;

  @Column({ type: 'date', nullable: true })
  dob: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  contact_no: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
