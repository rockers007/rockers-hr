import { IsString, IsNotEmpty, IsEmail, MinLength, Matches } from 'class-validator';

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
}
