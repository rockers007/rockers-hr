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
          // request.user is the JWT payload (see JwtStrategy.validate).
          // Payload carries the user id under `sub`, admins include
          // admin_role_id. Fall back to `id` for any callers that populate
          // request.user directly.
          const actorId =
            request.user?.sub ?? request.user?.id ?? null;
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
            // Redact sensitive fields from after_state and body so we don't
            // persist passwords / tokens / bank secrets in the audit log.
            after_state: redactSensitive(
              responseData?.data ?? request.body ?? null,
            ),
            ip_address: request.ip || request.connection?.remoteAddress,
          });
        } catch {
          // Audit logging should never break the request
        }
      }),
    );
  }
}

/**
 * Recursively scrub sensitive keys from an object before it lands in the
 * audit log. We keep the shape so diffs remain useful, but replace
 * secret-like values with the literal string "[REDACTED]".
 *
 * Two flavours of redaction:
 *   FULL_REDACT  — credentials / tokens. Replaced with "[REDACTED]".
 *   PARTIAL_MASK — PII (bank, PAN, Aadhaar). The audit log is admin-
 *                  readable so a leaked log shouldn't expose full
 *                  account numbers; we keep just enough of the value
 *                  for an admin to recognise which row was touched
 *                  (last 4 chars of the account, masked otherwise).
 */
const FULL_REDACT_KEYS = new Set([
  'password',
  'new_password',
  'confirm_password',
  'current_password',
  'password_hash',
  'token',
  'invite_token',
  'fcm_token',
  'google_access_token',
  'google_refresh_token',
  'secret',
]);

const PARTIAL_MASK_KEYS = new Set([
  'bank_account_no',
  'bank_ifsc',
  'pan',
  'pan_no',
  'aadhaar',
  'aadhaar_no',
  'pf_uan_no',
  'esic_no',
]);

function maskTail(value: unknown): string {
  if (typeof value !== 'string' || value.length <= 4) return '****';
  return '*'.repeat(Math.max(0, value.length - 4)) + value.slice(-4);
}

export function redactSensitive(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (typeof value !== 'object') return value;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (FULL_REDACT_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else if (PARTIAL_MASK_KEYS.has(k)) {
      out[k] = v === null || v === undefined ? v : maskTail(v);
    } else {
      out[k] = redactSensitive(v);
    }
  }
  return out;
}
