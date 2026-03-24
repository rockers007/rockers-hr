import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { AdminUser } from '../users/entities/admin-user.entity';
import { JwtPayload } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Handle Google OAuth callback.
   * If user exists and is active -> return JWT.
   * If user exists but inactive -> return pending status.
   * If user doesn't exist -> return registration_required with temp token.
   */
  async handleGoogleLogin(profile: {
    email: string;
    name: string;
    picture?: string;
  }): Promise<{
    status: string;
    token: string;
    user?: Partial<User>;
  }> {
    // Validate @gmail.com
    if (!profile.email.endsWith('@gmail.com')) {
      throw new UnauthorizedException('Only @gmail.com accounts are accepted');
    }

    const existingUser = await this.userRepo.findOne({
      where: { gmail: profile.email },
      relations: ['roleType'],
    });

    if (existingUser) {
      if (!existingUser.is_active) {
        // User registered but not yet activated by HR
        const tempToken = this.jwtService.sign(
          {
            sub: existingUser.id,
            email: existingUser.gmail,
            role: 'pending',
            name: existingUser.name,
            is_active: false,
          },
          { expiresIn: '1h' },
        );
        return { status: 'pending_activation', token: tempToken };
      }

      // Active user — full JWT
      const token = this.generateUserToken(existingUser);
      return {
        status: 'authenticated',
        token,
        user: {
          id: existingUser.id,
          name: existingUser.name,
          gmail: existingUser.gmail,
        },
      };
    }

    // New user — temp token for registration flow
    const tempToken = this.jwtService.sign(
      {
        sub: 'new_user',
        email: profile.email,
        name: profile.name,
        role: 'registration',
        is_active: false,
      },
      { expiresIn: '1h' },
    );

    return { status: 'registration_required', token: tempToken };
  }

  /**
   * Admin email + password login.
   */
  async adminLogin(
    email: string,
    password: string,
  ): Promise<{ token: string; user: Record<string, any> }> {
    const user = await this.userRepo.findOne({ where: { gmail: email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const adminUser = await this.adminUserRepo.findOne({
      where: { user_id: user.id },
      relations: ['role'],
    });

    if (!adminUser || !adminUser.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, adminUser.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({
      sub: adminUser.id,
      email: user.gmail,
      role: adminUser.role.name.toLowerCase().replace(/\s+/g, '_'),
      admin_role_id: adminUser.role_id,
      is_admin: true,
      name: user.name,
      is_active: true,
    });

    return {
      token,
      user: {
        id: adminUser.id,
        name: user.name,
        email: user.gmail,
        role: adminUser.role.name,
      },
    };
  }

  /**
   * Validate a JWT payload — called by JwtStrategy on every request.
   */
  async validateUser(payload: JwtPayload): Promise<any> {
    if (payload.is_admin) {
      const admin = await this.adminUserRepo.findOne({
        where: { id: payload.sub },
        relations: ['user', 'role'],
      });
      if (!admin || !admin.is_active) {
        throw new UnauthorizedException('Admin account is disabled');
      }
      return {
        id: admin.id,
        userId: admin.user_id,
        email: admin.user.gmail,
        name: admin.user.name,
        is_admin: true,
        role: admin.role.name,
        permissions: admin.role.permissions,
      };
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Account is disabled or not found');
    }
    return {
      id: user.id,
      email: user.gmail,
      name: user.name,
      is_admin: false,
      is_manager: user.is_manager,
      manager_id: user.manager_id,
    };
  }

  generateUserToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.gmail,
      role: user.roleType?.system_key || 'employee',
      name: user.name,
      is_active: user.is_active,
    });
  }
}
