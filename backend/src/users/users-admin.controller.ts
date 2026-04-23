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
import { InviteAuthService } from '../auth/invite-auth.service';
import { InviteUserDto } from '../auth/auth.dto';

@Controller('admin')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class UsersAdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly inviteAuth: InviteAuthService,
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepo: Repository<PayrollRun>,
  ) {}

  /**
   * POST /api/v1/admin/users/invite  (v2.0 admin-invite flow)
   * Creates the employee record with first_login_required=true and dispatches
   * the user.invited welcome email.
   */
  @Post('users/invite')
  @AdminPermissions('employees.add_direct')
  async inviteUser(@Body() dto: InviteUserDto) {
    const result = await this.inviteAuth.inviteUser(dto);
    return { data: result };
  }

  /**
   * POST /api/v1/admin/users/:id/resend-invite
   * Regenerates the random password, refreshes the 7-day token, re-sends
   * the user.invited email. 409 if the user is already active.
   */
  @Post('users/:id/resend-invite')
  @AdminPermissions('employees.add_direct')
  async resendInvite(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.inviteAuth.resendInvite(id);
    return { data: result };
  }

  /**
   * POST /api/v1/admin/users/:id/reset-password
   * HR-initiated password reset for an already-active employee. Generates a
   * fresh random password, stores its bcrypt hash, forces first_login_required
   * so the employee is bounced into the password-change flow on next login,
   * and emails them the temp credentials using the user.password_reset
   * template. Unlike resend-invite, this works on ACTIVE users.
   */
  @Post('users/:id/reset-password')
  @AdminPermissions('employees.add_direct')
  async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.inviteAuth.sendPasswordReset(id);
    return { data: result };
  }

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
      // Bank details — admin may set directly (onboarding / corrections).
      // Employees use the self-service bank-change workflow for subsequent
      // updates so there's an approval trail.
      'bank_name', 'bank_account_no', 'bank_ifsc',
      // Extended profile (editable by admin AND employee)
      'marital_status_id', 'current_address', 'permanent_address',
      'emergency_phone', 'pf_uan_no', 'esic_no',
      // Uploaded assets — admin may set/clear on behalf of employee
      'photo_s3_key', 'resume_s3_key',
    ];
    const payrollFields = ['gross', 'incentive', 'pf_applicable'];

    // Bank-field format validation (skip for empty-string / null clears)
    const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (updates.bank_ifsc && !IFSC_REGEX.test(updates.bank_ifsc)) {
      throw new ConflictException({
        code: 'PR_BANK_INVALID_IFSC',
        message: 'IFSC must match the format ABCD0123456 (e.g. HDFC0001234).',
      });
    }
    if (
      updates.bank_account_no &&
      !/^\d{9,18}$/.test(String(updates.bank_account_no))
    ) {
      throw new ConflictException({
        code: 'PR_BANK_INVALID_ACCOUNT',
        message: 'Bank account number must be 9–18 digits (numbers only).',
      });
    }

    const filtered: Record<string, any> = {};
    let touchingPayroll = false;
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filtered[key] = updates[key] === '' ? null : updates[key];
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
