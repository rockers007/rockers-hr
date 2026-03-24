import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

// TODO: Add @UseGuards(AdminJwtGuard, PermissionsGuard) and @RequirePermissions('system.view_audit_log')
// once the auth module is available
@Controller('admin/audit-log')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLog(@Query() query: QueryAuditLogDto) {
    const result = await this.auditService.findAll({
      actor_id: query.actor_id,
      entity_type: query.entity_type,
      action: query.action,
      from: query.from,
      to: query.to,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
    return result;
  }
}
