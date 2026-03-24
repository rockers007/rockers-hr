import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
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
  ) {}

  async register(gmail: string, dto: RegisterUserDto): Promise<User> {
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
    });

    return this.userRepo.save(user);
  }

  async findByGmail(gmail: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { gmail } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['gender', 'roleType', 'qualification', 'department', 'manager'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
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
      resume_s3_key: user.resume_s3_key,
      manager: user.manager
        ? { id: user.manager.id, name: user.manager.name }
        : null,
      join_date: user.join_date,
      confirmation_date: user.confirmation_date,
      is_in_probation: isInProbation,
      is_manager: user.is_manager,
      extra_info: user.extra_info,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId);
    Object.assign(user, dto);
    return this.userRepo.save(user);
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

    // Get probation duration
    const probationConfig = await this.slaConfigRepo.findOne({
      where: { config_key: 'probation.duration_months' },
    });
    const probationMonths = probationConfig ? parseInt(probationConfig.config_value, 10) : 3;

    const joinDate = new Date(dto.join_date);
    const confirmationDate = new Date(joinDate);
    confirmationDate.setMonth(confirmationDate.getMonth() + probationMonths);

    user.is_active = true;
    user.join_date = dto.join_date;
    user.confirmation_date = confirmationDate.toISOString().split('T')[0];
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

    // Get probation duration
    const probationConfig = await this.slaConfigRepo.findOne({
      where: { config_key: 'probation.duration_months' },
    });
    const probationMonths = probationConfig ? parseInt(probationConfig.config_value, 10) : 3;

    const joinDate = new Date(dto.join_date);
    const confirmationDate = new Date(joinDate);
    confirmationDate.setMonth(confirmationDate.getMonth() + probationMonths);

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
      confirmation_date: confirmationDate.toISOString().split('T')[0],
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
      .leftJoinAndSelect('u.manager', 'm');

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

  private async createLeaveBalances(userId: string, joinDate: Date): Promise<void> {
    const currentYear = new Date().getFullYear();
    const leaveTypes = await this.leaveTypeRepo.find({ where: { is_active: true } });

    const joinMonth = joinDate.getMonth(); // 0-based
    const monthsRemaining = 12 - joinMonth;

    const balances = leaveTypes.map((lt) => {
      const prorated = joinDate.getFullYear() === currentYear
        ? Math.round((lt.annual_days * monthsRemaining / 12) * 2) / 2 // round to 0.5
        : lt.annual_days;

      return this.leaveBalanceRepo.create({
        user_id: userId,
        leave_type_id: lt.id,
        year: currentYear,
        total_days: prorated,
        used_days: 0,
        pending_days: 0,
      });
    });

    await this.leaveBalanceRepo.save(balances);
  }
}
