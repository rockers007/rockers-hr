import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';

/**
 * Admin payslip endpoints (Group D §5).
 * Routes are wired here with RBAC; PDF generation logic lands in Phase F.
 */
@Controller('api/v1/payroll/payslips')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class PayslipsAdminController {
  @Get(':userId/:year/:month')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.PAYSLIP_VIEW_ANY)
  async getAny(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return {
      success: false,
      error: {
        code: 'PR_PHASE_F_PENDING',
        message: 'Signed URL endpoint completes in Phase F (PDF + S3).',
        meta: { userId, year, month },
      },
    };
  }

  @Get(':userId/:year/:month/preview')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.PAYSLIP_PREVIEW)
  async preview() {
    return {
      success: false,
      error: {
        code: 'PR_PHASE_F_PENDING',
        message: 'Payslip preview PDF generator ships in Phase F.',
      },
    };
  }

  @Post(':userId/:year/:month/retry-email')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.PAYSLIP_RETRY_EMAIL)
  async retryEmail() {
    return {
      success: false,
      error: {
        code: 'PR_PHASE_F_PENDING',
        message: 'Retry pipeline ships in Phase F (SMTP delivery).',
      },
    };
  }
}
