import {
  IsUUID,
  IsDateString,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  Matches,
} from 'class-validator';

export class CreateLeaveRequestDto {
  @IsUUID()
  @IsNotEmpty()
  leave_type_id: string;

  @IsUUID()
  @IsNotEmpty()
  duration_type_id: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason: string;

  @IsOptional()
  @IsString()
  doc_s3_key?: string | null;

  @IsOptional()
  @IsBoolean()
  sandwich_confirmed?: boolean;

  // Early leave fields (required when leave type unit = 'hours')
  @IsOptional()
  @IsString()
  @IsDateString()
  early_leave_date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'early_leave_start_time must be HH:mm format' })
  early_leave_start_time?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'early_leave_end_time must be HH:mm format' })
  early_leave_end_time?: string;
}

export class AdminCreateLeaveRequestDto extends CreateLeaveRequestDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsOptional()
  @IsString()
  admin_notes?: string;
}
