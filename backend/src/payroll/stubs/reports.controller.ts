import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';

/**
 * Payroll reports (Group G §8).
 * Routes + RBAC wired here; aggregation logic + CSV/PDF export land in Phase G.
 */
@Controller('api/v1/payroll/reports')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class ReportsController {
  @Get('salary-register')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.REPORT_SALARY_REGISTER)
  async salaryRegister(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('format') format?: string,
  ) {
    return this.pending({ report: 'salary-register', year, month, format });
  }

  @Get('department-cost')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.REPORT_DEPARTMENT_COST)
  async departmentCost(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.pending({ report: 'department-cost', year, month });
  }

  @Get('payroll-summary')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.REPORT_PAYROLL_SUMMARY)
  async payrollSummary(
    @Query('year') year: string,
    @Query('period') period: string,
  ) {
    return this.pending({ report: 'payroll-summary', year, period });
  }

  @Get('compliance')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.REPORT_COMPLIANCE)
  async compliance(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.pending({ report: 'compliance', year, month });
  }

  private pending(meta: Record<string, unknown>) {
    return {
      success: false,
      error: {
        code: 'PR_PHASE_G_PENDING',
        message: 'Reports aggregation + CSV/PDF export ships in Phase G.',
        meta,
      },
    };
  }
}
