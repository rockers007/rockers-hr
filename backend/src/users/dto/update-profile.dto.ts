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
}
