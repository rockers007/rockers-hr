import { Controller, Get, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';

// TODO: Add @UseGuards(JwtAuthGuard) once auth module is ready
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  /**
   * GET /api/v1/calendar
   * Returns approved leave requests in calendar-friendly format with colors.
   */
  @Get()
  async getTeamCalendar(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('department_id') departmentId?: string,
  ) {
    const events = await this.calendarService.getTeamCalendar({
      from,
      to,
      department_id: departmentId,
    });
    return { data: events };
  }

  /**
   * GET /api/v1/calendar/oauth/url
   * Returns the Google OAuth URL for admin to authorize calendar access.
   */
  @Get('oauth/url')
  getOAuthUrl() {
    const url = this.calendarService.getAuthUrl();
    if (!url) {
      return {
        error: {
          code: 'CALENDAR_NOT_CONFIGURED',
          message: 'Google Calendar credentials are not configured.',
          statusCode: 503,
        },
      };
    }
    return { data: { auth_url: url } };
  }

  /**
   * GET /api/v1/calendar/oauth/callback
   * Handles Google OAuth callback and stores tokens.
   */
  @Get('oauth/callback')
  async handleOAuthCallback(@Query('code') code: string) {
    if (!code) {
      return {
        error: {
          code: 'MISSING_CODE',
          message: 'Authorization code is required.',
          statusCode: 400,
        },
      };
    }
    const tokens = await this.calendarService.exchangeCode(code);
    return {
      data: { status: 'calendar_connected', has_refresh_token: !!tokens?.refresh_token },
    };
  }
}
