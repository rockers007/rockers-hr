import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.dto';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';
import { SalaryService } from '../salary/salary.service';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayslipDelivery } from '../entities/payslip-delivery.entity';

@Controller('api/v1/payroll/me')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class MeController {
  constructor(
    private readonly salary: SalaryService,
    private readonly dataSource: DataSource,
    @InjectRepository(PayrollItem)
    private readonly itemRepo: Repository<PayrollItem>,
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
    @InjectRepository(PayslipDelivery)
    private readonly payslipRepo: Repository<PayslipDelivery>,
  ) {}

  // §10.1 Own salary
  @Get('salary')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.ME_SALARY_VIEW)
  async salaryOwn(@CurrentUser() user: JwtPayload) {
    const data = await this.salary.getSalary(user.sub, true);
    return { success: true, data };
  }

  // §10.1b Salary preview (v2.3 F3)
  @Get('salary-preview')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.ME_SALARY_VIEW)
  async salaryPreview(@CurrentUser() user: JwtPayload) {
    const sal = await this.salary.getSalary(user.sub, true);
    const now = new Date();
    return {
      success: true,
      data: {
        preview_month: [
          'January','February','March','April','May','June',
          'July','August','September','October','November','December',
        ][now.getMonth()],
        preview_year: now.getFullYear(),
        note:
          'Estimate only — actual payslip may differ based on LWP, OT, and admin adjustments.',
        ...(sal as Record<string, unknown>).computed_preview as Record<string, unknown>,
      },
    };
  }

  // §10.2 Payslip list
  @Get('payslips')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.ME_PAYSLIPS_LIST)
  async payslipList(
    @CurrentUser() user: JwtPayload,
    @Query('year') year?: string,
  ) {
    const qb = this.itemRepo
      .createQueryBuilder('pi')
      .innerJoin(PayrollRun, 'r', 'r.id = pi.run_id')
      .where('pi.user_id = :uid', { uid: user.sub })
      .andWhere('pi.is_current = TRUE')
      .andWhere(`r.state IN ('RELEASED','BANK_FILE_APPROVED','BANK_FILE_GENERATED')`)
      .addSelect(['r.month AS month', 'r.year AS year', 'r.release_date AS release_date', 'r.state AS state'])
      .orderBy('r.year', 'DESC')
      .addOrderBy('r.month', 'DESC');
    if (year) qb.andWhere('r.year = :y', { y: Number(year) });

    const raw = await qb.getRawAndEntities();
    const rows = raw.entities.map((e, i) => ({
      run_id: e.run_id,
      month: Number(raw.raw[i].month),
      year: Number(raw.raw[i].year),
      release_date: raw.raw[i].release_date,
      net_payable: e.net_payable,
      total_earnings: e.total_earnings,
      total_deductions: e.total_deductions,
    }));
    return { success: true, data: rows };
  }

  // §10.3 Payslip download — Phase F completes the signed-URL flow
  @Get('payslips/:year/:month/download')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.ME_PAYSLIPS_DOWNLOAD)
  async payslipDownload(@CurrentUser() user: JwtPayload) {
    const delivery = await this.payslipRepo
      .createQueryBuilder('d')
      .where('d.user_id = :uid', { uid: user.sub })
      .andWhere('d.status IN (:...st)', {
        st: ['GENERATED', 'EMAILED'],
      })
      .orderBy('d.created_at', 'DESC')
      .getOne();

    if (!delivery) {
      return {
        success: false,
        error: {
          code: 'PR_PAYSLIP_NOT_READY',
          message: 'Payslip is not yet generated (Phase F feature).',
        },
      };
    }
    return {
      success: true,
      data: {
        signed_url: delivery.s3_url_signed,
        password_hint: delivery.pdf_password_hint,
      },
    };
  }

  // §10.4 YTD
  @Get('ytd')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.ME_YTD_VIEW)
  async ytd(
    @CurrentUser() user: JwtPayload,
    @Query('fy') fy?: string,
  ) {
    const filter = fy
      ? `AND financial_year = $2`
      : '';
    const params = fy ? [user.sub, fy] : [user.sub];
    const rows = await this.dataSource.query(
      `SELECT * FROM v_employee_ytd WHERE user_id = $1 ${filter}
       ORDER BY financial_year DESC`,
      params,
    );
    return { success: true, data: rows };
  }

  // §10.5 OT tracker — pulls from overtime_requests
  @Get('ot-tracker')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.ME_OT_TRACKER_VIEW)
  async otTracker(
    @CurrentUser() user: JwtPayload,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) {
      return {
        success: false,
        error: { code: 'PR_INVALID_PARAMS', message: 'year and month required' },
      };
    }
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;

    let rows: Array<{ status: string; total_hours: string; count: string }> = [];
    try {
      rows = await this.dataSource.query(
        `SELECT status, COALESCE(SUM(hours), 0) AS total_hours, COUNT(*) AS count
         FROM overtime_requests
         WHERE user_id = $1 AND date BETWEEN $2 AND $3
         GROUP BY status`,
        [user.sub, monthStart, monthEnd],
      );
    } catch {
      // overtime table absent
    }

    return {
      success: true,
      data: {
        year: y,
        month: m,
        by_status: rows,
      },
    };
  }
}
