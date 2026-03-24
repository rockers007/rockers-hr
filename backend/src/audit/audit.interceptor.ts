import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AUDIT_LOG_KEY, AuditLogOptions } from './audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<AuditLogOptions>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    // Skip if no @AuditLog decorator
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit write operations
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const beforeState = request.body?._auditBeforeState;

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const actorId = request.user?.id;
          if (!actorId) return;

          const entityId =
            request.params?.id ??
            responseData?.data?.id ??
            null;

          await this.auditService.log({
            actor_id: actorId,
            action: options.action,
            method: options.method,
            entity_type: options.entityType,
            entity_id: entityId,
            on_behalf_of: request.body?.on_behalf_of,
            before_state: beforeState ?? null,
            after_state: responseData?.data ?? request.body ?? null,
            ip_address: request.ip || request.connection?.remoteAddress,
          });
        } catch {
          // Audit logging should never break the request
        }
      }),
    );
  }
}
