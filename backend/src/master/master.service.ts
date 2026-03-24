import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MasterQualification,
  MasterGender,
  MasterRoleType,
  MasterLeaveType,
  MasterLeaveDuration,
  MasterDepartment,
  MasterFileType,
  MasterNotificationTemplate,
  MasterSlaConfig,
  MasterPublicHoliday,
  MasterAdminRole,
} from './entities';

// Maps URL table param to actual DB table name prefix
const ALLOWED_TABLES = [
  'qualifications',
  'genders',
  'role_types',
  'leave_types',
  'leave_durations',
  'departments',
  'file_types',
  'notification_templates',
  'sla_config',
  'public_holidays',
  'admin_roles',
] as const;

export type MasterTableName = (typeof ALLOWED_TABLES)[number];

@Injectable()
export class MasterService {
  private readonly repoMap: Record<string, Repository<any>>;

  constructor(
    @InjectRepository(MasterQualification)
    private qualificationsRepo: Repository<MasterQualification>,
    @InjectRepository(MasterGender)
    private gendersRepo: Repository<MasterGender>,
    @InjectRepository(MasterRoleType)
    private roleTypesRepo: Repository<MasterRoleType>,
    @InjectRepository(MasterLeaveType)
    private leaveTypesRepo: Repository<MasterLeaveType>,
    @InjectRepository(MasterLeaveDuration)
    private leaveDurationsRepo: Repository<MasterLeaveDuration>,
    @InjectRepository(MasterDepartment)
    private departmentsRepo: Repository<MasterDepartment>,
    @InjectRepository(MasterFileType)
    private fileTypesRepo: Repository<MasterFileType>,
    @InjectRepository(MasterNotificationTemplate)
    private notificationTemplatesRepo: Repository<MasterNotificationTemplate>,
    @InjectRepository(MasterSlaConfig)
    private slaConfigRepo: Repository<MasterSlaConfig>,
    @InjectRepository(MasterPublicHoliday)
    private publicHolidaysRepo: Repository<MasterPublicHoliday>,
    @InjectRepository(MasterAdminRole)
    private adminRolesRepo: Repository<MasterAdminRole>,
  ) {
    this.repoMap = {
      qualifications: this.qualificationsRepo,
      genders: this.gendersRepo,
      role_types: this.roleTypesRepo,
      leave_types: this.leaveTypesRepo,
      leave_durations: this.leaveDurationsRepo,
      departments: this.departmentsRepo,
      file_types: this.fileTypesRepo,
      notification_templates: this.notificationTemplatesRepo,
      sla_config: this.slaConfigRepo,
      public_holidays: this.publicHolidaysRepo,
      admin_roles: this.adminRolesRepo,
    };
  }

  validateTable(table: string): MasterTableName {
    if (!ALLOWED_TABLES.includes(table as MasterTableName)) {
      throw new BadRequestException(
        `Invalid master table: "${table}". Allowed: ${ALLOWED_TABLES.join(', ')}`,
      );
    }
    return table as MasterTableName;
  }

  private getRepo(table: MasterTableName): Repository<any> {
    return this.repoMap[table];
  }

  // Tables that use standard sort_order ordering
  private hasStandardSorting(table: MasterTableName): boolean {
    const noSortOrder: MasterTableName[] = [
      'file_types',
      'notification_templates',
      'sla_config',
      'admin_roles',
      'public_holidays',
    ];
    return !noSortOrder.includes(table);
  }

  // Tables that have is_active field
  private hasIsActive(table: MasterTableName): boolean {
    return table !== 'sla_config';
  }

  async findActive(table: MasterTableName, query?: Record<string, any>): Promise<any[]> {
    const repo = this.getRepo(table);
    const where: Record<string, any> = {};

    if (this.hasIsActive(table)) {
      where.is_active = true;
    }

    // Support context filter for file_types
    if (table === 'file_types' && query?.context) {
      where.context = query.context;
    }

    const order: Record<string, 'ASC' | 'DESC'> = {};
    if (table === 'public_holidays') {
      order.date = 'ASC';
    } else if (this.hasStandardSorting(table)) {
      order.sort_order = 'ASC';
    }

    return repo.find({ where, order });
  }

  async findAll(table: MasterTableName): Promise<any[]> {
    const repo = this.getRepo(table);
    const order: Record<string, 'ASC' | 'DESC'> = {};
    if (table === 'public_holidays') {
      order.date = 'ASC';
    } else if (this.hasStandardSorting(table)) {
      order.sort_order = 'ASC';
    }
    return repo.find({ order });
  }

  async findOne(table: MasterTableName, id: string): Promise<any> {
    const repo = this.getRepo(table);
    const record = await repo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Record not found in ${table} with id ${id}`);
    }
    return record;
  }

  async create(table: MasterTableName, body: Record<string, any>): Promise<any> {
    const repo = this.getRepo(table);
    const entity = repo.create(body);
    try {
      return await repo.save(entity);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          `A record with that value already exists. ${error.detail ?? ''}`.trim(),
        );
      }
      throw error;
    }
  }

  async update(
    table: MasterTableName,
    id: string,
    body: Record<string, any>,
  ): Promise<any> {
    const repo = this.getRepo(table);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Record not found in ${table} with id ${id}`);
    }
    Object.assign(existing, body);
    return repo.save(existing);
  }

  async softDelete(table: MasterTableName, id: string): Promise<any> {
    if (!this.hasIsActive(table)) {
      throw new BadRequestException(`Soft delete not supported for ${table}`);
    }
    const repo = this.getRepo(table);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Record not found in ${table} with id ${id}`);
    }
    existing.is_active = false;
    await repo.save(existing);
    return { id: existing.id, is_active: false };
  }
}
