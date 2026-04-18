import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveApproval } from './entities/leave-approval.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { MasterLeaveDuration } from '../master/entities/master-leave-duration.entity';
import { MasterPublicHoliday } from '../master/entities/master-public-holiday.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SlaService } from '../notifications/sla.service';
import { CalendarService } from '../calendar/calendar.service';
import {
  CalculateLeaveDto,
  CreateLeaveRequestDto,
  AdminCreateLeaveRequestDto,
  QueryLeaveRequestsDto,
  AdminQueryLeaveRequestsDto,
} from './dto';
import { PaginatedResult } from '../common/dto/pagination.dto';

export interface CalculateResult {
  working_days: number;
  sandwich_days: number;
  balance_before: number;
  balance_after: number;
  sandwich_detected: boolean;
  sandwich_detail: string | null;
  doc_required: boolean;
}

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    @InjectRepository(LeaveRequest)
    private readonly requestRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveApproval)
    private readonly approvalRepo: Repository<LeaveApproval>,
    @InjectRepository(LeaveBalance)
    private readonly balanceRepo: Repository<LeaveBalance>,
    @InjectRepository(MasterLeaveType)
    private readonly leaveTypeRepo: Repository<MasterLeaveType>,
    @InjectRepository(MasterLeaveDuration)
    private readonly durationRepo: Repository<MasterLeaveDuration>,
    @InjectRepository(MasterPublicHoliday)
    private readonly holidayRepo: Repository<MasterPublicHoliday>,
    @InjectRepository(MasterSlaConfig)
    private readonly slaConfigRepo: Repository<MasterSlaConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly slaService: SlaService,
    private readonly calendarService: CalendarService,
  ) {}

  // ─── Eligible leave types (probation-filtered) ───

  async getEligibleLeaveTypes(userId: string): Promise<MasterLeaveType[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const allTypes = await this.leaveTypeRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC' },
    });

    const inProbation = await this.isInProbation(user);
    if (!inProbation) return allTypes;

    // During probation: only LWP and Early Leave (hours-based) are allowed
    return allTypes.filter((t) => t.system_key === 'LWP' || t.unit === 'hours');
  }

  // ─── Calculate working days & sandwich detection ───

  async calculate(
    userId: string,
    dto: CalculateLeaveDto,
  ): Promise<CalculateResult> {
    const leaveType = await this.leaveTypeRepo.findOne({
      where: { id: dto.leave_type_id, is_active: true },
    });
    if (!leaveType) throw new BadRequestException('Invalid leave type');

    const duration = await this.durationRepo.findOne({
      where: { id: dto.duration_type_id, is_active: true },
    });
    if (!duration) throw new BadRequestException('Invalid duration type');

    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);
    if (endDate < startDate) {
      throw new BadRequestException('End date must be >= start date');
    }

    const year = startDate.getFullYear();
    const holidays = await this.getHolidayDates(year);
    const dayValue = Number(duration.day_value);

    // Early Leave (hours-based) — completely different calculation
    const isEarlyLeave = leaveType.unit === 'hours';
    if (isEarlyLeave) {
      let earlyHours = 0;
      if (dto.early_leave_start_time && dto.early_leave_end_time) {
        const [sh, sm] = dto.early_leave_start_time.split(':').map(Number);
        const [eh, em] = dto.early_leave_end_time.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        if (endMin > startMin) {
          earlyHours = Number(((endMin - startMin) / 60).toFixed(2));
        }
      }

      const balance = await this.balanceRepo.findOne({
        where: { user_id: userId, leave_type_id: dto.leave_type_id, year },
      });
      const available = balance
        ? Number(balance.total_days) - Number(balance.used_days) - Number(balance.pending_days)
        : 0;

      if (earlyHours > 2) {
        throw new BadRequestException('Early leave is allowed for a maximum of 2 hours only.');
      }

      // Monthly short/early leave limit check — max 1 per month
      // Run this in calculate so the error shows on Step 1, not at submit
      if (dto.early_leave_date) {
        const earlyDateStr = dto.early_leave_date; // "YYYY-MM-DD"
        const [eyear, emonth] = earlyDateStr.split('-').map(Number);
        const monthStartStr = `${eyear}-${String(emonth).padStart(2, '0')}-01`;
        const nextMonth = emonth === 12 ? 1 : emonth + 1;
        const nextYear = emonth === 12 ? eyear + 1 : eyear;
        const monthEndStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

        const existingEarlyCount = await this.requestRepo
          .createQueryBuilder('lr')
          .where('lr.user_id = :userId', { userId })
          .andWhere('lr.leave_type_id = :typeId', { typeId: leaveType.id })
          .andWhere('lr.status IN (:...statuses)', {
            statuses: ['PENDING_L1', 'PENDING_L2', 'APPROVED'],
          })
          .andWhere('lr.early_leave_date >= :monthStart', { monthStart: monthStartStr })
          .andWhere('lr.early_leave_date < :monthEnd', { monthEnd: monthEndStr })
          .getCount();

        if (existingEarlyCount > 0) {
          const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const monthName = `${monthNames[emonth - 1]} ${eyear}`;
          throw new UnprocessableEntityException({
            code: 'EARLY_LEAVE_LIMIT',
            message: `Only 1 short/early leave is allowed per month. You already have one for ${monthName}.`,
          });
        }
      }

      // Early leave always counts as 1 day from balance
      return {
        working_days: 1,
        sandwich_days: 0,
        balance_before: available,
        balance_after: available - 1,
        sandwich_detected: false,
        sandwich_detail: null,
        doc_required: false,
      };
    }

    const baseWorkingDays = this.calcWorkingDays(
      startDate,
      endDate,
      dayValue,
      holidays,
    );

    // Max days per request check (validate early so user sees error on Step 1)
    if (leaveType.max_days_per_request && baseWorkingDays > leaveType.max_days_per_request) {
      throw new UnprocessableEntityException({
        code: 'MAX_DAYS_EXCEEDED',
        message: `${leaveType.label} allows maximum ${leaveType.max_days_per_request} days per request. You requested ${baseWorkingDays} days.`,
      });
    }

    // Sandwich detection — only applies to full-day leaves (dayValue === 1)
    const isFullDay = dayValue >= 1;

    // 1) Within-request sandwich (e.g., Mon-Fri leave with Wed holiday)
    const withinResult = isFullDay
      ? this.detectSandwich(startDate, endDate, holidays)
      : { detected: false, detail: null, sandwichDays: 0 };

    // 2) Cross-request sandwich (e.g., existing Fri leave + new Mon leave → Sat/Sun sandwiched)
    const crossResult = isFullDay
      ? await this.detectCrossRequestSandwich(userId, startDate, endDate, holidays)
      : { detected: false, detail: null, sandwichDays: 0 };

    const detected = withinResult.detected || crossResult.detected;
    const sandwichDays = withinResult.sandwichDays + crossResult.sandwichDays;
    const details: string[] = [];
    if (withinResult.detail) details.push(withinResult.detail);
    if (crossResult.detail) details.push(crossResult.detail);
    const detail = details.length > 0 ? details.join(' ') : null;

    // If sandwich detected, add the sandwiched non-working days to the total
    const totalDays = detected
      ? baseWorkingDays + sandwichDays
      : baseWorkingDays;

    // Balance
    const balance = await this.balanceRepo.findOne({
      where: { user_id: userId, leave_type_id: dto.leave_type_id, year },
    });
    const available = balance
      ? Number(balance.total_days) -
        Number(balance.used_days) -
        Number(balance.pending_days)
      : 0;

    // Document requirement
    const docRequired =
      leaveType.doc_required &&
      (leaveType.doc_threshold_days === null ||
        totalDays >= leaveType.doc_threshold_days);

    return {
      working_days: totalDays,
      sandwich_days: sandwichDays,
      balance_before: available,
      balance_after: available - totalDays,
      sandwich_detected: detected,
      sandwich_detail: detail,
      doc_required: docRequired,
    };
  }

  // ─── Submit leave request ───

  async submitRequest(
    userId: string,
    dto: CreateLeaveRequestDto,
    submittedBy?: string,
    adminNotes?: string,
  ): Promise<LeaveRequest> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const leaveType = await this.leaveTypeRepo.findOne({
      where: { id: dto.leave_type_id, is_active: true },
    });
    if (!leaveType) throw new BadRequestException('Invalid leave type');

    const duration = await this.durationRepo.findOne({
      where: { id: dto.duration_type_id, is_active: true },
    });
    if (!duration) throw new BadRequestException('Invalid duration type');

    // Block leave if employee's last working day has passed
    if (user.last_working_day) {
      const lastDay = new Date(user.last_working_day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      lastDay.setHours(0, 0, 0, 0);
      if (today > lastDay) {
        throw new UnprocessableEntityException({
          code: 'EMPLOYMENT_ENDED',
          message: 'Your last working day has passed. You can no longer apply for leave.',
        });
      }
    }

    // Block leave if employment status is not active
    if (user.employment_status && user.employment_status !== 'active') {
      throw new UnprocessableEntityException({
        code: 'EMPLOYMENT_INACTIVE',
        message: `Your employment status is "${user.employment_status}". You cannot apply for leave.`,
      });
    }

    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be >= start date');
    }

    // Block past dates — only today or future dates allowed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateOnly = new Date(startDate);
    startDateOnly.setHours(0, 0, 0, 0);
    if (startDateOnly < today) {
      throw new BadRequestException('Leave can only be applied for today or future dates. Past dates are not allowed.');
    }

    // 1. Probation check — during probation only LWP and Early Leave are allowed
    const inProbation = await this.isInProbation(user);
    if (inProbation) {
      if (leaveType.system_key !== 'LWP' && leaveType.unit !== 'hours') {
        throw new UnprocessableEntityException({
          code: 'PROBATION_RESTRICTION',
          message: 'During probation, you can only apply for Leave Without Pay (LWP) or Early Leave.',
        });
      }
    }

    // 1b. PL: Minimum 1 year tenure check
    if (leaveType.min_tenure_months > 0 && user.join_date) {
      const joinDate = new Date(user.join_date);
      const now = new Date();
      const monthsWorked =
        (now.getFullYear() - joinDate.getFullYear()) * 12 +
        (now.getMonth() - joinDate.getMonth());
      if (monthsWorked < leaveType.min_tenure_months) {
        throw new UnprocessableEntityException({
          code: 'MIN_TENURE_NOT_MET',
          message: `${leaveType.label} requires at least ${leaveType.min_tenure_months} months of service. You have ${monthsWorked} months.`,
        });
      }
    }

    // 1c. PL: Minimum advance days check
    if (leaveType.min_advance_days > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysInAdvance = Math.floor(
        (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysInAdvance < leaveType.min_advance_days) {
        throw new UnprocessableEntityException({
          code: 'INSUFFICIENT_ADVANCE_NOTICE',
          message: `${leaveType.label} must be applied at least ${leaveType.min_advance_days} days in advance. You applied ${daysInAdvance} days ahead.`,
        });
      }
    }

    // 1d. Early Leave (hours-based) handling
    const isEarlyLeave = leaveType.unit === 'hours';
    let earlyLeaveHours = 0;

    if (isEarlyLeave) {
      if (!dto.early_leave_date || !dto.early_leave_start_time || !dto.early_leave_end_time) {
        throw new BadRequestException(
          'Early Leave requires early_leave_date, early_leave_start_time, and early_leave_end_time.',
        );
      }
      // Block past dates for early leave too
      const earlyDateCheck = new Date(dto.early_leave_date);
      earlyDateCheck.setHours(0, 0, 0, 0);
      if (earlyDateCheck < today) {
        throw new BadRequestException('Early leave can only be applied for today or future dates.');
      }
      const [startH, startM] = dto.early_leave_start_time.split(':').map(Number);
      const [endH, endM] = dto.early_leave_end_time.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (endMinutes <= startMinutes) {
        throw new BadRequestException('Early leave end time must be after start time.');
      }
      earlyLeaveHours = Number(((endMinutes - startMinutes) / 60).toFixed(2));
      if (earlyLeaveHours <= 0) {
        throw new BadRequestException('Early leave duration must be greater than 0.');
      }
      if (earlyLeaveHours > 2) {
        throw new BadRequestException('Early leave is allowed for a maximum of 2 hours only.');
      }

      // 1e. Early Leave: max 1 per month
      // Use the raw date string to avoid timezone issues
      const earlyDateStr = dto.early_leave_date; // "YYYY-MM-DD"
      const [eyear, emonth] = earlyDateStr.split('-').map(Number);
      const monthStartStr = `${eyear}-${String(emonth).padStart(2, '0')}-01`;
      const nextMonth = emonth === 12 ? 1 : emonth + 1;
      const nextYear = emonth === 12 ? eyear + 1 : eyear;
      const monthEndStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const existingEarlyCount = await this.requestRepo
        .createQueryBuilder('lr')
        .where('lr.user_id = :userId', { userId })
        .andWhere('lr.leave_type_id = :typeId', { typeId: leaveType.id })
        .andWhere('lr.status IN (:...statuses)', {
          statuses: ['PENDING_L1', 'PENDING_L2', 'APPROVED'],
        })
        .andWhere('lr.early_leave_date >= :monthStart', { monthStart: monthStartStr })
        .andWhere('lr.early_leave_date < :monthEnd', { monthEnd: monthEndStr })
        .getCount();

      if (existingEarlyCount > 0) {
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const monthName = `${monthNames[emonth - 1]} ${eyear}`;
        throw new UnprocessableEntityException({
          code: 'EARLY_LEAVE_LIMIT',
          message: `Only 1 short/early leave is allowed per month. You already have one for ${monthName}.`,
        });
      }
    }

    // 2. Working days calculation
    const year = startDate.getFullYear();
    const holidays = await this.getHolidayDates(year);
    const dayValue = Number(duration.day_value);

    let baseWorkingDays: number;
    if (isEarlyLeave) {
      // Early leave always counts as 1 day from balance (max 2 hours allowed)
      baseWorkingDays = 1;
    } else {
      baseWorkingDays = this.calcWorkingDays(
        startDate,
        endDate,
        dayValue,
        holidays,
      );
    }

    if (baseWorkingDays <= 0) {
      throw new UnprocessableEntityException({
        code: 'NO_WORKING_DAYS',
        message: isEarlyLeave
          ? 'Early leave duration must be greater than 0.'
          : 'No working days in the selected range.',
      });
    }

    // 2b. PL: Max days per request check
    if (leaveType.max_days_per_request && !isEarlyLeave) {
      if (baseWorkingDays > leaveType.max_days_per_request) {
        throw new UnprocessableEntityException({
          code: 'MAX_DAYS_EXCEEDED',
          message: `${leaveType.label} allows maximum ${leaveType.max_days_per_request} days per request. You requested ${baseWorkingDays} days.`,
        });
      }
    }

    // 3. Sandwich detection — only applies to full-day leaves
    const isFullDay = dayValue >= 1;

    // 3a) Within-request sandwich
    const withinResult = isFullDay
      ? this.detectSandwich(startDate, endDate, holidays)
      : { detected: false, detail: null, sandwichDays: 0 };

    // 3b) Cross-request sandwich (existing approved/pending leaves nearby)
    const crossResult = isFullDay
      ? await this.detectCrossRequestSandwich(userId, startDate, endDate, holidays)
      : { detected: false, detail: null, sandwichDays: 0 };

    const sandwichDetected = withinResult.detected || crossResult.detected;
    const sandwichDays = withinResult.sandwichDays + crossResult.sandwichDays;
    const allDetails: string[] = [];
    if (withinResult.detail) allDetails.push(withinResult.detail);
    if (crossResult.detail) allDetails.push(crossResult.detail);
    const sandwichDetail = allDetails.length > 0 ? allDetails.join(' ') : null;

    if (sandwichDetected && !dto.sandwich_confirmed) {
      throw new UnprocessableEntityException({
        code: 'SANDWICH_CONFIRMATION_REQUIRED',
        message:
          sandwichDetail ||
          'Sandwich leave detected: non-working days between your leave dates will be counted as leave. Please confirm before submitting.',
      });
    }

    // Total days to deduct: working days + sandwiched non-working days (full days only)
    const workingDays = sandwichDetected
      ? baseWorkingDays + sandwichDays
      : baseWorkingDays;

    // 4. Document requirement check
    const today4doc = new Date();
    today4doc.setHours(0, 0, 0, 0);
    const isFutureLeave = startDate > today4doc;

    // SL special rule: if applied for a future date, doc is mandatory
    const docRequiredForFuture =
      leaveType.requires_doc_for_future && isFutureLeave;

    const docRequiredByThreshold =
      leaveType.doc_required &&
      (leaveType.doc_threshold_days === null ||
        workingDays >= leaveType.doc_threshold_days);

    const docRequired = docRequiredByThreshold || docRequiredForFuture;

    if (docRequired && !dto.doc_s3_key) {
      const reason = docRequiredForFuture
        ? `${leaveType.label} applied for a future date requires a supporting document.`
        : `A supporting document is required for ${leaveType.label} of ${leaveType.doc_threshold_days ?? 1}+ days.`;
      throw new UnprocessableEntityException({
        code: 'DOCUMENT_REQUIRED',
        message: reason,
      });
    }

    // 5. Date conflict check
    await this.checkDateConflict(userId, dto.start_date, dto.end_date);

    // 6. Balance check & update (with row-level locking)
    const initialStatus = user.manager_id ? 'PENDING_L1' : 'PENDING_L2';

    const leaveRequest = await this.dataSource.transaction(async (manager) => {
      // Lock the balance row
      const balance = await manager
        .createQueryBuilder(LeaveBalance, 'lb')
        .setLock('pessimistic_write')
        .where('lb.user_id = :userId', { userId })
        .andWhere('lb.leave_type_id = :leaveTypeId', {
          leaveTypeId: dto.leave_type_id,
        })
        .andWhere('lb.year = :year', { year })
        .getOne();

      if (!balance) {
        throw new UnprocessableEntityException({
          code: 'INSUFFICIENT_BALANCE',
          message: 'No leave balance found for this leave type and year.',
        });
      }

      const available =
        Number(balance.total_days) -
        Number(balance.used_days) -
        Number(balance.pending_days);

      if (workingDays > available) {
        throw new UnprocessableEntityException({
          code: 'INSUFFICIENT_BALANCE',
          message: `Insufficient leave balance. You have ${available} days available.`,
        });
      }

      // Update pending days
      balance.pending_days = Number(balance.pending_days) + workingDays;
      await manager.save(LeaveBalance, balance);

      // Create leave request
      const request = manager.create(LeaveRequest, {
        user_id: userId,
        leave_type_id: dto.leave_type_id,
        duration_type_id: dto.duration_type_id,
        start_date: dto.start_date,
        end_date: dto.end_date,
        working_days: workingDays,
        reason: dto.reason,
        doc_s3_key: dto.doc_s3_key || null,
        status: initialStatus,
        sandwich_flag: sandwichDetected,
        submitted_by: submittedBy || null,
        admin_notes: adminNotes || null,
        // Early leave time fields
        early_leave_date: isEarlyLeave ? dto.early_leave_date : null,
        early_leave_start_time: isEarlyLeave ? dto.early_leave_start_time : null,
        early_leave_end_time: isEarlyLeave ? dto.early_leave_end_time : null,
        early_leave_hours: isEarlyLeave ? earlyLeaveHours : null,
      });
      const saved = await manager.save(LeaveRequest, request);

      // Create approval record
      const approverLevel = user.manager_id ? 1 : 2;
      const approverId = user.manager_id || (await this.getFirstHrAdminId());

      if (approverId) {
        const deadlines = await this.slaService.calcSlaDeadline(new Date());
        const approval = manager.create(LeaveApproval, {
          leave_request_id: saved.id,
          level: approverLevel,
          approver_id: approverId,
          sla_deadline: deadlines.slaDeadline,
          reminder_deadline: deadlines.reminderDeadline,
        });
        await manager.save(LeaveApproval, approval);
      }

      return saved;
    });

    // Send notifications (outside transaction)
    const approverUser = user.manager_id
      ? await this.userRepo.findOne({ where: { id: user.manager_id } })
      : await this.getFirstHrAdmin();

    const tokens = {
      employee_name: user.name,
      leave_type: leaveType.label,
      dates: `${dto.start_date} to ${dto.end_date}`,
      start_date: dto.start_date,
      end_date: dto.end_date,
      working_days: String(workingDays),
    };

    // Notify approver (manager)
    if (approverUser) {
      await this.notificationsService.dispatch(
        'leave.submitted.manager',
        [{ userId: approverUser.id, email: approverUser.gmail }],
        { ...tokens, manager_name: approverUser.name },
      );
    }

    // Confirm to employee
    await this.notificationsService.dispatch(
      'leave.submitted.employee',
      [{ userId: user.id, email: user.gmail }],
      tokens,
    );

    return this.getRequestById(leaveRequest.id, userId);
  }

  // ─── Get user's leave requests (paginated) ───

  async getUserRequests(
    userId: string,
    query: QueryLeaveRequestsDto,
  ): Promise<PaginatedResult<LeaveRequest>> {
    const qb = this.requestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.leaveType', 'lt')
      .leftJoinAndSelect('lr.durationType', 'dt')
      .leftJoinAndSelect('lr.approvals', 'la')
      .leftJoinAndSelect('la.approver', 'approver')
      .where('lr.user_id = :userId', { userId });

    if (query.status) {
      qb.andWhere('lr.status = :status', { status: query.status });
    }
    if (query.year) {
      qb.andWhere('EXTRACT(YEAR FROM lr.start_date) = :year', {
        year: query.year,
      });
    }

    qb.orderBy('lr.created_at', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get single leave request with approval history ───

  async getRequestById(
    requestId: string,
    userId?: string,
  ): Promise<LeaveRequest & { can_cancel: boolean }> {
    const qb = this.requestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.leaveType', 'lt')
      .leftJoinAndSelect('lr.durationType', 'dt')
      .leftJoinAndSelect('lr.user', 'emp')
      .leftJoinAndSelect('lr.approvals', 'la')
      .leftJoinAndSelect('la.approver', 'approver')
      .leftJoinAndSelect('lr.submittedByUser', 'submitter')
      .where('lr.id = :requestId', { requestId });

    if (userId) {
      qb.andWhere('lr.user_id = :userId', { userId });
    }

    const request = await qb.getOne();
    if (!request) throw new NotFoundException('Leave request not found');

    const today = new Date().toISOString().split('T')[0];
    const canCancel =
      request.start_date > today &&
      !['CANCELLED', 'DECLINED'].includes(request.status);

    return Object.assign(request, { can_cancel: canCancel });
  }

  // ─── Cancel leave request ───

  async cancelRequest(requestId: string, userId: string): Promise<any> {
    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(LeaveRequest, {
        where: { id: requestId, user_id: userId },
        relations: ['leaveType'],
      });

      if (!request) {
        throw new NotFoundException('Leave request not found');
      }

      if (request.status === 'CANCELLED') {
        throw new UnprocessableEntityException({
          code: 'LEAVE_ALREADY_CANCELLED',
          message: 'This leave request is already cancelled.',
        });
      }

      if (request.status === 'DECLINED') {
        throw new UnprocessableEntityException({
          code: 'LEAVE_ALREADY_DECLINED',
          message: 'This leave request has been declined.',
        });
      }

      const today = new Date().toISOString().split('T')[0];
      if (request.start_date <= today) {
        throw new UnprocessableEntityException({
          code: 'LEAVE_ALREADY_STARTED',
          message: 'Cannot cancel a leave that has already started.',
        });
      }

      const previousStatus = request.status;
      const workingDays = Number(request.working_days);
      const year = new Date(request.start_date).getFullYear();

      // Lock and update balance
      const balance = await manager
        .createQueryBuilder(LeaveBalance, 'lb')
        .setLock('pessimistic_write')
        .where('lb.user_id = :userId', { userId })
        .andWhere('lb.leave_type_id = :leaveTypeId', {
          leaveTypeId: request.leave_type_id,
        })
        .andWhere('lb.year = :year', { year })
        .getOne();

      if (balance) {
        if (previousStatus === 'APPROVED') {
          balance.used_days = Math.max(
            0,
            Number(balance.used_days) - workingDays,
          );
        } else {
          // PENDING_L1, PENDING_L2, ESCALATED
          balance.pending_days = Math.max(
            0,
            Number(balance.pending_days) - workingDays,
          );
        }
        await manager.save(LeaveBalance, balance);
      }

      // Update request
      request.status = 'CANCELLED';
      request.cancelled_at = new Date();
      request.cancelled_by = userId;
      request.cancelled_by_usertype = 'user';
      await manager.save(LeaveRequest, request);

      return {
        id: request.id,
        status: 'CANCELLED',
        cancelled_at: request.cancelled_at,
        balance_restored: {
          leave_type: request.leaveType?.label,
          days_returned: workingDays,
        },
      };
    });
  }

  // ─── Get leave balances ───

  async getBalances(userId: string, year?: number): Promise<any[]> {
    const targetYear = year ?? new Date().getFullYear();

    const balances = await this.balanceRepo.find({
      where: { user_id: userId, year: targetYear },
      relations: ['leaveType'],
    });

    return balances.map((b) => ({
      leave_type: {
        id: b.leaveType.id,
        label: b.leaveType.label,
        color: b.leaveType.color,
      },
      year: b.year,
      total_days: Number(b.total_days),
      used_days: Number(b.used_days),
      pending_days: Number(b.pending_days),
      available_days:
        Number(b.total_days) - Number(b.used_days) - Number(b.pending_days),
    }));
  }

  // ─── Manager L1 Approval ───

  async getPendingManagerApprovals(
    managerId: string,
  ): Promise<LeaveApproval[]> {
    return this.approvalRepo
      .createQueryBuilder('la')
      .innerJoinAndSelect('la.leaveRequest', 'lr')
      .innerJoinAndSelect('lr.user', 'emp')
      .innerJoinAndSelect('lr.leaveType', 'lt')
      .innerJoinAndSelect('lr.durationType', 'dt')
      .where('la.approver_id = :managerId', { managerId })
      .andWhere('la.level = :level', { level: 1 })
      .andWhere('la.action IS NULL')
      .andWhere('la.escalated = false')
      .orderBy('la.created_at', 'ASC')
      .getMany();
  }

  async approveL1(approvalId: string, managerId: string): Promise<void> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, approver_id: managerId, level: 1 },
      relations: ['leaveRequest', 'leaveRequest.user', 'leaveRequest.leaveType'],
    });

    if (!approval || approval.action !== null) {
      throw new NotFoundException('Pending approval not found');
    }

    await this.dataSource.transaction(async (manager) => {
      // Update approval
      approval.action = 'approved';
      approval.actioned_at = new Date();
      await manager.save(LeaveApproval, approval);

      // Update request status
      const request = approval.leaveRequest;
      request.status = 'PENDING_L2';
      await manager.save(LeaveRequest, request);

      // Create L2 approval for HR
      const hrAdmin = await this.getFirstHrAdmin();
      if (hrAdmin) {
        const deadlines = await this.slaService.calcSlaDeadline(new Date());
        const l2Approval = manager.create(LeaveApproval, {
          leave_request_id: request.id,
          level: 2,
          approver_id: hrAdmin.id,
          sla_deadline: deadlines.slaDeadline,
          reminder_deadline: deadlines.reminderDeadline,
        });
        await manager.save(LeaveApproval, l2Approval);
      }
    });

    // Notifications
    const request = approval.leaveRequest;
    const employee = request.user;
    const leaveType = request.leaveType;
    const tokens = {
      employee_name: employee.name,
      leave_type: leaveType.label,
      dates: `${request.start_date} to ${request.end_date}`,
      start_date: request.start_date,
      end_date: request.end_date,
      working_days: String(request.working_days),
    };

    await this.notificationsService.dispatch(
      'leave.approved.l1.employee',
      [{ userId: employee.id, email: employee.gmail }],
      tokens,
    );

    // Notify HR for Level 2 approval
    const hrAdmin = await this.getFirstHrAdmin();
    if (hrAdmin) {
      await this.notificationsService.dispatch(
        'leave.approved.l1.hr',
        [{ userId: hrAdmin.id, email: hrAdmin.gmail }],
        tokens,
      );
    }
  }

  async declineL1(
    approvalId: string,
    managerId: string,
    reason: string,
  ): Promise<void> {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Decline reason is required');
    }

    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, approver_id: managerId, level: 1 },
      relations: ['leaveRequest', 'leaveRequest.user', 'leaveRequest.leaveType'],
    });

    if (!approval || approval.action !== null) {
      throw new NotFoundException('Pending approval not found');
    }

    await this.dataSource.transaction(async (manager) => {
      approval.action = 'declined';
      approval.reason = reason;
      approval.actioned_at = new Date();
      await manager.save(LeaveApproval, approval);

      const request = approval.leaveRequest;
      request.status = 'DECLINED';
      await manager.save(LeaveRequest, request);

      // Restore balance
      const year = new Date(request.start_date).getFullYear();
      const balance = await manager
        .createQueryBuilder(LeaveBalance, 'lb')
        .setLock('pessimistic_write')
        .where('lb.user_id = :userId', { userId: request.user_id })
        .andWhere('lb.leave_type_id = :leaveTypeId', {
          leaveTypeId: request.leave_type_id,
        })
        .andWhere('lb.year = :year', { year })
        .getOne();

      if (balance) {
        balance.pending_days = Math.max(
          0,
          Number(balance.pending_days) - Number(request.working_days),
        );
        await manager.save(LeaveBalance, balance);
      }
    });

    const request = approval.leaveRequest;
    const employee = request.user;
    await this.notificationsService.dispatch(
      'leave.declined',
      [{ userId: employee.id, email: employee.gmail }],
      {
        employee_name: employee.name,
        leave_type: request.leaveType.label,
        dates: `${request.start_date} to ${request.end_date}`,
        reason,
      },
    );
  }

  // ─── HR L2 Approval ───

  async getPendingHrApprovals(): Promise<LeaveApproval[]> {
    // Admin sees ALL pending approvals — both L1 (manager pending) and L2 (HR pending)
    return this.approvalRepo
      .createQueryBuilder('la')
      .innerJoinAndSelect('la.leaveRequest', 'lr')
      .innerJoinAndSelect('lr.user', 'emp')
      .innerJoinAndSelect('lr.leaveType', 'lt')
      .innerJoinAndSelect('lr.durationType', 'dt')
      .where('la.action IS NULL')
      .orderBy('la.level', 'ASC')
      .addOrderBy('la.created_at', 'ASC')
      .getMany();
  }

  async approveL2(approvalId: string, adminUserId: string): Promise<void> {
    // Admin can approve both L1 and L2 approvals directly
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId },
      relations: ['leaveRequest', 'leaveRequest.user', 'leaveRequest.leaveType'],
    });

    if (!approval || approval.action !== null) {
      throw new NotFoundException('Pending approval not found');
    }

    const isL1 = approval.level === 1;

    await this.dataSource.transaction(async (manager) => {
      // Mark current approval as approved by admin
      approval.action = 'approved';
      approval.approver_id = adminUserId;
      approval.actioned_at = new Date();
      await manager.save(LeaveApproval, approval);

      if (isL1) {
        // Admin is directly approving an L1 (manager) approval — skip L2, go straight to APPROVED
        // No need to create an L2 approval record
        const request = approval.leaveRequest;
        request.status = 'APPROVED';
        await manager.save(LeaveRequest, request);

        // Move from pending to used
        const year = new Date(request.start_date).getFullYear();
        const balance = await manager
          .createQueryBuilder(LeaveBalance, 'lb')
          .setLock('pessimistic_write')
          .where('lb.user_id = :userId', { userId: request.user_id })
          .andWhere('lb.leave_type_id = :leaveTypeId', {
            leaveTypeId: request.leave_type_id,
          })
          .andWhere('lb.year = :year', { year })
          .getOne();

        if (balance) {
          const workingDays = Number(request.working_days);
          balance.used_days = Number(balance.used_days) + workingDays;
          balance.pending_days = Math.max(
            0,
            Number(balance.pending_days) - workingDays,
          );
          await manager.save(LeaveBalance, balance);
        }
      } else {
        // Normal L2 approval
        const request = approval.leaveRequest;
        request.status = 'APPROVED';
        await manager.save(LeaveRequest, request);

        // Move from pending to used
        const year = new Date(request.start_date).getFullYear();
        const balance = await manager
          .createQueryBuilder(LeaveBalance, 'lb')
          .setLock('pessimistic_write')
          .where('lb.user_id = :userId', { userId: request.user_id })
          .andWhere('lb.leave_type_id = :leaveTypeId', {
            leaveTypeId: request.leave_type_id,
          })
          .andWhere('lb.year = :year', { year })
          .getOne();

        if (balance) {
          const workingDays = Number(request.working_days);
          balance.used_days = Number(balance.used_days) + workingDays;
          balance.pending_days = Math.max(
            0,
            Number(balance.pending_days) - workingDays,
          );
          await manager.save(LeaveBalance, balance);
        }
      }
    });

    // Notification to employee
    const request = approval.leaveRequest;
    const employee = request.user;
    await this.notificationsService.dispatch(
      'leave.approved.l2',
      [{ userId: employee.id, email: employee.gmail }],
      {
        employee_name: employee.name,
        leave_type: request.leaveType.label,
        dates: `${request.start_date} to ${request.end_date}`,
        start_date: request.start_date,
        end_date: request.end_date,
        working_days: String(request.working_days),
      },
    );

    // Google Calendar sync — create events on employee's and manager's calendars
    try {
      const calendarParams = {
        leaveRequestId: request.id,
        employeeName: employee.name,
        employeeEmail: employee.gmail,
        leaveTypeLabel: request.leaveType.label,
        startDate: String(request.start_date),
        endDate: String(request.end_date),
        workingDays: Number(request.working_days),
      };

      // Get employee's Google tokens
      const empUser = await this.userRepo.findOne({ where: { id: employee.id } });
      const employeeTokens = empUser?.google_access_token
        ? { access_token: empUser.google_access_token, refresh_token: empUser.google_refresh_token }
        : null;

      // Get manager's Google tokens (from L1 approval)
      let managerTokens: { access_token: string; refresh_token: string | null } | null = null;
      const l1Approval = await this.approvalRepo.findOne({
        where: { leave_request_id: request.id, level: 1 },
      });
      if (l1Approval?.approver_id) {
        const managerUser = await this.userRepo.findOne({ where: { id: l1Approval.approver_id } });
        if (managerUser?.google_access_token) {
          managerTokens = {
            access_token: managerUser.google_access_token,
            refresh_token: managerUser.google_refresh_token,
          };
        }
      }

      await this.calendarService.createEventsForLeave(
        calendarParams,
        employeeTokens,
        managerTokens,
      );
    } catch (calError) {
      // Calendar sync is non-blocking — log and continue
      this.logger.error(
        'Calendar sync failed for leave request ' + request.id,
        calError instanceof Error ? calError.message : calError,
      );
    }
  }

  async declineL2(
    approvalId: string,
    adminUserId: string,
    reason: string,
  ): Promise<void> {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Decline reason is required');
    }

    // Admin can decline both L1 and L2 approvals
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId },
      relations: ['leaveRequest', 'leaveRequest.user', 'leaveRequest.leaveType'],
    });

    if (!approval || approval.action !== null) {
      throw new NotFoundException('Pending approval not found');
    }

    await this.dataSource.transaction(async (manager) => {
      approval.action = 'declined';
      approval.reason = reason;
      approval.actioned_at = new Date();
      await manager.save(LeaveApproval, approval);

      const request = approval.leaveRequest;
      request.status = 'DECLINED';
      await manager.save(LeaveRequest, request);

      // Restore balance
      const year = new Date(request.start_date).getFullYear();
      const balance = await manager
        .createQueryBuilder(LeaveBalance, 'lb')
        .setLock('pessimistic_write')
        .where('lb.user_id = :userId', { userId: request.user_id })
        .andWhere('lb.leave_type_id = :leaveTypeId', {
          leaveTypeId: request.leave_type_id,
        })
        .andWhere('lb.year = :year', { year })
        .getOne();

      if (balance) {
        balance.pending_days = Math.max(
          0,
          Number(balance.pending_days) - Number(request.working_days),
        );
        await manager.save(LeaveBalance, balance);
      }
    });

    const request = approval.leaveRequest;
    const employee = request.user;
    await this.notificationsService.dispatch(
      'leave.declined',
      [{ userId: employee.id, email: employee.gmail }],
      {
        employee_name: employee.name,
        leave_type: request.leaveType.label,
        dates: `${request.start_date} to ${request.end_date}`,
        reason,
      },
    );
  }

  // ─── Admin: all leave requests (filterable) ───

  async getAllRequests(
    query: AdminQueryLeaveRequestsDto,
  ): Promise<PaginatedResult<LeaveRequest>> {
    const qb = this.requestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.leaveType', 'lt')
      .leftJoinAndSelect('lr.durationType', 'dt')
      .leftJoinAndSelect('lr.user', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .leftJoinAndSelect('lr.approvals', 'la')
      .leftJoinAndSelect('la.approver', 'approver');

    if (query.user_id) {
      qb.andWhere('lr.user_id = :userId', { userId: query.user_id });
    }
    if (query.status) {
      qb.andWhere('lr.status = :status', { status: query.status });
    }
    if (query.leave_type_id) {
      qb.andWhere('lr.leave_type_id = :ltId', { ltId: query.leave_type_id });
    }
    if (query.year) {
      qb.andWhere('EXTRACT(YEAR FROM lr.start_date) = :year', {
        year: query.year,
      });
    }
    if (query.department_id) {
      qb.andWhere('emp.department_id = :deptId', {
        deptId: query.department_id,
      });
    }

    qb.orderBy('lr.created_at', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Helper: Working days calculation ───

  private calcWorkingDays(
    start: Date,
    end: Date,
    dayValue: number,
    holidays: Set<string>,
  ): number {
    let count = 0;
    const cursor = new Date(start);

    while (cursor <= end) {
      const dow = cursor.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const dateStr = cursor.toISOString().split('T')[0];
      const isHoliday = holidays.has(dateStr);

      if (!isWeekend && !isHoliday) {
        count += dayValue;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
  }

  /**
   * Sandwich leave policy: when leave bridges a non-working gap (weekend/holiday),
   * those gap days are also counted as leave days.
   *
   * Example: Leave on Fri + Mon → Sat & Sun also count = 4 days total.
   * Example: Leave on Mon + Wed with Tue = holiday → Tue also counts = 3 days.
   */
  private calcWorkingDaysWithSandwich(
    start: Date,
    end: Date,
    dayValue: number,
    holidays: Set<string>,
  ): { totalDays: number; sandwichDays: number } {
    // Sandwich leave only applies to full-day leaves
    const isFullDay = dayValue >= 1;

    // Build a list of all days in the range
    const days: { date: Date; dateStr: string; isWorking: boolean }[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const dow = cursor.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const dateStr = cursor.toISOString().split('T')[0];
      const isHoliday = holidays.has(dateStr);
      days.push({
        date: new Date(cursor),
        dateStr,
        isWorking: !isWeekend && !isHoliday,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Find sandwich gaps: non-working days between two working days (full day only)
    let workingDays = 0;
    let sandwichDays = 0;

    for (let i = 0; i < days.length; i++) {
      if (days[i].isWorking) {
        workingDays += dayValue;
      } else if (isFullDay) {
        // Sandwich only checked for full-day leaves
        const hasBefore = days.slice(0, i).some((d) => d.isWorking);
        const hasAfter = days.slice(i + 1).some((d) => d.isWorking);

        if (hasBefore && hasAfter) {
          // This non-working day is sandwiched — count as 1 full leave day
          sandwichDays += 1;
        }
      }
    }

    return {
      totalDays: workingDays + sandwichDays,
      sandwichDays,
    };
  }

  // ─── Helper: Sandwich leave detection (within a single request) ───

  private detectSandwich(
    start: Date,
    end: Date,
    holidays: Set<string>,
  ): { detected: boolean; detail: string | null; sandwichDays: number } {
    // Build list of all days in the leave range
    const days: { dateStr: string; isWorking: boolean }[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const dow = cursor.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const dateStr = cursor.toISOString().split('T')[0];
      const isHoliday = holidays.has(dateStr);
      days.push({ dateStr, isWorking: !isWeekend && !isHoliday });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Find non-working days sandwiched between working days
    let sandwichDays = 0;
    const gapDates: string[] = [];

    for (let i = 0; i < days.length; i++) {
      if (!days[i].isWorking) {
        const hasBefore = days.slice(0, i).some((d) => d.isWorking);
        const hasAfter = days.slice(i + 1).some((d) => d.isWorking);
        if (hasBefore && hasAfter) {
          sandwichDays++;
          gapDates.push(days[i].dateStr);
        }
      }
    }

    if (sandwichDays > 0) {
      return {
        detected: true,
        detail:
          `Sandwich leave detected: ${sandwichDays} non-working day(s) (${gapDates.join(', ')}) fall between your working leave days and will be counted as leave.`,
        sandwichDays,
      };
    }

    return { detected: false, detail: null, sandwichDays: 0 };
  }

  /**
   * Cross-request sandwich detection.
   *
   * Checks if the new leave request, combined with existing approved/pending
   * full-day leaves, creates a sandwich across non-working days.
   *
   * Example: Employee has approved Friday leave. Now applies for Monday leave.
   * Saturday & Sunday are sandwiched between Friday and Monday → counted as leave.
   *
   * We look up to 7 days before the start and 7 days after the end to find
   * adjacent existing leaves that could create a sandwich.
   */
  private async detectCrossRequestSandwich(
    userId: string,
    start: Date,
    end: Date,
    holidays: Set<string>,
  ): Promise<{ detected: boolean; detail: string | null; sandwichDays: number }> {
    // Look 7 days before and after for adjacent leaves
    const lookBackDate = new Date(start);
    lookBackDate.setDate(lookBackDate.getDate() - 7);
    const lookAheadDate = new Date(end);
    lookAheadDate.setDate(lookAheadDate.getDate() + 7);

    const lookBackStr = lookBackDate.toISOString().split('T')[0];
    const lookAheadStr = lookAheadDate.toISOString().split('T')[0];

    // Find existing approved/pending full-day leave requests in the vicinity
    const existingLeaves = await this.requestRepo
      .createQueryBuilder('lr')
      .innerJoin('lr.durationType', 'dt')
      .where('lr.user_id = :userId', { userId })
      .andWhere('lr.status IN (:...statuses)', {
        statuses: ['PENDING_L1', 'PENDING_L2', 'APPROVED'],
      })
      .andWhere('dt.day_value = :fullDay', { fullDay: 1 })
      .andWhere('lr.start_date <= :lookAhead', { lookAhead: lookAheadStr })
      .andWhere('lr.end_date >= :lookBack', { lookBack: lookBackStr })
      .getMany();

    if (existingLeaves.length === 0) {
      return { detected: false, detail: null, sandwichDays: 0 };
    }

    // Build a set of all dates covered by existing leaves
    const existingLeaveDates = new Set<string>();
    for (const leave of existingLeaves) {
      const lStart = new Date(leave.start_date);
      const lEnd = new Date(leave.end_date);
      const cursor = new Date(lStart);
      while (cursor <= lEnd) {
        const dateStr = cursor.toISOString().split('T')[0];
        existingLeaveDates.add(dateStr);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Add the new request's dates
    const newLeaveDates = new Set<string>();
    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = cursor.toISOString().split('T')[0];
      newLeaveDates.add(dateStr);
      cursor.setDate(cursor.getDate() + 1);
    }

    // Combine all leave dates (existing + new)
    const allLeaveDates = new Set([...existingLeaveDates, ...newLeaveDates]);

    // Now check for gaps of non-working days between the new request and existing leaves
    // Check backward: are there non-working days between an existing leave before and the new request?
    const sandwichGapDates: string[] = [];

    // Check gap BEFORE the new request
    const dayBefore = new Date(start);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const backwardGap = this.findNonWorkingGap(dayBefore, existingLeaveDates, holidays, 'backward');
    sandwichGapDates.push(...backwardGap);

    // Check gap AFTER the new request
    const dayAfter = new Date(end);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const forwardGap = this.findNonWorkingGap(dayAfter, existingLeaveDates, holidays, 'forward');
    sandwichGapDates.push(...forwardGap);

    const sandwichDays = sandwichGapDates.length;

    if (sandwichDays > 0) {
      return {
        detected: true,
        detail: `Cross-request sandwich leave detected: ${sandwichDays} non-working day(s) (${sandwichGapDates.join(', ')}) fall between this request and your existing approved/pending leave, and will be counted as leave.`,
        sandwichDays,
      };
    }

    return { detected: false, detail: null, sandwichDays: 0 };
  }

  /**
   * Walk from a starting date in the given direction looking for a continuous
   * run of non-working days that ends at an existing leave date.
   *
   * Example (backward from new Monday leave):
   *   Sun (non-working) → Sat (non-working) → Fri (check if existing leave)
   *   If Fri is in existingLeaveDates → Sat,Sun are sandwich gap days.
   *
   * Returns the list of gap date strings that are sandwiched.
   */
  private findNonWorkingGap(
    startFrom: Date,
    existingLeaveDates: Set<string>,
    holidays: Set<string>,
    direction: 'backward' | 'forward',
  ): string[] {
    const gapDates: string[] = [];
    const cursor = new Date(startFrom);
    const step = direction === 'backward' ? -1 : 1;
    const maxLook = 7; // Max 7 days gap (covers a week + holidays)

    for (let i = 0; i < maxLook; i++) {
      const dateStr = cursor.toISOString().split('T')[0];
      const dow = cursor.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidays.has(dateStr);
      const isNonWorking = isWeekend || isHoliday;

      if (existingLeaveDates.has(dateStr)) {
        // We hit an existing leave — all non-working days we passed are sandwiched
        return gapDates;
      }

      if (!isNonWorking) {
        // Hit a regular working day with no leave — no sandwich
        return [];
      }

      // Non-working day in the gap — potential sandwich
      gapDates.push(dateStr);
      cursor.setDate(cursor.getDate() + step);
    }

    // Exceeded max look without hitting a leave day — no sandwich
    return [];
  }

  // ─── Helper: Probation check ───

  private async isInProbation(user: User): Promise<boolean> {
    if (!user.join_date) return false;

    if (user.confirmation_date) {
      const today = new Date().toISOString().split('T')[0];
      return today < user.confirmation_date;
    }

    // Fall back to SLA config probation duration
    const config = await this.slaConfigRepo.findOne({
      where: { config_key: 'probation.duration_months' },
    });
    const months = config ? parseInt(config.config_value, 10) : 3;

    const joinDate = new Date(user.join_date);
    const probationEnd = new Date(joinDate);
    probationEnd.setMonth(probationEnd.getMonth() + months);

    return new Date() < probationEnd;
  }

  // ─── Helper: Date conflict check ───

  private async checkDateConflict(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const conflict = await this.requestRepo
      .createQueryBuilder('lr')
      .where('lr.user_id = :userId', { userId })
      .andWhere('lr.status IN (:...statuses)', {
        statuses: ['PENDING_L1', 'PENDING_L2', 'APPROVED'],
      })
      .andWhere('lr.start_date <= :endDate', { endDate })
      .andWhere('lr.end_date >= :startDate', { startDate })
      .getOne();

    if (conflict) {
      throw new UnprocessableEntityException({
        code: 'DATE_CONFLICT',
        message:
          'You already have a leave request for overlapping dates.',
      });
    }
  }

  // ─── Helper: Get holiday dates as Set ───

  private async getHolidayDates(year: number): Promise<Set<string>> {
    const holidays = await this.holidayRepo.find({
      where: { year, is_active: true },
    });
    return new Set(holidays.map((h) => h.date));
  }

  // ─── Helper: Get first HR admin ───

  private async getFirstHrAdmin(): Promise<User | null> {
    const hrAdmin = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('admin_users', 'au', 'au.user_id = u.id')
      .innerJoin('master_admin_roles', 'mar', 'mar.id = au.role_id')
      .where('u.is_active = true')
      .andWhere("mar.name IN (:...roles)", {
        roles: ['HR Admin', 'Super Admin'],
      })
      .getOne();
    return hrAdmin || null;
  }

  private async getFirstHrAdminId(): Promise<string | null> {
    const admin = await this.getFirstHrAdmin();
    return admin?.id || null;
  }

  /**
   * Admin-triggered year-end balance reset.
   * Creates fresh leave balances for the target year with pro-rata accrual logic:
   *
   * CL/SL (monthly accrual): Based on confirmation date
   * PL: Full if tenure >= 12 months, else 0
   * LWP/Early: Full allocation
   */
  async adminResetBalances(targetYear: number): Promise<{
    year: number;
    employeesProcessed: number;
    balancesCreated: number;
  }> {
    const activeUsers = await this.userRepo.find({
      where: { is_active: true },
    });
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { is_active: true },
    });

    let balancesCreated = 0;

    for (const user of activeUsers) {
      // Skip users without join date
      if (!user.join_date) continue;

      const joinDate = new Date(user.join_date);
      const confirmationDate = user.confirmation_date
        ? new Date(user.confirmation_date)
        : null;

      for (const lt of leaveTypes) {
        // Check if balance already exists
        const existing = await this.balanceRepo.findOne({
          where: {
            user_id: user.id,
            leave_type_id: lt.id,
            year: targetYear,
          },
        });
        if (existing) continue; // Don't overwrite existing balances

        let totalDays: number;

        if (lt.accrual_type === 'monthly' && lt.accrual_rate_per_month) {
          // CL/SL: pro-rata from confirmation date
          if (!confirmationDate) {
            totalDays = 0; // No confirmation = still in probation
          } else {
            totalDays = this.calculateMonthlyAccrual(
              confirmationDate,
              Number(lt.accrual_rate_per_month),
              targetYear,
            );
          }
        } else if (lt.min_tenure_months > 0) {
          // PL: check tenure
          const targetStart = new Date(targetYear, 0, 1); // Jan 1 of target year
          const monthsWorked =
            (targetStart.getFullYear() - joinDate.getFullYear()) * 12 +
            (targetStart.getMonth() - joinDate.getMonth());
          totalDays = monthsWorked >= lt.min_tenure_months ? lt.annual_days : 0;
        } else {
          // LWP, Early Leave, etc.
          totalDays = lt.annual_days;
        }

        const balance = this.balanceRepo.create({
          user_id: user.id,
          leave_type_id: lt.id,
          year: targetYear,
          total_days: totalDays,
          used_days: 0,
          pending_days: 0,
        });
        await this.balanceRepo.save(balance);
        balancesCreated++;
      }
    }

    return {
      year: targetYear,
      employeesProcessed: activeUsers.length,
      balancesCreated,
    };
  }

  /**
   * Calculate monthly accrual for CL/SL.
   * If confirmed before 15th of month → that month counts
   * If confirmed on/after 15th → starts next month
   * Result floored to nearest 0.5
   */
  private calculateMonthlyAccrual(
    confirmationDate: Date,
    ratePerMonth: number,
    targetYear: number,
  ): number {
    const confYear = confirmationDate.getFullYear();
    const confMonth = confirmationDate.getMonth();
    const confDay = confirmationDate.getDate();

    if (confYear < targetYear) {
      return Math.floor(12 * ratePerMonth * 2) / 2;
    }
    if (confYear > targetYear) {
      return 0;
    }

    const firstAccrualMonth = confDay < 15 ? confMonth : confMonth + 1;
    const remainingMonths = Math.max(0, 12 - firstAccrualMonth);
    const raw = remainingMonths * ratePerMonth;
    return Math.floor(raw * 2) / 2;
  }
}
