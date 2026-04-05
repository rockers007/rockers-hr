import {
  IsUUID,
  IsDateString,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';

export class CreateOvertimeDto {
  @IsDateString()
  date: string;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'start_time must be HH:MM or HH:MM:SS' })
  start_time: string;

  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'end_time must be HH:MM or HH:MM:SS' })
  end_time: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReviewOvertimeDto {
  @IsIn(['approved', 'declined'])
  status: 'approved' | 'declined';

  @IsString()
  @IsOptional()
  admin_remarks?: string;
}

export class UpdatePaymentDto {
  @IsIn(['paid', 'unpaid', 'comp_off'])
  payment_status: 'paid' | 'unpaid' | 'comp_off';

  @IsString()
  @IsOptional()
  payment_remarks?: string;
}
