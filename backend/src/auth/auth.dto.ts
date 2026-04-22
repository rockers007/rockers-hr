import { IsString, IsNotEmpty, IsEmail, MinLength, IsOptional } from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
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
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password: string;
}

export class InviteUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  emp_number?: string;
}

export class ActivateAccountHttpDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  gender_id?: string;

  @IsOptional()
  @IsString()
  qualification_id?: string;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsString()
  join_date?: string;

  @IsOptional()
  @IsString()
  photo_s3_key?: string;

  @IsOptional()
  @IsString()
  resume_s3_key?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  new_password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  confirm_password: string;
}
