import {
  Body,
  Controller,
  Delete,
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
import { InvestmentProofsService } from './investment-proofs.service';

@Controller('api/v1/payroll/investment-proofs')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class InvestmentProofsController {
  constructor(private readonly svc: InvestmentProofsService) {}

  // §7.1 Employee upload (expects pre-uploaded s3_key via /uploads/presigned)
  @Post()
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.INVESTMENT_UPLOAD)
  async upload(
    @Body()
    body: {
      financial_year: string;
      category: string;
      description?: string;
      amount?: number;
      s3_key: string;
      file_size_bytes?: number;
      mime_type?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.upload(user.sub, body);
    return { success: true, data };
  }

  // §7.2 Employee list own
  @Get('mine')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.INVESTMENT_VIEW_OWN)
  async listMine(
    @Query('fy') fy: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return { success: true, data: await this.svc.listMine(user.sub, fy) };
  }

  // §7.3 Employee delete own
  @Delete(':id')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.INVESTMENT_DELETE_OWN)
  async deleteOwn(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.svc.deleteOwn(id, user.sub);
    return { success: true };
  }

  // §7.4 Admin list any user
  @Get()
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.INVESTMENT_VIEW_ANY)
  async listAny(
    @Query('userId') userId: string,
    @Query('fy') fy: string,
  ) {
    return { success: true, data: await this.svc.listByUser(userId, fy) };
  }
}
