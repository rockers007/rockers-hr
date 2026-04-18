import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';
import { ReportsService, SalaryRegisterRow } from './reports.service';

@Controller('payroll/reports')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('salary-register')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.REPORT_SALARY_REGISTER)
  async salaryRegister(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.reports.salaryRegister(Number(year), Number(month));
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="salary_register_${year}_${month}.csv"`,
      );
      const headers = Object.keys(data.rows[0] ?? data.totals) as Array<keyof SalaryRegisterRow>;
      const csv = await this.reports.renderCsv(
        headers as string[],
        [...data.rows, data.totals] as unknown as Record<string, unknown>[],
      );
      res.send(csv);
      return;
    }
    return { success: true, data };
  }

  @Get('department-cost')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.REPORT_DEPARTMENT_COST)
  async departmentCost(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('department_id') departmentId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const rows = await this.reports.departmentCost(
      Number(year),
      Number(month),
      departmentId,
    );
    if (format === 'csv' && res) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="department_cost_${year}_${month}.csv"`,
      );
      const headers = [
        'department',
        'headcount',
        'total_gross',
        'total_ctc',
        'total_net_payable',
        'total_deductions',
      ];
      res.send(
        await this.reports.renderCsv(
          headers,
          rows as unknown as Record<string, unknown>[],
        ),
      );
      return;
    }
    return { success: true, data: { rows } };
  }

  @Get('payroll-summary')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.REPORT_PAYROLL_SUMMARY)
  async payrollSummary(
    @Query('year') year: string,
    @Query('period') period: 'monthly' | 'quarterly' | 'yearly',
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const rows = await this.reports.payrollSummary(Number(year), period ?? 'monthly');
    if (format === 'csv' && res) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="payroll_summary_${year}_${period ?? 'monthly'}.csv"`,
      );
      const headers = [
        'period',
        'runs',
        'employees',
        'total_net_payable',
        'total_employer_pf',
        'total_employee_pf',
        'total_pt',
        'total_tds',
        'total_incentive',
        'total_ot_pay',
      ];
      res.send(
        await this.reports.renderCsv(
          headers,
          rows as unknown as Record<string, unknown>[],
        ),
      );
      return;
    }
    return { success: true, data: { rows } };
  }

  @Get('compliance')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.REPORT_COMPLIANCE)
  async compliance(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.reports.compliance(Number(year), Number(month));
    if (format === 'csv' && res) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="compliance_${year}_${month}.csv"`,
      );
      const headers = [
        'total_employer_pf',
        'total_employee_pf',
        'total_employer_esic',
        'total_employee_esic',
        'total_pt',
        'total_tds',
        'employee_count',
      ];
      res.send(
        await this.reports.renderCsv(
          headers,
          [data] as unknown as Record<string, unknown>[],
        ),
      );
      return;
    }
    return { success: true, data };
  }
}
