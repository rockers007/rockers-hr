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

    return allTypes.filter((t) => t.probation_allowed);
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
    const workingDays = this.calcWorkingDays(
      startDate,
      endDate,
      Number(duration.day_value),
      holidays,
    );

    // Balance
    const balance = await this.balanceRepo.findOne({
      where: { user_id: userId, leave_type_id: dto.leave_type_id, year },
    });
    const available = balance
      ? Number(balance.total_days) -
        Number(balance.used_days) -
        Number(balance.pending_days)
      : 0;

    // Sandwich detection
    const { detected, detail } = this.detectSandwich(
      startDate,
      endDate,
      holidays,
    );

    // Document requirement
    const docRequired =
      leaveType.doc_required &&
      (leaveType.doc_threshold_days === null ||
        workingDays >= leaveType.doc_threshold_days);

    return {
      working_days: workingDays,
      balance_before: available,
      balance_after: available - workingDays,
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

    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be >= start date');
    }

    // 1. Probation check
    const inProbation = await this.isInProbation(user);
    if (inProbation && !leaveType.probation_allowed) {
      throw new UnprocessableEntityException({
        code: 'PROBATION_RESTRICTION',
        message:
          'You are in a probation period and cannot apply for this leave type.',
      });
    }

    // 2. Working days calculation
    const year = startDate.getFullYear();
    const holidays = await this.getHolidayDates(year);
    const workingDays = this.calcWorkingDays(
      startDate,
      endDate,
      Number(duration.day_value),
      holidays,
    );

    if (workingDays <= 0) {
      throw new UnprocessableEntityException({
        code: 'NO_WORKING_DAYS',
        message: 'No working days in the selected range.',
      });
    }

    // 3. Sandwich detection
    const { detected: sandwichDetected } = this.detectSandwich(
      startDate,
      endDate,
      holidays,
    );
    if (sandwichDetected && !dto.sandwich_confirmed) {
      throw new UnprocessableEntityException({
        code: 'SANDWICH_CONFIRMATION_REQUIRED',
        message:
          'Sandwich leave detected. Please confirm before submitting.',
      });
    }

    // 4. Document requirement check
    const docRequired =
      leaveType.doc_required &&
      (leaveType.doc_threshold_days === null ||
        workingDays >= leaveType.doc_threshold_days);
    if (docRequired && !dto.doc_s3_key) {
      throw new UnprocessableEntityException({
        code: 'DOCUMENT_REQUIRED',
        message: `A supporting document is required for ${leaveType.label} of ${leaveType.doc_threshold_days ?? 1}+ days.`,
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

    // Notify approver
    if (approverUser) {
      await this.notificationsService.dispatch(
        'leave.submitted',
        [{ userId: approverUser.id, email: approverUser.gmail }],
        { ...tokens, manager_name: approverUser.name },
      );
    }

    // Confirm to employee
    await this.notificationsService.dispatch(
      'leave.submitted.confirmation',
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
      'leave.approved.l1',
      [{ userId: employee.id, email: employee.gmail }],
      tokens,
    );

    // Notify HR
    const hrAdmin = await this.getFirstHrAdmin();
    if (hrAdmin) {
      await this.notificationsService.dispatch(
        'leave.pending.l2',
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
    return this.approvalRepo
      .createQueryBuilder('la')
      .innerJoinAndSelect('la.leaveRequest', 'lr')
      .innerJoinAndSelect('lr.user', 'emp')
      .innerJoinAndSelect('lr.leaveType', 'lt')
      .innerJoinAndSelect('lr.durationType', 'dt')
      .where('la.level = :level', { level: 2 })
      .andWhere('la.action IS NULL')
      .orderBy('la.created_at', 'ASC')
      .getMany();
  }

  async approveL2(approvalId: string, adminUserId: string): Promise<void> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, level: 2 },
      relations: ['leaveRequest', 'leaveRequest.user', 'leaveRequest.leaveType'],
    });

    if (!approval || approval.action !== null) {
      throw new NotFoundException('Pending approval not found');
    }

    await this.dataSource.transaction(async (manager) => {
      approval.action = 'approved';
      approval.actioned_at = new Date();
      await manager.save(LeaveApproval, approval);

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

    // TODO: Google Calendar event creation will be added in calendar module
  }

  async declineL2(
    approvalId: string,
    adminUserId: string,
    reason: string,
  ): Promise<void> {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Decline reason is required');
    }

    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, level: 2 },
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

  // ─── Helper: Sandwich leave detection ───

  private detectSandwich(
    start: Date,
    end: Date,
    holidays: Set<string>,
  ): { detected: boolean; detail: string | null } {
    // Check if there are non-working days (weekends/holidays) between working days in the range
    const allDates: { date: Date; isWorking: boolean }[] = [];
    const cursor = new Date(start);

    // Extend range: check one day before start and one day after end
    const extStart = new Date(start);
    extStart.setDate(extStart.getDate() - 1);
    const extEnd = new Date(end);
    extEnd.setDate(extEnd.getDate() + 1);

    const check = new Date(extStart);
    while (check <= extEnd) {
      const dow = check.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const dateStr = check.toISOString().split('T')[0];
      const isHoliday = holidays.has(dateStr);
      allDates.push({
        date: new Date(check),
        isWorking: !isWeekend && !isHoliday,
      });
      check.setDate(check.getDate() + 1);
    }

    // Look for pattern: leave-day, non-working gap, leave-day
    // The actual leave range is from start to end
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    // Check if leave bridges a weekend/holiday gap
    let inLeave = false;
    let foundGap = false;

    for (let i = 0; i < allDates.length; i++) {
      const dateStr = allDates[i].date.toISOString().split('T')[0];
      const isInRange = dateStr >= startStr && dateStr <= endStr;

      if (isInRange && allDates[i].isWorking) {
        if (foundGap) {
          // We found a working leave day after a non-working gap — sandwich detected
          return {
            detected: true,
            detail:
              'Your leave spans weekends/holidays between working days. These non-working days may count as part of your leave.',
          };
        }
        inLeave = true;
      } else if (isInRange && !allDates[i].isWorking && inLeave) {
        foundGap = true;
      }
    }

    return { detected: false, detail: null };
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
}
