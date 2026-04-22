import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { MasterRoleType } from '../master/entities/master-role-type.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtPayload } from './auth.dto';

const BCRYPT_COST = 10;
const INVITE_TTL_DAYS = 7;
const RANDOM_PASSWORD_LEN = 12;
const PASSWORD_MIN_LEN = 8;

export interface InviteDto {
  name: string;
  email: string;
  emp_number?: string;
}

export interface ActivateAccountDto {
  phone?: string;
  dob?: string;
  gender_id?: string;
  qualification_id?: string;
  department_id?: string;
  join_date?: string;
  photo_s3_key?: string;
  resume_s3_key?: string;
  new_password: string;
  confirm_password: string;
}

/**
 * v2.0 admin-invite + email/password auth flow.
 * See planning/AUTH_REGISTRATION.md for the canonical design.
 */
@Injectable()
export class InviteAuthService {
  private readonly logger = new Logger(InviteAuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MasterRoleType)
    private readonly roleTypeRepo: Repository<MasterRoleType>,
    private readonly jwtService: JwtService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ----------------------------------------------------------------------
  // Admin invites a new employee
  // ----------------------------------------------------------------------
  async inviteUser(
    dto: InviteDto,
  ): Promise<{ user: Partial<User>; invite_expires_at: Date }> {
    const email = dto.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException({
        code: 'EMAIL_INVALID',
        message: 'A valid email address is required.',
      });
    }
    if (!dto.name?.trim()) {
      throw new BadRequestException('Name is required.');
    }

    const existing = await this.userRepo.findOne({ where: { gmail: email } });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'An employee with this email already exists.',
      });
    }

    const employeeRole = await this.roleTypeRepo.findOne({
      where: { system_key: 'employee' },
    });
    if (!employeeRole) {
      throw new UnprocessableEntityException(
        'master_role_types: "employee" system key missing.',
      );
    }

    const plainPassword = this.generateRandomPassword(RANDOM_PASSWORD_LEN);
    const password_hash = await bcrypt.hash(plainPassword, BCRYPT_COST);
    const invite_token = crypto.randomUUID();
    const invite_token_expires_at = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const user = this.userRepo.create({
      gmail: email,
      name: dto.name.trim(),
      emp_number: dto.emp_number?.trim() || null,
      role_type_id: employeeRole.id,
      is_active: false,
      registration_method: 'admin_invite',
      password_hash,
      invite_token,
      invite_token_expires_at,
      first_login_required: true,
    });
    const saved = await this.userRepo.save(user);

    await this.sendInviteEmail({
      user: saved,
      plainPassword,
      inviteToken: invite_token,
      expiresInDays: INVITE_TTL_DAYS,
    });

    return {
      user: {
        id: saved.id,
        name: saved.name,
        gmail: saved.gmail,
        emp_number: saved.emp_number,
        is_active: saved.is_active,
      },
      invite_expires_at: invite_token_expires_at,
    };
  }

  // ----------------------------------------------------------------------
  // Resend invite (admin)
  // ----------------------------------------------------------------------
  async resendInvite(
    userId: string,
  ): Promise<{ sent_at: Date; expires_at: Date }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }
    if (user.is_active && !user.first_login_required) {
      throw new ConflictException({
        code: 'ALREADY_ACTIVE',
        message: 'User has already completed first login.',
      });
    }

    const plainPassword = this.generateRandomPassword(RANDOM_PASSWORD_LEN);
    user.password_hash = await bcrypt.hash(plainPassword, BCRYPT_COST);
    user.invite_token = crypto.randomUUID();
    user.invite_token_expires_at = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    user.first_login_required = true;
    user.registration_method = 'admin_invite';
    await this.userRepo.save(user);

    await this.sendInviteEmail({
      user,
      plainPassword,
      inviteToken: user.invite_token,
      expiresInDays: INVITE_TTL_DAYS,
    });

    return {
      sent_at: new Date(),
      expires_at: user.invite_token_expires_at,
    };
  }

  // ----------------------------------------------------------------------
  // Employee email + password login
  // ----------------------------------------------------------------------
  async loginWithEmail(
    email: string,
    password: string,
  ): Promise<{
    token: string;
    user: Partial<User>;
    first_login_required: boolean;
  }> {
    if (!email || !password) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials.',
      });
    }
    const user = await this.userRepo.findOne({
      where: { gmail: email.trim().toLowerCase() },
      relations: ['roleType'],
    });
    if (!user || !user.password_hash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials.',
      });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials.',
      });
    }
    if (!user.is_active && !user.first_login_required) {
      // Deactivated after activation.
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is inactive. Contact your admin.',
      });
    }

    const token = this.signUserToken(user);
    return {
      token,
      user: this.publicUser(user),
      first_login_required: user.first_login_required,
    };
  }

  // ----------------------------------------------------------------------
  // Complete first-login profile + set new password → activate
  // ----------------------------------------------------------------------
  async activateAccount(
    userId: string,
    dto: ActivateAccountDto,
  ): Promise<{ token: string; user: Partial<User> }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roleType'],
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }
    if (!user.first_login_required) {
      throw new ConflictException({
        code: 'ALREADY_ACTIVATED',
        message: 'Account is already activated.',
      });
    }

    // Password validation
    if (
      !dto.new_password ||
      dto.new_password.length < PASSWORD_MIN_LEN ||
      !/[A-Za-z]/.test(dto.new_password) ||
      !/\d/.test(dto.new_password)
    ) {
      throw new UnprocessableEntityException({
        code: 'PASSWORD_TOO_WEAK',
        message:
          'Password must be at least 8 characters and include a letter and a digit.',
      });
    }
    if (dto.new_password !== dto.confirm_password) {
      throw new UnprocessableEntityException({
        code: 'PASSWORD_MISMATCH',
        message: 'Passwords do not match.',
      });
    }
    // Must differ from the random invite password they received
    if (user.password_hash) {
      const reused = await bcrypt.compare(dto.new_password, user.password_hash);
      if (reused) {
        throw new UnprocessableEntityException({
          code: 'PASSWORD_REUSE',
          message: 'New password must differ from the invite password.',
        });
      }
    }

    // Apply profile fields
    if (dto.phone !== undefined) user.phone = dto.phone || null;
    if (dto.dob !== undefined) user.dob = dto.dob || null;
    if (dto.gender_id !== undefined) user.gender_id = dto.gender_id || null;
    if (dto.qualification_id !== undefined)
      user.qualification_id = dto.qualification_id || null;
    if (dto.department_id !== undefined)
      user.department_id = dto.department_id || null;
    if (dto.join_date !== undefined) user.join_date = dto.join_date || null;
    if (dto.photo_s3_key !== undefined)
      user.photo_s3_key = dto.photo_s3_key || null;
    if (dto.resume_s3_key !== undefined)
      user.resume_s3_key = dto.resume_s3_key || null;

    user.password_hash = await bcrypt.hash(dto.new_password, BCRYPT_COST);
    user.first_login_required = false;
    user.is_active = true;
    user.invite_token = null;
    user.invite_token_expires_at = null;

    const saved = await this.userRepo.save(user);

    // Fire-and-forget activation email (don't let delivery failure break the flow)
    this.notifications
      .dispatch(
        'user.activated',
        [{ userId: saved.id, email: saved.gmail }],
        { name: saved.name },
      )
      .catch((e) =>
        this.logger.error(
          `Failed to send user.activated to ${saved.gmail}: ${String(e)}`,
        ),
      );

    const token = this.signUserToken(saved);
    return { token, user: this.publicUser(saved) };
  }

  // ----------------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------------

  /**
   * Random password with mixed alphanumerics. Avoids visually-ambiguous
   * characters (0/O, 1/l/I) to reduce support friction.
   */
  generateRandomPassword(length: number): string {
    const alphabet =
      'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alphabet[buf[i] % alphabet.length];
    }
    // Guarantee at least one letter + one digit
    if (!/[A-Za-z]/.test(out)) out = 'A' + out.slice(1);
    if (!/\d/.test(out)) out = out.slice(0, -1) + '7';
    return out;
  }

  private async sendInviteEmail(params: {
    user: User;
    plainPassword: string;
    inviteToken: string;
    expiresInDays: number;
  }): Promise<void> {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const loginUrl = `${frontendUrl}/login?invite=${params.inviteToken}`;

    try {
      await this.notifications.dispatch(
        'user.invited',
        [{ userId: params.user.id, email: params.user.gmail }],
        {
          name: params.user.name,
          email: params.user.gmail,
          plain_password: params.plainPassword,
          login_url: loginUrl,
          expires_in_days: String(params.expiresInDays),
        },
      );
    } catch (e) {
      this.logger.error(
        `Failed to send user.invited to ${params.user.gmail}: ${String(e)}`,
      );
      // Do not rethrow — the invite row is already persisted. Admin can
      // retry via the Resend Invite action.
    }
  }

  private signUserToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.gmail,
      role: user.roleType?.system_key || 'employee',
      name: user.name,
      is_active: user.is_active,
      ...(user.first_login_required
        ? { first_login_required: true as unknown as boolean }
        : {}),
    } as JwtPayload;
    return this.jwtService.sign(payload);
  }

  private publicUser(user: User): Partial<User> & {
    first_login_required: boolean;
  } {
    return {
      id: user.id,
      gmail: user.gmail,
      name: user.name,
      emp_number: user.emp_number,
      is_active: user.is_active,
      first_login_required: user.first_login_required,
    };
  }
}
