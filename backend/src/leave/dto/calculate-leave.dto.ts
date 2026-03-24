import { IsUUID, IsDateString, IsNotEmpty } from 'class-validator';

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
}
