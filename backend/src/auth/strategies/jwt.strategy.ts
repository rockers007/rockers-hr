import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { User } from '../../users/entities/user.entity';
import { AdminUser } from '../../users/entities/admin-user.entity';
import { JwtPayload } from '../auth.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-dev-secret',
    });
  }

  async validate(payload: JwtPayload & { iat?: number }): Promise<JwtPayload> {
    // Allow temp JWTs for registration and pending activation flows
    if (payload.role === 'registration' || payload.role === 'pending') {
      return payload;
    }

    if (payload.is_admin) {
      // Admin tokens: sub is users.id but we enforce the session cutoff
      // from admin_users.tokens_valid_from so admin password changes /
      // unlocks invalidate prior sessions.
      const adminUser = await this.adminUserRepo.findOne({
        where: { user_id: payload.sub },
      });
      if (!adminUser || !adminUser.is_active) {
        throw new UnauthorizedException('Admin account is not active');
      }
      if (
        payload.iat &&
        adminUser.tokens_valid_from &&
        // JWT `iat` is whole seconds; DB timestamps are millisecond-precise.
        // Allow a 2-second grace window so a token signed within the same
        // second that tokens_valid_from was written is still accepted.
        payload.iat * 1000 + 2000 <
          adminUser.tokens_valid_from.getTime()
      ) {
        throw new UnauthorizedException('Session expired, please log in again');
      }
      return payload;
    }

    // Re-validate that user is still active
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Allow inactive users only if they have registration_required status (temp JWT)
    if (!user.is_active && payload.is_active !== false) {
      throw new UnauthorizedException('Account is not active');
    }

    // Reject tokens that predate the user's tokens_valid_from cutoff — this
    // is how password changes invalidate sessions without needing a full
    // token blocklist. Allow a 2-second grace window because JWT iat is
    // whole seconds while tokens_valid_from is millisecond-precise.
    if (
      payload.iat &&
      user.tokens_valid_from &&
      payload.iat * 1000 + 2000 < user.tokens_valid_from.getTime()
    ) {
      throw new UnauthorizedException('Session expired, please log in again');
    }

    return payload;
  }
}
