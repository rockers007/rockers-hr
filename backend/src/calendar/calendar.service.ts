import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { LeaveRequest } from '../leave/entities/leave-request.entity';

export interface CreateCalendarEventParams {
  leaveRequestId: string;
  employeeName: string;
  employeeEmail: string;
  leaveTypeLabel: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  workingDays: number;
}

export interface UserCalendarTokens {
  access_token: string;
  refresh_token?: string | null;
}

@Injectable()
export class CalendarService implements OnModuleInit {
  private readonly logger = new Logger(CalendarService.name);
  private calendar: calendar_v3.Calendar | null = null;
  private oauth2Client: OAuth2Client | null = null;
  private clientId: string | undefined;
  private clientSecret: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
  ) {}

  onModuleInit() {
    this.clientId = this.configService.get<string>('GOOGLE_CALENDAR_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('GOOGLE_CALENDAR_CLIENT_SECRET');
    const callbackUrl = this.configService.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:4000/api/v1/calendar/oauth/callback',
    );

    if (this.clientId && this.clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        callbackUrl,
      );
      this.calendar = google.calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });
      this.logger.log('Google Calendar API initialized');
    } else {
      this.logger.warn(
        'Google Calendar credentials not configured — calendar sync disabled',
      );
    }
  }

  isConfigured(): boolean {
    return this.clientId !== undefined && this.clientSecret !== undefined;
  }

  /**
   * Create an OAuth2 client with user-specific tokens.
   */
  private createUserClient(tokens: UserCalendarTokens): calendar_v3.Calendar | null {
    if (!this.clientId || !this.clientSecret) return null;

    const userAuth = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
    );
    userAuth.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? undefined,
    });

    return google.calendar({ version: 'v3', auth: userAuth });
  }

  /**
   * Set OAuth2 tokens (called after admin completes OAuth flow)
   */
  setCredentials(tokens: { access_token: string; refresh_token?: string }) {
    if (this.oauth2Client) {
      this.oauth2Client.setCredentials(tokens);
    }
  }

  /**
   * Get the OAuth2 authorization URL for admin to authorize calendar access
   */
  getAuthUrl(): string | null {
    if (!this.oauth2Client) return null;
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      prompt: 'consent',
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<any> {
    if (!this.oauth2Client) return null;
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  /**
   * Create a calendar event on a user's Google Calendar.
   * Uses the user's own OAuth tokens to write to their primary calendar.
   * Called at Level 2 (HR final) approval.
   *
   * Title format: [{{leave_type}}] {{employee_name}}
   */
  async createEventForUser(
    params: CreateCalendarEventParams,
    userTokens: UserCalendarTokens,
  ): Promise<string | null> {
    const userCalendar = this.createUserClient(userTokens);
    if (!userCalendar) {
      this.logger.warn(
        `Calendar not configured — skipping event for ${params.employeeEmail}`,
      );
      return null;
    }

    try {
      const endDateExclusive = this.addDays(params.endDate, 1);

      const event: calendar_v3.Schema$Event = {
        summary: `[${params.leaveTypeLabel}] ${params.employeeName}`,
        start: { date: params.startDate },
        end: { date: endDateExclusive },
        description: `Leave approved via Rockers HR.\nType: ${params.leaveTypeLabel}\nDuration: ${params.workingDays} working day(s).`,
      };

      const response = await userCalendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'none',
      });

      const eventId = response.data.id ?? null;
      this.logger.log(
        `Calendar event created on ${params.employeeEmail}'s calendar: ${eventId}`,
      );
      return eventId;
    } catch (error) {
      this.logger.error(
        `Failed to create calendar event on ${params.employeeEmail}'s calendar`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  /**
   * Create calendar events for both the employee and their manager.
   * Stores the employee's event ID on the leave request.
   */
  async createEventsForLeave(
    params: CreateCalendarEventParams,
    employeeTokens: UserCalendarTokens | null,
    managerTokens: UserCalendarTokens | null,
  ): Promise<void> {
    // Employee calendar
    if (employeeTokens?.access_token) {
      const eventId = await this.createEventForUser(params, employeeTokens);
      if (eventId) {
        await this.leaveRequestRepo.update(params.leaveRequestId, {
          calendar_event_id: eventId,
        });
      }
    } else {
      this.logger.warn(
        `No Google tokens for employee ${params.employeeEmail} — skipping employee calendar`,
      );
    }

    // Manager calendar
    if (managerTokens?.access_token) {
      await this.createEventForUser(params, managerTokens);
    } else {
      this.logger.warn(
        `No Google tokens for manager — skipping manager calendar`,
      );
    }
  }

  /**
   * Legacy createEvent for backward compatibility (uses shared client).
   */
  async createEvent(
    params: CreateCalendarEventParams,
  ): Promise<string | null> {
    if (!this.calendar) {
      this.logger.warn(
        'Calendar not configured — skipping event creation for leave request ' +
          params.leaveRequestId,
      );
      return null;
    }

    try {
      const endDateExclusive = this.addDays(params.endDate, 1);

      const event: calendar_v3.Schema$Event = {
        summary: `[${params.leaveTypeLabel}] ${params.employeeName}`,
        start: { date: params.startDate },
        end: { date: endDateExclusive },
        description: `Leave approved via Rockers HR. Type: ${params.leaveTypeLabel}. Duration: ${params.workingDays} working days.`,
        attendees: [{ email: params.employeeEmail }],
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all',
      });

      const eventId = response.data.id ?? null;

      if (eventId) {
        await this.leaveRequestRepo.update(params.leaveRequestId, {
          calendar_event_id: eventId,
        });
        this.logger.log(
          `Calendar event created: ${eventId} for leave request ${params.leaveRequestId}`,
        );
      }

      return eventId;
    } catch (error) {
      this.logger.error(
        `Failed to create calendar event for leave request ${params.leaveRequestId}`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  /**
   * Delete a calendar event (e.g., on leave cancellation).
   * Uses the user's tokens if provided, else falls back to shared client.
   */
  async deleteEvent(
    calendarEventId: string,
    userTokens?: UserCalendarTokens | null,
  ): Promise<boolean> {
    const cal = userTokens?.access_token
      ? this.createUserClient(userTokens)
      : this.calendar;

    if (!cal) {
      this.logger.warn(
        'Calendar not configured — skipping event deletion for event ' +
          calendarEventId,
      );
      return false;
    }

    try {
      await cal.events.delete({
        calendarId: 'primary',
        eventId: calendarEventId,
        sendUpdates: 'all',
      });
      this.logger.log(`Calendar event deleted: ${calendarEventId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete calendar event ${calendarEventId}`,
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }

  /**
   * Get team leave calendar data for UI display.
   */
  async getTeamCalendar(query: {
    from?: string;
    to?: string;
    department_id?: string;
  }): Promise<any[]> {
    const qb = this.leaveRequestRepo
      .createQueryBuilder('lr')
      .innerJoinAndSelect('lr.user', 'user')
      .innerJoinAndSelect('lr.leaveType', 'leaveType')
      .innerJoinAndSelect('lr.durationType', 'durationType')
      .where('lr.status = :status', { status: 'APPROVED' });

    if (query.from) {
      qb.andWhere('lr.end_date >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('lr.start_date <= :to', { to: query.to });
    }
    if (query.department_id) {
      qb.andWhere('user.department_id = :deptId', {
        deptId: query.department_id,
      });
    }

    qb.orderBy('lr.start_date', 'ASC');

    const requests = await qb.getMany();

    return requests.map((lr) => ({
      id: lr.id,
      title: `[${lr.leaveType.label}] ${lr.user.name}`,
      start: lr.start_date,
      end: lr.end_date,
      color: lr.leaveType.color,
      employee: {
        id: lr.user.id,
        name: lr.user.name,
      },
      leave_type: {
        id: lr.leaveType.id,
        label: lr.leaveType.label,
        color: lr.leaveType.color,
      },
      duration_type: lr.durationType.label,
      working_days: lr.working_days,
    }));
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }
}
