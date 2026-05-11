import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { InviteAuthService } from './invite-auth.service';
import {
  AdminLoginDto,
  EmployeeLoginDto,
  ActivateAccountHttpDto,
  ChangePasswordHttpDto,
  FinishPasswordResetHttpDto,
  JwtPayload,
} from './auth.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { AuditLog } from '../audit/audit.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly inviteAuth: InviteAuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /api/v1/auth/login/email  (v2.0 admin-invite flow)
   * Employee logs in with email + password. Returns first_login_required
   * flag so the frontend can route to /complete-profile on first login.
   */
  @Post('login/email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async loginEmail(@Body() dto: EmployeeLoginDto) {
    const result = await this.inviteAuth.loginWithEmail(dto.email, dto.password);
    return {
      data: {
        token: result.token,
        user: result.user,
        first_login_required: result.first_login_required,
      },
    };
  }

  /**
   * POST /api/v1/auth/activate-account  (v2.0 admin-invite flow)
   * First-login profile completion + password reset → activates account.
   */
  @Post('activate-account')
  @UseGuards(JwtAuthGuard)
  @AuditLog({ action: 'activate_account', entityType: 'user', method: 'POST' })
  async activateAccount(
    @Body() dto: ActivateAccountHttpDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.inviteAuth.activateAccount(user.sub, dto);
    return { data: result };
  }

  /**
   * GET /api/v1/auth/google
   * Redirects to Google OAuth consent screen.
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  googleLogin() {
    // Passport redirects to Google automatically
  }

  /**
   * GET /api/v1/auth/google/callback
   * Handles the OAuth callback from Google.
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as {
      email: string;
      name: string;
      photo?: string;
      accessToken?: string;
      refreshToken?: string;
    };
    const result = await this.authService.handleGoogleLogin({
      email: profile.email,
      name: profile.name,
      picture: profile.photo,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    // Redirect to frontend with token + status in query params
    const redirectUrl = new URL('/auth/callback', frontendUrl);
    redirectUrl.searchParams.set('status', result.status);
    redirectUrl.searchParams.set('token', result.token);

    res.redirect(redirectUrl.toString());
  }

  /**
   * POST /api/v1/auth/change-password
   * Employee self-service — rotate own password.
   * Body: { current_password, new_password, confirm_password }
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @AuditLog({ action: 'change_password', entityType: 'user', method: 'POST' })
  async changePassword(
    @Body() dto: ChangePasswordHttpDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Service returns { changed_at, token, user } — frontend MUST swap
    // its localStorage token because tokens_valid_from is bumped by the
    // change, which would otherwise reject the next request with 401.
    const result = await this.inviteAuth.changeMyPassword(user.sub, dto);
    return { data: result };
  }

  /**
   * POST /api/v1/auth/finish-password-reset
   *
   * Endpoint for the admin-triggered password reset flow. The user
   * already authenticated with the temp password emailed to them, so
   * the only thing we ask for here is the new password + confirmation.
   * Distinct from /change-password (which needs the current password)
   * and /activate-account (which collects the full profile).
   */
  @Post('finish-password-reset')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @AuditLog({ action: 'finish_password_reset', entityType: 'user', method: 'POST' })
  async finishPasswordReset(
    @Body() dto: FinishPasswordResetHttpDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.inviteAuth.finishPasswordReset(user.sub, dto);
    return { data: result };
  }

  /**
   * POST /api/v1/auth/logout
   * Clears session (stateless JWT — client discards token).
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout() {
    // With stateless JWT, logout is handled client-side by discarding the token.
    // In future, implement token blacklist if needed.
    return;
  }
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/admin/auth/login
   * Admin email + password login.
   */
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() dto: AdminLoginDto) {
    const result = await this.authService.adminLogin(dto.email, dto.password);
    return result;
  }

  /**
   * POST /api/v1/admin/auth/logout
   * Admin logout (stateless).
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  adminLogout() {
    return;
  }
}
