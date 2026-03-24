import { IsDateString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class ActivateUserDto {
  @IsDateString()
  join_date: string;

  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @IsOptional()
  @IsBoolean()
  is_manager?: boolean;
}
