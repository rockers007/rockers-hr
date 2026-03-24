import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  Matches,
} from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+?\d{1,3}[-.\s]?)?\d{10}$/, {
    message: 'Phone must be a valid 10-digit number or international format',
  })
  phone: string;

  @IsDateString()
  dob: string;

  @IsUUID()
  gender_id: string;

  @IsUUID()
  qualification_id: string;

  @IsUUID()
  role_type_id: string;

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
