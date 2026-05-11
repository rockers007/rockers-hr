import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { AdminUser } from '../users/entities/admin-user.entity';
import { MasterAdminRole } from '../master/entities/master-admin-role.entity';
import { MasterRoleType } from '../master/entities/master-role-type.entity';
import { AuthController, AdminAuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InviteAuthService } from './invite-auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AdminUser, MasterAdminRole, MasterRoleType]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'fallback-dev-secret',
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      }),
    }),
    NotificationsModule,
  ],
  controllers: [AuthController, AdminAuthController],
  providers: [
    AuthService,
    InviteAuthService,
    GoogleStrategy,
    JwtStrategy,
    JwtAuthGuard,
    AdminJwtGuard,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    InviteAuthService,
    JwtAuthGuard,
    AdminJwtGuard,
    PermissionsGuard,
    JwtModule,
  ],
})
export class AuthModule {}
