import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual } from 'typeorm';
import { LeaveApproval } from '../leave/entities/leave-approval.entity';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';
import { MasterPublicHoliday } from '../master/entities/master-public-holiday.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from './notifications.service';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    @InjectRepository(LeaveApproval)
    private readonly approvalRepo: Repository<LeaveApproval>,
    @InjectRepository(LeaveRequest)
    private readonly requestRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance)
    private readonly balanceRepo: Repository<LeaveBalance>,
    @InjectRepository(MasterSlaConfig)
    private readonly slaConfigRepo: Repository<MasterSlaConfig>,
    @InjectRepository(MasterPublicHoliday)
    private readonly holidayRepo: Repository<MasterPublicHoliday>,
    @InjectRepository(MasterLeaveType)
    private readonly leaveTypeRepo: Repository<MasterLeaveType>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('* * * * *')
  async enforceSlaWindows(): Promise<void> {
    try {
      await this.processReminders();
      await this.processEscalations();
    } catch (error) {
      this.logger.error('SLA enforcement job failed', error);
    }
  }

  private async processReminders(): Promise<void> {
    const now = new Date();

    const pendingReminders = await this.approvalRepo
      .createQueryBuilder('la')
      .innerJoinAndSelect('la.leaveRequest', 'lr')
      .innerJoinAndSelect('lr.user', 'emp')
      .innerJoinAndSelect('lr.leaveType', 'lt')
      .innerJoinAndSelect('la.approver', 'mgr')
      .where('la.level = :level', { level: 1 })
      .andWhere('la.action IS NULL')
      .andWhere('la.escalated = false')
      .andWhere('la.reminder_sent = false')
      .andWhere('la.reminder_deadline <= :now', { now })
      .getMany();

    for (const approval of pendingReminders) {
      const request = approval.leaveRequest;
      const employee = request.user;
      const manager = approval.approver;
      const leaveType = request.leaveType;

      const slaRemaining = await this.calcSlaRemaining(approval);

      await this.notificationsService.dispatch(
        'sla.reminder',
        [{ userId: manager.id, email: manager.gmail }],
        {
          employee_name: employee.name,
          manager_name: manager.name,
          leave_type: leaveType.label,
          dates: `${request.start_date} to ${request.end_date}`,
          start_date: request.start_date,
          end_date: request.end_date,
          working_days: String(request.working_days),
          sla_remaining: slaRemaining,
        },
      );

      await this.approvalRepo.update(approval.id, { reminder_sent: true });
      this.logger.log(`SLA reminder sent for approval ${approval.id}`);
    }
  }

  private async processEscalations(): Promise<void> {
    const now = new Date();

    const pendingEscalations = await this.approvalRepo
      .createQueryBuilder('la')
      .innerJoinAndSelect('la.leaveRequest', 'lr')
      .innerJoinAndSelect('lr.user', 'emp')
      .innerJoinAndSelect('lr.leaveType', 'lt')
      .innerJoinAndSelect('la.approver', 'mgr')
      .where('la.level = :level', { level: 1 })
      .andWhere('la.action IS NULL')
      .andWhere('la.escalated = false')
      .andWhere('la.sla_deadline <= :now', { now })
      .getMany();

    // Find HR admins for escalation notifications
    const hrAdmins = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('admin_users', 'au', 'au.user_id = u.id')
      .innerJoin('master_admin_roles', 'mar', 'mar.id = au.role_id')
      .where('u.is_active = true')
      .andWhere("mar.name IN (:...roles)", { roles: ['HR Admin', 'Super Admin'] })
      .getMany();

    for (const approval of pendingEscalations) {
      const request = approval.leaveRequest;
      const employee = request.user;
      const leaveType = request.leaveType;

      // Mark as escalated
      await this.approvalRepo.update(approval.id, {
        escalated: true,
        escalated_at: new Date(),
      });

      // Update leave request status to ESCALATED
      await this.requestRepo.update(request.id, { status: 'ESCALATED' });

      // Create Level 2 approval record for HR
      // Pick the first HR admin as the default approver
      if (hrAdmins.length > 0) {
        const hrApprover = hrAdmins[0];
        const l2Deadline = await this.calcSlaDeadline(new Date());

        const l2Approval = this.approvalRepo.create({
          leave_request_id: request.id,
          level: 2,
          approver_id: hrApprover.id,
          sla_deadline: l2Deadline.slaDeadline,
          reminder_deadline: l2Deadline.reminderDeadline,
        });
        await this.approvalRepo.save(l2Approval);
      }

      const tokens = {
        employee_name: employee.name,
        leave_type: leaveType.label,
        dates: `${request.start_date} to ${request.end_date}`,
        start_date: request.start_date,
        end_date: request.end_date,
        working_days: String(request.working_days),
      };

      // Notify HR admins
      if (hrAdmins.length > 0) {
        await this.notificationsService.dispatch(
          'sla.escalated.hr',
          hrAdmins.map((hr) => ({ userId: hr.id, email: hr.gmail })),
          tokens,
        );
      }

      // Notify employee
      await this.notificationsService.dispatch(
        'sla.escalated.employee',
        [{ userId: employee.id, email: employee.gmail }],
        tokens,
      );

      this.logger.log(`SLA escalation for approval ${approval.id}, request ${request.id}`);
    }
  }

  @Cron('0 0 1 1 *')
  async resetAnnualBalances(): Promise<void> {
    try {
      const newYear = new Date().getFullYear();
      const activeUsers = await this.userRepo.find({ where: { is_active: true } });
      const activeLeaveTypes = await this.leaveTypeRepo.find({ where: { is_active: true } });

      for (const user of activeUsers) {
        for (const leaveType of activeLeaveTypes) {
          const existing = await this.balanceRepo.findOne({
            where: { user_id: user.id, leave_type_id: leaveType.id, year: newYear },
          });

          if (!existing) {
            const balance = this.balanceRepo.create({
              user_id: user.id,
              leave_type_id: leaveType.id,
              year: newYear,
              total_days: leaveType.annual_days,
              used_days: 0,
              pending_days: 0,
            });
            await this.balanceRepo.save(balance);
          }
        }
      }

      this.logger.log(`Annual balance reset completed for year ${newYear}`);
    } catch (error) {
      this.logger.error('Annual balance reset failed', error);
    }
  }

  @Cron('0 9 20 12 *')
  async sendBalanceExpiryReminders(): Promise<void> {
    try {
      const currentYear = new Date().getFullYear();

      const balances = await this.balanceRepo
        .createQueryBuilder('lb')
        .innerJoinAndSelect('lb.user', 'u')
        .innerJoinAndSelect('lb.leaveType', 'lt')
        .where('lb.year = :year', { year: currentYear })
        .andWhere('(lb.total_days - lb.used_days - lb.pending_days) > 0')
        .andWhere('u.is_active = true')
        .getMany();

      for (const balance of balances) {
        const remaining = Number(balance.total_days) - Number(balance.used_days) - Number(balance.pending_days);

        await this.notificationsService.dispatch(
          'balance.expiry',
          [{ userId: balance.user.id, email: balance.user.gmail }],
          {
            employee_name: balance.user.name,
            leave_type: balance.leaveType.label,
            days: String(remaining),
            year: String(currentYear),
          },
        );
      }

      this.logger.log(`Balance expiry reminders sent for ${balances.length} balances`);
    } catch (error) {
      this.logger.error('Balance expiry reminder job failed', error);
    }
  }

  private async calcSlaRemaining(approval: LeaveApproval): Promise<string> {
    const now = new Date();
    const deadline = new Date(approval.sla_deadline);
    const diffMs = deadline.getTime() - now.getTime();

    if (diffMs <= 0) return '0 minutes';

    const hours = Math.floor(diffMs / 3_600_000);
    const minutes = Math.floor((diffMs % 3_600_000) / 60_000);

    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  async calcSlaDeadline(
    from: Date,
  ): Promise<{ slaDeadline: Date; reminderDeadline: Date }> {
    const configs = await this.slaConfigRepo.find();
    const configMap = new Map(configs.map((c) => [c.config_key, c.config_value]));

    const businessStart = configMap.get('sla.business_hours_start') || '09:00';
    const businessEnd = configMap.get('sla.business_hours_end') || '18:00';
    const managerWindowHours = parseFloat(configMap.get('sla.manager_window_hours') || '5');
    const reminderAtHours = parseFloat(configMap.get('sla.reminder_at_hours') || '4');

    const holidays = await this.getHolidaysForYear(from.getFullYear());

    const slaDeadline = this.addBusinessHours(from, managerWindowHours, businessStart, businessEnd, holidays);
    const reminderDeadline = this.addBusinessHours(from, reminderAtHours, businessStart, businessEnd, holidays);

    return { slaDeadline, reminderDeadline };
  }

  private addBusinessHours(
    from: Date,
    hours: number,
    businessStart: string,
    businessEnd: string,
    holidays: Set<string>,
  ): Date {
    let remaining = hours;
    const cursor = new Date(from);

    const [startH, startM] = businessStart.split(':').map(Number);
    const [endH, endM] = businessEnd.split(':').map(Number);
    const businessDayHours = (endH + endM / 60) - (startH + startM / 60);

    while (remaining > 0) {
      const dow = cursor.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const dateStr = cursor.toISOString().split('T')[0];
      const isHoliday = holidays.has(dateStr);

      if (!isWeekend && !isHoliday) {
        const dayStart = new Date(cursor);
        dayStart.setHours(startH, startM, 0, 0);
        const dayEnd = new Date(cursor);
        dayEnd.setHours(endH, endM, 0, 0);

        const windowStart = cursor < dayStart ? dayStart : cursor;
        const windowEnd = dayEnd;

        if (windowStart < windowEnd) {
          const availableHours = (windowEnd.getTime() - windowStart.getTime()) / 3_600_000;

          if (remaining <= availableHours) {
            return new Date(windowStart.getTime() + remaining * 3_600_000);
          }
          remaining -= availableHours;
        }
      }

      // Move to next day at business start
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(startH, startM, 0, 0);
    }

    return cursor;
  }

  private async getHolidaysForYear(year: number): Promise<Set<string>> {
    const holidays = await this.holidayRepo.find({
      where: { year, is_active: true },
    });
    return new Set(holidays.map((h) => h.date));
  }
}
