import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';

/**
 * Bank transfer file (Group H §9).
 * Routes + RBAC wired here; preview/approve/generate logic ships in Phase G.
 */
@Controller('api/v1/payroll/runs/:runId/bank-file')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class BankFileController {
  @Get('preview')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_FILE_PREVIEW)
  async preview(@Param('runId') runId: string) {
    return this.pending('preview', { runId });
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
  ) {
    return this.pending('approve', { runId, body });
  }

  @Post('generate')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_FILE_GENERATE)
  async generate(@Param('runId') runId: string) {
    return this.pending('generate', { runId });
  }

  private pending(action: string, meta: Record<string, unknown>) {
    return {
      success: false,
      error: {
        code: 'PR_PHASE_G_PENDING',
        message: `Bank file ${action} ships in Phase G.`,
        meta,
      },
    };
  }
}
