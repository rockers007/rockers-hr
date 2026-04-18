import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { User } from '../../users/entities/user.entity';
import { JwtPayload } from '../auth.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Allow temp JWTs for registration and pending activation flows
    if (payload.role === 'registration' || payload.role === 'pending') {
      return payload;
    }

    // Admin tokens: sub is admin_users.id, not users.id — skip user table lookup
    if (payload.is_admin) {
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

    return payload;
  }
}
