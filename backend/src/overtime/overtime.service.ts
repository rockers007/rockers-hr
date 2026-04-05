import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OvertimeRequest } from './entities/overtime-request.entity';
import { User } from '../users/entities/user.entity';
import { CreateOvertimeDto, ReviewOvertimeDto, UpdatePaymentDto } from './dto/overtime.dto';

@Injectable()
export class OvertimeService {
  constructor(
    @InjectRepository(OvertimeRequest)
    private readonly otRepo: Repository<OvertimeRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Employee applies for overtime.
   */
  async create(userId: string, dto: CreateOvertimeDto): Promise<OvertimeRequest> {
    // Validate user is active
    const user = await this.userRepo.findOne({ where: { id: userId, is_active: true } });
    if (!user) throw new BadRequestException('User not found or inactive');

    // Check last working day
    if (user.last_working_day) {
      const lwd = new Date(user.last_working_day);
      const otDate = new Date(dto.date);
      if (otDate > lwd) {
        throw new BadRequestException('Cannot apply overtime after your last working day');
      }
    }

    // Calculate hours from start_time and end_time
    const hours = this.calculateHours(dto.start_time, dto.end_time);
    if (hours <= 0) {
      throw new BadRequestException('End time must be after start time');
    }
    if (hours > 16) {
      throw new BadRequestException('Overtime cannot exceed 16 hours in a day');
    }

    // Check for duplicate on same date
    const existing = await this.otRepo.findOne({
      where: { user_id: userId, date: dto.date, status: 'pending' as any },
    });
    if (existing) {
      throw new BadRequestException('You already have a pending overtime request for this date');
    }

    const record = this.otRepo.create({
      user_id: userId,
      date: dto.date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      hours,
      reason: dto.reason,
      status: 'pending',
      payment_status: 'unpaid',
    });

    return this.otRepo.save(record);
  }

  /**
   * Employee views own overtime history.
   */
  async findByUser(userId: string, query?: { year?: number; status?: string }): Promise<OvertimeRequest[]> {
    const qb = this.otRepo
      .createQueryBuilder('ot')
      .leftJoinAndSelect('ot.reviewedBy', 'reviewer')
      .where('ot.user_id = :userId', { userId })
      .orderBy('ot.date', 'DESC');

    if (query?.year) {
      qb.andWhere('EXTRACT(YEAR FROM ot.date) = :year', { year: query.year });
    }
    if (query?.status) {
      qb.andWhere('ot.status = :status', { status: query.status });
    }

    return qb.getMany();
  }

  /**
   * Employee cancels own pending overtime request.
   */
  async cancel(userId: string, id: string): Promise<OvertimeRequest> {
    const record = await this.otRepo.findOne({ where: { id, user_id: userId } });
    if (!record) throw new NotFoundException('Overtime request not found');
    if (record.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    await this.otRepo.remove(record);
    return record;
  }

  // ── Admin endpoints ──

  /**
   * Admin lists all overtime requests, filterable.
   */
  async findAll(query?: {
    status?: string;
    payment_status?: string;
    user_id?: string;
    year?: number;
    month?: number;
  }): Promise<OvertimeRequest[]> {
    const qb = this.otRepo
      .createQueryBuilder('ot')
      .leftJoinAndSelect('ot.user', 'user')
      .leftJoinAndSelect('ot.reviewedBy', 'reviewer')
      .orderBy('ot.date', 'DESC');

    if (query?.status) {
      qb.andWhere('ot.status = :status', { status: query.status });
    }
    if (query?.payment_status) {
      qb.andWhere('ot.payment_status = :ps', { ps: query.payment_status });
    }
    if (query?.user_id) {
      qb.andWhere('ot.user_id = :uid', { uid: query.user_id });
    }
    if (query?.year) {
      qb.andWhere('EXTRACT(YEAR FROM ot.date) = :year', { year: query.year });
    }
    if (query?.month) {
      qb.andWhere('EXTRACT(MONTH FROM ot.date) = :month', { month: query.month });
    }

    return qb.getMany();
  }

  /**
   * Admin: pending overtime requests.
   */
  async findPending(): Promise<OvertimeRequest[]> {
    return this.otRepo
      .createQueryBuilder('ot')
      .leftJoinAndSelect('ot.user', 'user')
      .where('ot.status = :status', { status: 'pending' })
      .orderBy('ot.date', 'ASC')
      .getMany();
  }

  /**
   * Admin approves or declines an overtime request.
   */
  async review(
    id: string,
    adminId: string,
    dto: ReviewOvertimeDto,
  ): Promise<OvertimeRequest> {
    const record = await this.otRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!record) throw new NotFoundException('Overtime request not found');
    if (record.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be reviewed');
    }

    record.status = dto.status;
    record.reviewed_by_id = adminId;
    record.admin_remarks = dto.admin_remarks ?? null;
    record.reviewed_at = new Date();

    return this.otRepo.save(record);
  }

  /**
   * Admin updates payment status of an approved overtime.
   */
  async updatePayment(
    id: string,
    adminId: string,
    dto: UpdatePaymentDto,
  ): Promise<OvertimeRequest> {
    const record = await this.otRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Overtime request not found');
    if (record.status !== 'approved') {
      throw new BadRequestException('Only approved overtime can have payment updated');
    }

    record.payment_status = dto.payment_status;
    record.payment_remarks = dto.payment_remarks ?? null;
    if (dto.payment_status === 'paid') {
      record.paid_at = new Date();
    }

    return this.otRepo.save(record);
  }

  /**
   * Summary stats for an employee.
   */
  async getSummary(userId: string, year: number) {
    const rows = await this.otRepo
      .createQueryBuilder('ot')
      .select('ot.status', 'status')
      .addSelect('ot.payment_status', 'payment_status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(ot.hours), 0)::float', 'total_hours')
      .where('ot.user_id = :userId', { userId })
      .andWhere('EXTRACT(YEAR FROM ot.date) = :year', { year })
      .groupBy('ot.status')
      .addGroupBy('ot.payment_status')
      .getRawMany();

    return {
      year,
      breakdown: rows,
      total_approved_hours: rows
        .filter((r) => r.status === 'approved')
        .reduce((sum, r) => sum + Number(r.total_hours), 0),
      total_paid_hours: rows
        .filter((r) => r.payment_status === 'paid')
        .reduce((sum, r) => sum + Number(r.total_hours), 0),
    };
  }

  // ── Private helpers ──

  private calculateHours(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    const diff = endMinutes - startMinutes;
    return Math.round((diff / 60) * 100) / 100; // 2 decimal places
  }
}
