import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('user_documents')
export class UserDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  document_type_id: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  label: string | null;

  @Column({ type: 'text' })
  s3_key: string;

  @Column({ type: 'int', nullable: true })
  file_size_bytes: number | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  mime_type: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'uploaded_at' })
  uploaded_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}
