import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
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
  @MaxLength(20000)
  extra_info?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  photo_s3_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  resume_s3_key?: string;
}
