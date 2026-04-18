import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.dto';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';
import { BankFileService } from './bank-file.service';

@Controller('payroll/runs/:runId/bank-file')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class BankFileController {
  constructor(private readonly svc: BankFileService) {}

  @Get('preview')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_FILE_PREVIEW)
  async preview(@Param('runId') runId: string) {
    return { success: true, data: await this.svc.preview(runId) };
  }

  @Post('approve')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_FILE_APPROVE)
  async approve(
    @Param('runId') runId: string,
    @Body()
    body: {
      confirmation_phrase: string;
      file_format_code: string;
      pending_bank_changes_action:
        | 'use_old'
        | 'exclude_employee'
        | 'hold_separate';
    },
    @CurrentUser() user: JwtPayload,
  ) {
    const run = await this.svc.approve(
      runId,
      body.confirmation_phrase,
      body.file_format_code,
      body.pending_bank_changes_action,
      user.sub,
    );
    return { success: true, data: run };
  }

  @Post('generate')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_FILE_GENERATE)
  async generate(
    @Param('runId') runId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      success: true,
      data: await this.svc.generate(runId, user.sub),
    };
  }
}
