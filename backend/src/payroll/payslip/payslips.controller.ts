import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.dto';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';
import { PayslipDeliveryService } from './payslip-delivery.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { User } from '../../users/entities/user.entity';
import { NotFoundException } from '@nestjs/common';

@Controller('api/v1/payroll/payslips')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class PayslipsController {
  constructor(
    private readonly delivery: PayslipDeliveryService,
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Admin: signed download URL for a specific employee's released payslip.
   */
  @Get(':userId/:year/:month')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.PAYSLIP_VIEW_ANY)
  async getAny(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    const run = await this.findRun(Number(year), Number(month));
    const data = await this.delivery.getSignedDownloadUrl(run.id, userId);
    if (!data) {
      return {
        success: false,
        error: {
          code: 'PR_PAYSLIP_NOT_READY',
          message: 'Payslip not generated yet for this employee.',
        },
      };
    }
    return { success: true, data };
  }

  /**
   * Admin: stream a watermarked preview PDF (no password, no S3).
   */
  @Get(':userId/:year/:month/preview')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.PAYSLIP_PREVIEW)
  async preview(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @Res() res: Response,
  ) {
    const run = await this.findRun(Number(year), Number(month));
    const pdf = await this.delivery.previewPdf(run.id, userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="payslip_preview_${userId}_${year}_${month}.pdf"`,
    );
    res.send(pdf);
  }

  /**
   * Admin: retry delivery for a single employee.
   */
  @Post(':userId/:year/:month/retry-email')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.PAYSLIP_RETRY_EMAIL)
  async retry(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const run = await this.findRun(Number(year), Number(month));
    const data = await this.delivery.retry(run.id, userId, user.sub);
    return { success: true, data };
  }

  private async findRun(year: number, month: number): Promise<PayrollRun> {
    const run = await this.runRepo
      .createQueryBuilder('r')
      .where('r.year = :y AND r.month = :m', { y: year, m: month })
      .andWhere(`r.state IN ('RELEASED','BANK_FILE_APPROVED','BANK_FILE_GENERATED')`)
      .getOne();
    if (!run) throw new NotFoundException('No released run for that month');
    return run;
  }
}
