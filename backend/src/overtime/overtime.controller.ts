import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OvertimeService } from './overtime.service';
import { CreateOvertimeDto, ReviewOvertimeDto, UpdatePaymentDto } from './dto/overtime.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// ── Employee endpoints ──

@Controller('overtime')
@UseGuards(JwtAuthGuard)
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  /** Employee applies for overtime */
  @Post()
  async apply(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateOvertimeDto,
  ) {
    const data = await this.overtimeService.create(userId, dto);
    return { data };
  }

  /** Employee views own overtime requests */
  @Get('my')
  async myOvertime(
    @CurrentUser('sub') userId: string,
    @Query('year') year?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.overtimeService.findByUser(userId, {
      year: year ? parseInt(year) : undefined,
      status,
    });
    return { data };
  }

  /** Employee views own overtime summary */
  @Get('my/summary')
  async mySummary(
    @CurrentUser('sub') userId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.overtimeService.getSummary(userId, y);
    return { data };
  }

  /** Employee cancels own pending overtime */
  @Delete(':id')
  async cancel(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.overtimeService.cancel(userId, id);
    return { data: { message: 'Overtime request cancelled' } };
  }
}

// ── Admin endpoints ──

@Controller('admin/overtime')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OvertimeAdminController {
  constructor(private readonly overtimeService: OvertimeService) {}

  /** Admin: list all overtime requests with filters */
  @Get()
  async list(
    @Query('status') status?: string,
    @Query('payment_status') paymentStatus?: string,
    @Query('user_id') userId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const data = await this.overtimeService.findAll({
      status,
      payment_status: paymentStatus,
      user_id: userId,
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
    });
    return { data };
  }

  /** Admin: pending overtime requests */
  @Get('pending')
  async pending() {
    const data = await this.overtimeService.findPending();
    return { data };
  }

  /** Admin: approve or decline overtime */
  @Patch(':id/review')
  async review(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewOvertimeDto,
  ) {
    const data = await this.overtimeService.review(id, adminId, dto);
    return { data };
  }

  /** Admin: update payment status */
  @Patch(':id/payment')
  async updatePayment(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    const data = await this.overtimeService.updatePayment(id, adminId, dto);
    return { data };
  }

  /** Admin: employee summary */
  @Get('summary/:userId')
  async employeeSummary(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('year') year?: string,
  ) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.overtimeService.getSummary(userId, y);
    return { data };
  }
}
