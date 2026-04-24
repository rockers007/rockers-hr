import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';

// Shared caps to prevent DoS via oversized payloads. Values chosen so real
// users never hit them; a legitimate password maxing out at 200 chars is
// plenty and bcrypt itself truncates at 72 bytes.
const EMAIL_MAX = 254; // RFC 5321 cap
const PASSWORD_MAX = 200;

export class AdminLoginDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(EMAIL_MAX)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(PASSWORD_MAX)
  password: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  is_active: boolean;
  is_admin?: boolean;
  admin_role_id?: string;
  // v2.0 admin-invite flow: true between invite and first-login activation
  first_login_required?: boolean;
}

export class EmployeeLoginDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(EMAIL_MAX)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX)
  password: string;
}

export class InviteUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(EMAIL_MAX)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  emp_number?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsDateString()
  join_date?: string;
}

export class ActivateAccountHttpDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dob?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  gender_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  qualification_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  department_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  join_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  photo_s3_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  resume_s3_key?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(PASSWORD_MAX)
  new_password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(PASSWORD_MAX)
  confirm_password: string;
}
