import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryLeaveRequestsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}

export class AdminQueryLeaveRequestsDto extends QueryLeaveRequestsDto {
  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  leave_type_id?: string;

  @IsOptional()
  @IsString()
  department_id?: string;
}

export class DeclineDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
