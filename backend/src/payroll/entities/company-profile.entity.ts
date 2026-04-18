import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('company_profile')
export class CompanyProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  company_name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  address_line_1: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  address_line_2: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string | null;

  @Column({ type: 'text', nullable: true })
  logo_s3_key: string | null;

  @Column({
    type: 'text',
    default:
      'This is a system generated pay slip and does not require signature',
  })
  payslip_footer_text: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  pf_establishment_code: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  esic_code: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pan_number: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
