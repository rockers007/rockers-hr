import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from './entities/user.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ActivateUserDto } from './dto/activate-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(MasterLeaveType)
    private readonly leaveTypeRepo: Repository<MasterLeaveType>,
    @InjectRepository(MasterSlaConfig)
    private readonly slaConfigRepo: Repository<MasterSlaConfig>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Convert an S3 key stored on the user row into a CloudFront URL that the
   * browser can render directly. Returns null when either the key or the
   * CloudFront base URL is missing — the frontend falls back to initials.
   */
  private buildPhotoUrl(s3Key: string | null | undefined): string | null {
    if (!s3Key) return null;
    const base = this.configService.get<string>('AWS_CLOUDFRONT_URL', '');
    if (!base) return null;
    const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const trimmedKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
    return `${trimmedBase}/${trimmedKey}`;
  }

  async register(
    gmail: string,
    dto: RegisterUserDto,
    googleTokens?: { google_access_token?: string; google_refresh_token?: string },
  ): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { gmail } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate DOB is 18+
    const dob = new Date(dto.dob);
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    if (dob > eighteenYearsAgo) {
      throw new BadRequestException('You must be at least 18 years old');
    }

    const user = this.userRepo.create({
      gmail,
      name: dto.name,
      phone: dto.phone,
      dob: dto.dob,
      gender_id: dto.gender_id,
      qualification_id: dto.qualification_id,
      role_type_id: dto.role_type_id,
      department_id: dto.department_id || null,
      extra_info: dto.extra_info || null,
      photo_s3_key: dto.photo_s3_key || null,
      resume_s3_key: dto.resume_s3_key || null,
      is_active: false,
      registration_method: 'self',
      google_access_token: googleTokens?.google_access_token || null,
      google_refresh_token: googleTokens?.google_refresh_token || null,
    });

    return this.userRepo.save(user);
  }

  async findByGmail(gmail: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { gmail } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: [
        'gender',
        'roleType',
        'qualification',
        'department',
        'manager',
        'designationMaster',
      ],
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);

    const probationConfig = await this.slaConfigRepo.findOne({
      where: { config_key: 'probation.duration_months' },
    });
    const probationMonths = probationConfig ? parseInt(probationConfig.config_value, 10) : 3;

    let isInProbation = false;
    if (user.join_date) {
      const joinDate = new Date(user.join_date);
      const probationEnd = new Date(joinDate);
      probationEnd.setMonth(probationEnd.getMonth() + probationMonths);
      isInProbation = new Date() < probationEnd;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.gmail,
      phone: user.phone,
      role: user.roleType?.system_key || 'employee',
      department: user.department
        ? { id: user.department.id, label: user.department.label }
        : null,
      gender: user.gender
        ? { id: user.gender.id, label: user.gender.label }
        : null,
      qualification: user.qualification
        ? { id: user.qualification.id, label: user.qualification.label }
        : null,
      photo_s3_key: user.photo_s3_key,
      photo_url: this.buildPhotoUrl(user.photo_s3_key),
      resume_s3_key: user.resume_s3_key,
      manager: user.manager
        ? { id: user.manager.id, name: user.manager.name }
        : null,
      join_date: user.join_date,
      confirmation_date: user.confirmation_date,
      is_in_probation: isInProbation,
      is_manager: user.is_manager,
      extra_info: user.extra_info,
      resignation_date: user.resignation_date,
      last_working_day: user.last_working_day,
      employment_status: user.employment_status || 'active',
      // Payroll fields (editable on /admin/employees/[id]/edit)
      emp_number: user.emp_number ?? null,
      // designation: if the new FK is set, prefer that label; otherwise fall
      // back to the legacy free-text column. designation_id is always
      // returned so the admin edit form can pre-select the dropdown.
      designation_id: user.designation_id ?? null,
      designation: user.designationMaster?.label ?? user.designation ?? null,
      gross: user.gross ?? '0',
      incentive: user.incentive ?? '0',
      pf_applicable: user.pf_applicable ?? true,
      dob: user.dob ?? null,
      // Bank details (editable by admin on same page)
      bank_name: user.bank_name ?? null,
      bank_account_no: user.bank_account_no ?? null,
      bank_ifsc: user.bank_ifsc ?? null,
      // Extended profile
      marital_status_id: user.marital_status_id ?? null,
      current_address: user.current_address ?? null,
      permanent_address: user.permanent_address ?? null,
      emergency_phone: user.emergency_phone ?? null,
      pf_uan_no: user.pf_uan_no ?? null,
      esic_no: user.esic_no ?? null,
      // Surfaced for admin auto-refresh: used by the edit page to decide
      // whether server data is newer than what the form originally loaded.
      updated_at: user.updated_at,
    };
  }

  /**
   * Fields an employee may edit about themselves via PATCH /users/me.
   * NOT editable by the employee: gmail, emp_number, role_type_id, manager_id,
   * is_active, is_manager, employment_status, and anything payroll-related
   * (gross / incentive / pf_applicable etc.). Admin can still edit those via
   * PATCH /admin/users/:id.
   */
  // Fields the employee can PATCH on themselves via /users/me.
  // Explicitly excluded (admin-only): gmail, emp_number, join_date,
  // confirmation_date, department_id, manager_id, is_manager,
  // role_type_id, employment_status, resignation_date, last_working_day,
  // gross/incentive/tds/loan_emi/sal_deduction/security_return/pf_applicable.
  private readonly SELF_ALLOWED_FIELDS: Array<keyof User> = [
    'name',
    'phone',
    'dob',
    'gender_id',
    'qualification_id',
    'photo_s3_key',
    'resume_s3_key',
    'extra_info',
    // Extended profile
    'marital_status_id',
    'current_address',
    'permanent_address',
    'emergency_phone',
    'pf_uan_no',
    'esic_no',
    // Bank — self-serve write allowed (employee can also use the bank-change
    // workflow, but the profile page accepts direct edits for onboarding use).
    'bank_name',
    'bank_account_no',
    'bank_ifsc',
  ];

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // DOB must be strictly past (no today, no future)
    if (dto.dob) {
      this.assertPastDate(dto.dob, 'Date of birth');
    }
    const user = await this.findById(userId);
    const incoming = dto as unknown as Record<string, unknown>;
    for (const key of this.SELF_ALLOWED_FIELDS) {
      if (incoming[key] !== undefined) {
        // Normalize empty strings to null for nullable text columns
        (user as unknown as Record<string, unknown>)[key] =
          incoming[key] === '' ? null : incoming[key];
      }
    }
    await this.userRepo.save(user);
    // Return the same shape as getProfile so the frontend has photo_url +
    // expanded relations without a second round-trip.
    return this.getProfile(userId);
  }

  /**
   * Throw BadRequestException if `value` (yyyy-MM-dd or ISO) is today or in
   * the future. Used for date-of-birth fields that must lie strictly in the
   * past.
   */
  assertPastDate(value: string, label = 'Date'): void {
    const chosen = new Date(value.length === 10 ? value + 'T00:00:00Z' : value);
    if (Number.isNaN(chosen.getTime())) {
      throw new BadRequestException(`${label} is not a valid date.`);
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (chosen.getTime() >= today.getTime()) {
      throw new BadRequestException(`${label} must be in the past.`);
    }
  }

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepo.update(userId, { fcm_token: fcmToken });
  }

  // ---- Admin endpoints ----

  async getPendingRegistrations() {
    return this.userRepo.find({
      where: { is_active: false, registration_method: 'self' },
      relations: ['gender', 'roleType', 'qualification', 'department'],
      order: { created_at: 'DESC' },
    });
  }

  async activateUser(userId: string, dto: ActivateUserDto): Promise<User> {
    const user = await this.findById(userId);
    if (user.is_active) {
      throw new ConflictException('User is already active');
    }

    const joinDate = new Date(dto.join_date);

    user.is_active = true;
    user.join_date = dto.join_date;
    // confirmation_date is NOT auto-calculated — admin sets it manually
    user.manager_id = dto.manager_id || null;
    user.is_manager = dto.is_manager || false;

    const savedUser = await this.userRepo.save(user);

    // Create leave balances for current year
    await this.createLeaveBalances(savedUser.id, joinDate);

    return savedUser;
  }

  async rejectUser(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (user.is_active) {
      throw new ConflictException('Cannot reject an active user');
    }
    // Soft delete — keep record but ensure is_active remains false
    return user;
  }

  async adminCreateUser(dto: AdminCreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { gmail: dto.gmail } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const joinDate = new Date(dto.join_date);

    const user = this.userRepo.create({
      gmail: dto.gmail,
      name: dto.name,
      phone: dto.phone || null,
      dob: dto.dob || null,
      gender_id: dto.gender_id,
      qualification_id: dto.qualification_id,
      role_type_id: dto.role_type_id,
      department_id: dto.department_id || null,
      manager_id: dto.manager_id || null,
      is_manager: dto.is_manager || false,
      join_date: dto.join_date,
      // confirmation_date is NOT auto-calculated — admin sets it manually
      is_active: dto.account_status === 'active',
      registration_method: 'admin_direct',
    });

    const savedUser = await this.userRepo.save(user);

    if (dto.account_status === 'active') {
      await this.createLeaveBalances(savedUser.id, joinDate);
    }

    return savedUser;
  }

  async listUsers(query: QueryUsersDto) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.department', 'd')
      .leftJoinAndSelect('u.roleType', 'rt')
      .leftJoinAndSelect('u.manager', 'm')
      .leftJoinAndSelect('u.designationMaster', 'desig');

    if (query.department_id) {
      qb.andWhere('u.department_id = :departmentId', { departmentId: query.department_id });
    }
    if (query.role_type_id) {
      qb.andWhere('u.role_type_id = :roleTypeId', { roleTypeId: query.role_type_id });
    }
    if (query.is_active !== undefined) {
      qb.andWhere('u.is_active = :isActive', { isActive: query.is_active });
    }
    if (query.is_manager !== undefined) {
      qb.andWhere('u.is_manager = :isManager', { isManager: query.is_manager });
    }
    if (query.search) {
      qb.andWhere('(u.name ILIKE :search OR u.gmail ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.orderBy('u.created_at', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // Attach a resolved CloudFront URL so the admin list can render the
    // employee's photo without each client knowing the CDN host, and
    // promote the designation master label onto the top-level designation
    // field (falling back to the legacy free-text column).
    const decorated = data.map((u) => ({
      ...u,
      photo_url: this.buildPhotoUrl(u.photo_s3_key),
      designation: u.designationMaster?.label ?? u.designation ?? null,
    }));

    return {
      data: decorated,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getManagers() {
    return this.userRepo.find({
      where: { is_manager: true, is_active: true },
      select: ['id', 'name', 'department_id'],
      relations: ['department'],
      order: { name: 'ASC' },
    });
  }

  async adminUpdateUser(userId: string, updates: Partial<User>): Promise<User> {
    const user = await this.findById(userId);
    Object.assign(user, updates);
    return this.userRepo.save(user);
  }

  // ---- Helpers ----

  /**
   * Create leave balances with pro-rata accrual logic:
   *
   * CL & SL (accrual_type='monthly'):
   *   - Only granted AFTER probation confirmation
   *   - Accrual: 0.5/month from confirmation month
   *   - If confirmed before 15th → that month counts
   *   - If confirmed on/after 15th → starts next month
   *   - Rounding: floor to nearest 0.5
   *
   * PL (min_tenure_months=12):
   *   - Only after 1 year of service → 0 balance initially
   *
   * LWP, Early Leave (fixed, probation_allowed=true):
   *   - Full allocation immediately
   */
  private async createLeaveBalances(userId: string, joinDate: Date): Promise<void> {
    const currentYear = new Date().getFullYear();
    const leaveTypes = await this.leaveTypeRepo.find({ where: { is_active: true } });

    // Get probation duration to calculate confirmation date
    const probationConfig = await this.slaConfigRepo.findOne({
      where: { config_key: 'probation.duration_months' },
    });
    const probationMonths = probationConfig ? parseInt(probationConfig.config_value, 10) : 3;
    const confirmationDate = new Date(joinDate);
    confirmationDate.setMonth(confirmationDate.getMonth() + probationMonths);

    const balances = leaveTypes.map((lt) => {
      let totalDays: number;

      if (lt.accrual_type === 'monthly' && lt.accrual_rate_per_month) {
        // CL/SL: pro-rata from confirmation date
        totalDays = this.calculateMonthlyAccrual(
          confirmationDate,
          Number(lt.accrual_rate_per_month),
          currentYear,
        );
      } else if (lt.min_tenure_months > 0) {
        // PL: Check if employee already has required tenure
        const now = new Date();
        const monthsWorked =
          (now.getFullYear() - joinDate.getFullYear()) * 12 +
          (now.getMonth() - joinDate.getMonth());
        totalDays = monthsWorked >= lt.min_tenure_months ? lt.annual_days : 0;
      } else {
        // LWP, Early Leave, etc: full allocation
        totalDays = lt.annual_days;
      }

      return this.leaveBalanceRepo.create({
        user_id: userId,
        leave_type_id: lt.id,
        year: currentYear,
        total_days: totalDays,
        used_days: 0,
        pending_days: 0,
      });
    });

    await this.leaveBalanceRepo.save(balances);
  }

  /**
   * Calculate monthly accrual for CL/SL based on confirmation date.
   *
   * Rules:
   * - If confirmation falls in the target year:
   *   - If day < 15 → that month is the first accrual month
   *   - If day >= 15 → next month is first accrual month
   *   - Remaining months (including first) × rate
   * - If confirmation is before target year: full annual_days
   * - If confirmation is after target year: 0
   *
   * Result is floored to nearest 0.5
   */
  private calculateMonthlyAccrual(
    confirmationDate: Date,
    ratePerMonth: number,
    targetYear: number,
  ): number {
    const confYear = confirmationDate.getFullYear();
    const confMonth = confirmationDate.getMonth(); // 0-based
    const confDay = confirmationDate.getDate();

    // Already confirmed before this year → full year accrual (12 months)
    if (confYear < targetYear) {
      return Math.floor(12 * ratePerMonth * 2) / 2;
    }

    // Won't be confirmed until after this year → 0
    if (confYear > targetYear) {
      return 0;
    }

    // Confirmation is this year — calculate remaining months
    // If confirmed before 15th → that month counts
    // If confirmed on/after 15th → starts next month
    const firstAccrualMonth = confDay < 15 ? confMonth : confMonth + 1;

    // Remaining months: firstAccrualMonth through December (month 11)
    const remainingMonths = Math.max(0, 12 - firstAccrualMonth);

    // Floor to nearest 0.5
    const raw = remainingMonths * ratePerMonth;
    return Math.floor(raw * 2) / 2;
  }
}
