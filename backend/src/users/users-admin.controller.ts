import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { ActivateUserDto } from './dto/activate-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { PayrollRun } from '../payroll/entities/payroll-run.entity';

@Controller('admin')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class UsersAdminController {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepo: Repository<PayrollRun>,
  ) {}

  /**
   * Block salary edits while an active payroll run exists for the current month.
   * Mirrors the guard in SalaryService.patchSalary so both edit surfaces behave
   * identically.
   */
  private async assertPayrollNotInFlight(): Promise<void> {
    const now = new Date();
    const blocking = await this.payrollRunRepo
      .createQueryBuilder('r')
      .where('r.month = :m AND r.year = :y', {
        m: now.getMonth() + 1,
        y: now.getFullYear(),
      })
      .andWhere(`r.state IN ('IN_PROGRESS','REVIEW')`)
      .getOne();
    if (blocking) {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Cannot edit salary while current-month payroll run is ${blocking.state}`,
      });
    }
  }

  @Get('registrations/pending')
  @AdminPermissions('employees.activate')
  async getPendingRegistrations() {
    const data = await this.usersService.getPendingRegistrations();
    return { data };
  }

  @Post('registrations/:id/activate')
  @AdminPermissions('employees.activate')
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivateUserDto,
  ) {
    const data = await this.usersService.activateUser(id, dto);
    return { data };
  }

  @Post('registrations/:id/reject')
  @AdminPermissions('employees.activate')
  async rejectUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    const data = await this.usersService.rejectUser(id);
    return { data: { id: data.id, status: 'rejected' } };
  }

  @Get('users')
  @AdminPermissions('employees.view')
  async listUsers(@Query() query: QueryUsersDto) {
    return this.usersService.listUsers(query);
  }

  @Get('users/managers')
  @AdminPermissions('employees.view')
  async getManagers() {
    const managers = await this.usersService.getManagers();
    const data = managers.map((m) => ({
      id: m.id,
      name: m.name,
      department: m.department?.label || null,
    }));
    return { data };
  }

  @Get('users/:id')
  @AdminPermissions('employees.view')
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.usersService.getProfile(id);
    return { data };
  }

  @Post('users')
  @AdminPermissions('employees.add_direct')
  async adminCreateUser(@Body() dto: AdminCreateUserDto) {
    const data = await this.usersService.adminCreateUser(dto);
    return { data };
  }

  @Patch('users/:id')
  @AdminPermissions('employees.edit_profile')
  async adminUpdateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updates: Record<string, any>,
  ) {
    const allowedFields = [
      'name', 'phone', 'department_id', 'manager_id',
      'is_manager', 'qualification_id', 'gender_id',
      'join_date', 'confirmation_date',
      'resignation_date', 'last_working_day', 'employment_status',
      // Payroll fields
      'emp_number', 'designation', 'gross', 'incentive', 'pf_applicable', 'dob',
    ];
    const payrollFields = ['gross', 'incentive', 'pf_applicable'];
    const filtered: Record<string, any> = {};
    let touchingPayroll = false;
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filtered[key] = updates[key];
        if (payrollFields.includes(key)) touchingPayroll = true;
      }
    }
    if (touchingPayroll) {
      await this.assertPayrollNotInFlight();
    }
    const data = await this.usersService.adminUpdateUser(id, filtered);
    return { data };
  }
}
