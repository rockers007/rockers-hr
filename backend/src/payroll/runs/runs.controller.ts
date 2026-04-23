import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.dto';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';
import { RunsService } from './runs.service';
import { PayrollRunState } from '../entities/payroll-run.entity';
import { PayslipDeliveryService } from '../payslip/payslip-delivery.service';

@Controller('payroll/runs')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class RunsController {
  constructor(
    private readonly runs: RunsService,
    private readonly delivery: PayslipDeliveryService,
  ) {}

  // §4.1 List runs
  @Get()
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_VIEW)
  async list(
    @Query('year') year?: string,
    @Query('state') state?: PayrollRunState,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.runs.list({
      year: year ? Number(year) : undefined,
      state,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return { success: true, data };
  }

  // §4.2 Step 1 — Create run
  @Post()
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_CREATE)
  async create(
    @Body() body: { month: number; year: number },
    @CurrentUser() user: JwtPayload,
  ) {
    const run = await this.runs.create(body.month, body.year, user.sub);
    return { success: true, data: run };
  }

  // §4.3 Step 2 — Import
  @Post(':runId/import')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_IMPORT)
  async import(
    @Param('runId') runId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const run = await this.runs.importRun(runId, user.sub);
    return { success: true, data: run };
  }

  // §4.4 Step 3 — Calculate
  @Post(':runId/calculate')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_CALCULATE)
  async calculate(
    @Param('runId') runId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const run = await this.runs.calculate(runId, user.sub);
    return { success: true, data: run };
  }

  // §4.5 Get run detail
  @Get(':runId')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_VIEW)
  async get(@Param('runId') runId: string) {
    const run = await this.runs.getRun(runId);
    return { success: true, data: run };
  }

  // §4.6 Get items
  @Get(':runId/items')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_VIEW)
  async items(
    @Param('runId') runId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.runs.listItems(runId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
    });
    return { success: true, data };
  }

  // §4.7 Step 2b — Override snapshot
  @Patch(':runId/employees/:userId')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_EDIT_ITEMS)
  async overrideSnapshot(
    @Param('runId') runId: string,
    @Param('userId') userId: string,
    @Body()
    body: Partial<{
      lwp_days: number;
      ot_hours: number;
      cl_days: number;
      sl_days: number;
      pl_days: number;
      wfh_days: number;
      comp_off_days: number;
    }>,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.runs.overrideSnapshot(runId, userId, body, user.sub);
    return { success: true };
  }

  // §4.8 Step 4 — Edit item
  @Patch(':runId/items/:userId')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_EDIT_ITEMS)
  async editItem(
    @Param('runId') runId: string,
    @Param('userId') userId: string,
    @Body()
    body: Partial<{
      incentive: number;
      tds: number;
      loan_emi: number;
      sal_deduction: number;
      security_return: number;
    }>,
    @CurrentUser() user: JwtPayload,
  ) {
    const item = await this.runs.editItem(runId, userId, body, user.sub);
    return { success: true, data: item };
  }

  // §4.9 Step 5a — Lock
  @Post(':runId/lock')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_LOCK)
  async lock(
    @Param('runId') runId: string,
    @Body() body: { confirmation_phrase: string },
    @CurrentUser() user: JwtPayload,
  ) {
    const run = await this.runs.lock(runId, body.confirmation_phrase, user.sub);
    return { success: true, data: run };
  }

  // §4.10 Step 5b — Release + trigger PDF/SMTP delivery pipeline
  @Post(':runId/release')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_RELEASE)
  async release(
    @Param('runId') runId: string,
    @Body() body: { release_date: string },
    @CurrentUser() user: JwtPayload,
  ) {
    const run = await this.runs.release(
      runId,
      body.release_date,
      user.sub,
      (rid, aid) => this.delivery.deliverRun(rid, aid),
    );
    return { success: true, data: run };
  }

  // §4.12 Cancel
  @Post(':runId/cancel')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_CANCEL)
  async cancel(
    @Param('runId') runId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const run = await this.runs.cancel(runId, user.sub);
    return { success: true, data: run };
  }

  // §4.11 Release progress — aggregated payslip_deliveries status
  @Get(':runId/release-progress')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.RUN_VIEW)
  async releaseProgress(@Param('runId') runId: string) {
    return { success: true, data: await this.delivery.releaseProgress(runId) };
  }
}
