import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';

/**
 * Thin wrapper around AuditService for payroll event naming (PAYROLL_RBAC.md §5).
 * Uses the existing leave-module audit log — single source of truth.
 */
@Injectable()
export class PayrollAuditService {
  constructor(private readonly audit: AuditService) {}

  async log(params: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    onBehalfOf?: string;
    before?: Record<string, any> | object | null;
    after?: Record<string, any> | object | null;
    ipAddress?: string;
  }): Promise<void> {
    await this.audit.log({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      on_behalf_of: params.onBehalfOf,
      before_state: (params.before as Record<string, any>) ?? null,
      after_state: (params.after as Record<string, any>) ?? null,
      ip_address: params.ipAddress,
    });
  }
}
