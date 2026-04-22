import { IsString, IsOptional, IsUUID, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{1,3}[-.\s]?)?\d{10}$/, {
    message: 'Phone must be a valid 10-digit number or international format',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsUUID()
  gender_id?: string;

  @IsOptional()
  @IsUUID()
  qualification_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsString()
  extra_info?: string;

  @IsOptional()
  @IsString()
  photo_s3_key?: string;

  @IsOptional()
  @IsString()
  resume_s3_key?: string;

  // --- Extended profile ---
  @IsOptional()
  @IsUUID()
  marital_status_id?: string;

  @IsOptional()
  @IsString()
  current_address?: string;

  @IsOptional()
  @IsString()
  permanent_address?: string;

  @IsOptional()
  @IsString()
  emergency_phone?: string;

  @IsOptional()
  @IsString()
  pf_uan_no?: string;

  @IsOptional()
  @IsString()
  esic_no?: string;

  // --- Bank ---
  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsOptional()
  @IsString()
  bank_account_no?: string;

  @IsOptional()
  @IsString()
  bank_ifsc?: string;
}
