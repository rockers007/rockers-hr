import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface CreateAuditLogParams {
  actor_id: string;
  action: string;
  method?: string;
  entity_type: string;
  entity_id?: string;
  on_behalf_of?: string;
  before_state?: Record<string, any> | null;
  after_state?: Record<string, any> | null;
  ip_address?: string;
}

export interface AuditLogQueryParams {
  actor_id?: string;
  entity_type?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(params: CreateAuditLogParams): Promise<AuditLog> {
    const entry = this.auditLogRepo.create(params);
    return this.auditLogRepo.save(entry);
  }

  async findAll(query: AuditLogQueryParams): Promise<{
    data: AuditLog[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<AuditLog> = {};

    if (query.actor_id) {
      where.actor_id = query.actor_id;
    }
    if (query.entity_type) {
      where.entity_type = query.entity_type;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.from && query.to) {
      where.created_at = Between(new Date(query.from), new Date(query.to));
    }

    const [data, total] = await this.auditLogRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: { total, page, limit },
    };
  }
}
