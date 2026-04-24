import {
  IsString,
  IsOptional,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

// Generous-but-bounded caps to prevent 10MB-text DoS while not surprising
// users who paste long addresses or resume snippets.
const SHORT = 120; // name, phone, emp number, IFSC, UAN, ESIC, IFSC
const MEDIUM = 255; // file keys / labels
const LONG = 4000; // addresses
const HUGE = 20000; // extra_info (free-form JSON-ish bag)

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(SHORT)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SHORT)
  @Matches(/^(\+?\d{1,3}[-.\s]?)?\d{10}$/, {
    message: 'Phone must be a valid 10-digit number or international format',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dob?: string;

  @IsOptional()
  @IsUUID()
  gender_id?: string;

  @IsOptional()
  @IsUUID()
  qualification_id?: string;

  // department_id intentionally excluded — admin-only field.
  // emp_number, join_date, gmail — also admin-only.

  @IsOptional()
  @IsString()
  @MaxLength(HUGE)
  extra_info?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MEDIUM)
  photo_s3_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MEDIUM)
  resume_s3_key?: string;

  // --- Extended profile ---
  @IsOptional()
  @IsUUID()
  marital_status_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  current_address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LONG)
  permanent_address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SHORT)
  emergency_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SHORT)
  pf_uan_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SHORT)
  esic_no?: string;

  // --- Bank ---
  @IsOptional()
  @IsString()
  @MaxLength(SHORT)
  bank_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SHORT)
  bank_account_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SHORT)
  bank_ifsc?: string;
}
