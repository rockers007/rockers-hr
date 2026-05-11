import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsEmail,
  IsIn,
  Matches,
  MaxLength,
} from 'class-validator';

export class AdminCreateUserDto {
  @IsEmail()
  @MaxLength(254)
  @Matches(/@gmail\.com$/, { message: 'Only @gmail.com addresses are allowed' })
  gmail: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^(\+?\d{1,3}[-.\s]?)?\d{10}$/, {
    message: 'Phone must be a valid 10-digit number or international format',
  })
  phone?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsUUID()
  qualification_id: string;

  @IsUUID()
  gender_id: string;

  @IsUUID()
  role_type_id: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @IsOptional()
  @IsBoolean()
  is_manager?: boolean;

  @IsDateString()
  join_date: string;

  @IsIn(['active', 'pending'])
  account_status: 'active' | 'pending';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  admin_notes?: string;
}
