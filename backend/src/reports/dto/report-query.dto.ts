import { IsOptional, IsInt, Min, Max, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class MonthlyReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;

  @IsOptional()
  @IsUUID()
  department_id?: string;
}

export class YearlyReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;

  @IsOptional()
  @IsUUID()
  department_id?: string;
}

export class LeaveBalanceReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;

  @IsOptional()
  @IsUUID()
  department_id?: string;
}

export class ExportMonthlyQueryDto extends MonthlyReportQueryDto {
  @IsIn(['csv', 'pdf'])
  format: 'csv' | 'pdf';
}

export class ExportYearlyQueryDto extends YearlyReportQueryDto {
  @IsIn(['csv', 'pdf'])
  format: 'csv' | 'pdf';
}

export class ExportBalanceQueryDto extends LeaveBalanceReportQueryDto {
  @IsIn(['csv'])
  format: 'csv';
}
