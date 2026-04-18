import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PAYROLL_PERMISSION_KEY } from './require-payroll-permission.decorator';
import { PayrollPermission, roleHasPermission } from './payroll-permissions';

/**
 * Payroll permission guard per PAYROLL_RBAC.md §4.1.
 * - Reads required permission from @RequirePayrollPermission metadata.
 * - Maps JWT payload's `role` (system_key) to permission set.
 * - Super admin bypass via the ROLE_PERMISSIONS map.
 * - Permissions with `_own` suffix are still server-enforced in individual
 *   handlers (URL/body user_id must equal JWT sub) — this guard checks presence only.
 */
@Injectable()
export class PayrollPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PayrollPermission>(
      PAYROLL_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { sub?: string; role?: string } | undefined;
    if (!user?.role) {
      throw new ForbiddenException('Authenticated user has no role');
    }

    if (!roleHasPermission(user.role, required)) {
      throw new ForbiddenException(
        `Missing payroll permission: ${required}`,
      );
    }
    return true;
  }
}
