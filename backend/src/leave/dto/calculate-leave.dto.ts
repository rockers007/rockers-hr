import { IsUUID, IsDateString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class CalculateLeaveDto {
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

  @IsOptional()
  @IsDateString()
  early_leave_date?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'early_leave_start_time must be HH:mm format' })
  early_leave_start_time?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'early_leave_end_time must be HH:mm format' })
  early_leave_end_time?: string;
}
