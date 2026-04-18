import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.dto';
import { PayrollPermissionGuard } from '../rbac/payroll-permission.guard';
import { RequirePayrollPermission } from '../rbac/require-payroll-permission.decorator';
import { PAYROLL_PERMISSIONS } from '../rbac/payroll-permissions';
import { SalaryService, SalaryPatch } from './salary.service';

@Controller('payroll/employees')
@UseGuards(JwtAuthGuard, PayrollPermissionGuard)
export class SalaryController {
  constructor(private readonly salary: SalaryService) {}

  // §2.1
  @Get(':userId/salary')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.SALARY_VIEW)
  async getSalary(@Param('userId') userId: string) {
    const data = await this.salary.getSalary(userId, true);
    return { success: true, data };
  }

  // §2.2
  @Patch(':userId/salary')
  @RequirePayrollPermission(PAYROLL_PERMISSIONS.SALARY_EDIT)
  async patchSalary(
    @Param('userId') userId: string,
    @Body() body: SalaryPatch,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.salary.patchSalary(userId, body, user.sub);
    const data = await this.salary.getSalary(userId, true);
    return { success: true, data };
  }
}
