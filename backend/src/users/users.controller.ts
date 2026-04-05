import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  async register(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterUserDto,
  ) {
    const created = await this.usersService.register(user.email, dto, {
      google_access_token: (user as any).google_access_token,
      google_refresh_token: (user as any).google_refresh_token,
    });
    return {
      data: {
        status: 'pending_activation',
        message: 'Your profile is under HR review.',
      },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('sub') userId: string) {
    const data = await this.usersService.getProfile(userId);
    return { data };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const data = await this.usersService.updateProfile(userId, dto);
    return { data };
  }

  @Patch('me/fcm-token')
  @UseGuards(JwtAuthGuard)
  async updateFcmToken(
    @CurrentUser('sub') userId: string,
    @Body('fcm_token') fcmToken: string,
  ) {
    await this.usersService.updateFcmToken(userId, fcmToken);
    return { data: { status: 'token_updated' } };
  }
}
