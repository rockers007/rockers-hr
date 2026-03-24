import {
  IsUUID,
  IsDateString,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
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
}

export class AdminCreateLeaveRequestDto extends CreateLeaveRequestDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsOptional()
  @IsString()
  admin_notes?: string;
}
