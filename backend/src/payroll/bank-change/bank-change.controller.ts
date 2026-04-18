import {
  Body,
  Controller,
  Get,
  Param,
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
import { BankChangeService } from './bank-change.service';
import { BankChangeStatus } from '../entities/bank-change-request.entity';

@Controller('api/v1/payroll/bank-change')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class BankChangeController {
  constructor(private readonly svc: BankChangeService) {}

  // §6.1 Employee submit
  @Post()
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_CHANGE_SUBMIT)
  async submit(
    @Body()
    body: {
      new_bank_name: string;
      new_account_no: string;
      new_ifsc: string;
      proof_s3_key?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.submit(user.sub, body);
    return { success: true, data };
  }

  // §6.2 Employee list own
  @Get('mine')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_CHANGE_SUBMIT)
  async listMine(@CurrentUser() user: JwtPayload) {
    return { success: true, data: await this.svc.listMine(user.sub) };
  }

  // §6.3 Admin list all
  @Get()
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_CHANGE_VIEW_ANY)
  async listAll(@Query('status') status?: BankChangeStatus) {
    return { success: true, data: await this.svc.listAll(status) };
  }

  // §6.4 Admin approve
  @Post(':id/approve')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_CHANGE_APPROVE)
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      success: true,
      data: await this.svc.approve(id, user.sub),
    };
  }

  // §6.5 Admin reject
  @Post(':id/reject')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.BANK_CHANGE_REJECT)
  async reject(
    @Param('id') id: string,
    @Body() body: { rejection_reason: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      success: true,
      data: await this.svc.reject(id, body.rejection_reason, user.sub),
    };
  }
}
