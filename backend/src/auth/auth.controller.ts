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
import { AdminLoginDto } from './auth.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
    const profile = req.user as { email: string; name: string; photo?: string };
    const result = await this.authService.handleGoogleLogin({
      email: profile.email,
      name: profile.name,
      picture: profile.photo,
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    // Redirect to frontend with token + status in query params
    const redirectUrl = new URL('/auth/callback', frontendUrl);
    redirectUrl.searchParams.set('status', result.status);
    redirectUrl.searchParams.set('token', result.token);

    res.redirect(redirectUrl.toString());
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
