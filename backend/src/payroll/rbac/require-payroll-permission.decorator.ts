import { SetMetadata } from '@nestjs/common';
import { PayrollPermission } from './payroll-permissions';

export const PAYROLL_PERMISSION_KEY = 'payroll_permission';

export const RequirePayrollPermission = (permission: PayrollPermission) =>
  SetMetadata(PAYROLL_PERMISSION_KEY, permission);
