import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BankChangeRequest,
  BankChangeStatus,
} from '../entities/bank-change-request.entity';
import { User } from '../../users/entities/user.entity';
import { AdminUser } from '../../users/entities/admin-user.entity';
import { PayrollAuditService } from '../common/payroll-audit.service';
import { NotificationsService } from '../../notifications/notifications.service';

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

@Injectable()
export class BankChangeService {
  private readonly logger = new Logger(BankChangeService.name);

  constructor(
    @InjectRepository(BankChangeRequest)
    private readonly repo: Repository<BankChangeRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
    private readonly audit: PayrollAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async submit(
    userId: string,
    body: {
      new_bank_name: string;
      new_account_no: string;
      new_ifsc: string;
      proof_s3_key?: string;
    },
  ): Promise<BankChangeRequest> {
    if (!IFSC_REGEX.test(body.new_ifsc)) {
      throw new BadRequestException('Invalid IFSC format (expected ABCD0123456)');
    }
    if (!/^\d{9,18}$/.test(body.new_account_no)) {
      throw new BadRequestException(
        'Account number must be 9–18 digits (numbers only)',
      );
    }

    const pending = await this.repo.findOne({
      where: { user_id: userId, status: 'PENDING' as BankChangeStatus },
    });
    if (pending) {
      throw new ConflictException({
        code: 'PR_BANK_CHANGE_PENDING',
        message: 'Employee already has a pending bank change request',
      });
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const row = this.repo.create({
      user_id: userId,
      current_bank_name: user?.bank_name ?? null,
      current_account_no: user?.bank_account_no ?? null,
      current_ifsc: user?.bank_ifsc ?? null,
      new_bank_name: body.new_bank_name,
      new_account_no: body.new_account_no,
      new_ifsc: body.new_ifsc,
      proof_s3_key: body.proof_s3_key ?? null,
      status: 'PENDING' as BankChangeStatus,
    });
    const saved = await this.repo.save(row);

    await this.audit.log({
      actorId: userId,
      action: 'payroll.bank_change.submitted',
      entityType: 'bank_change_requests',
      entityId: saved.id,
      after: saved,
    });

    // Notify super-admins. Fire-and-forget — a notification failure
    // should not roll back the saved request (the user already
    // submitted, the row exists in PENDING). Errors are logged so the
    // admin can still see the request in the dashboard.
    this.notifySuperAdminsOfSubmission(saved, user).catch((e) =>
      this.logger.error(
        `Failed to dispatch payroll.bank_change_submitted: ${String(e)}`,
      ),
    );

    return saved;
  }

  /**
   * Email every active Super Admin (master_admin_roles.name = 'Super Admin')
   * whenever an employee submits a bank-change request, so they know to
   * review it in the admin panel. Other admin roles can still review
   * the request — this is just the alert escalation.
   */
  private async notifySuperAdminsOfSubmission(
    request: BankChangeRequest,
    employee: User | null,
  ): Promise<void> {
    // Pull super-admins with their email addresses in one query.
    const recipients: Array<{ user_id: string; gmail: string }> =
      await this.adminUserRepo
        .createQueryBuilder('au')
        .leftJoin('au.role', 'role')
        .leftJoin('au.user', 'u')
        .where('au.is_active = true')
        .andWhere('role.name = :rname', { rname: 'Super Admin' })
        .select(['au.user_id AS user_id', 'u.gmail AS gmail'])
        .getRawMany();

    if (recipients.length === 0) {
      this.logger.warn(
        'No active Super Admin to notify about bank change request — check master_admin_roles seed.',
      );
      return;
    }

    await this.notifications.dispatch(
      'payroll.bank_change_submitted',
      recipients
        .filter((r) => !!r.gmail)
        .map((r) => ({ userId: r.user_id, email: r.gmail })),
      {
        employeeName: employee?.name ?? 'an employee',
        empNumber: employee?.emp_number ?? '—',
        submittedAt: request.submitted_at
          ? new Date(request.submitted_at).toISOString()
          : new Date().toISOString(),
      },
    );
  }

  async listMine(userId: string): Promise<BankChangeRequest[]> {
    return this.repo.find({
      where: { user_id: userId },
      order: { submitted_at: 'DESC' },
    });
  }

  async listAll(
    status?: BankChangeStatus,
  ): Promise<BankChangeRequest[]> {
    const qb = this.repo
      .createQueryBuilder('b')
      .orderBy(`CASE WHEN b.status = 'PENDING' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('b.submitted_at', 'DESC');
    if (status) qb.andWhere('b.status = :s', { s: status });
    return qb.getMany();
  }

  async approve(id: string, actorId: string): Promise<BankChangeRequest> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Bank change request not found');
    if (row.status !== 'PENDING') {
      throw new ConflictException('Request is not pending');
    }

    const user = await this.userRepo.findOne({ where: { id: row.user_id } });
    if (!user) throw new NotFoundException('User not found');

    user.bank_name = row.new_bank_name;
    user.bank_account_no = row.new_account_no;
    user.bank_ifsc = row.new_ifsc;
    await this.userRepo.save(user);

    row.status = 'APPROVED' as BankChangeStatus;
    row.reviewed_by = actorId;
    row.reviewed_at = new Date();
    const saved = await this.repo.save(row);

    await this.audit.log({
      actorId,
      action: 'payroll.bank_change.approved',
      entityType: 'bank_change_requests',
      entityId: id,
      after: { user_id: row.user_id },
    });
    return saved;
  }

  async reject(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<BankChangeRequest> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Bank change request not found');
    if (row.status !== 'PENDING') {
      throw new ConflictException('Request is not pending');
    }
    if (!reason?.trim()) {
      throw new BadRequestException('Rejection reason required');
    }

    row.status = 'REJECTED' as BankChangeStatus;
    row.rejection_reason = reason;
    row.reviewed_by = actorId;
    row.reviewed_at = new Date();
    const saved = await this.repo.save(row);

    await this.audit.log({
      actorId,
      action: 'payroll.bank_change.rejected',
      entityType: 'bank_change_requests',
      entityId: id,
      after: { reason },
    });
    return saved;
  }
}
