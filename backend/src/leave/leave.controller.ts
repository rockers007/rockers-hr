import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.dto';
import { LeaveService } from './leave.service';
import {
  CalculateLeaveDto,
  CreateLeaveRequestDto,
  QueryLeaveRequestsDto,
} from './dto';

@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('types/eligible')
  async getEligibleTypes(@CurrentUser() user: JwtPayload) {
    const data = await this.leaveService.getEligibleLeaveTypes(user.sub);
    return { data };
  }

  @Post('calculate')
  async calculate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CalculateLeaveDto,
  ) {
    const data = await this.leaveService.calculate(user.sub, dto);
    return { data };
  }

  @Post('requests')
  async submitRequest(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    const data = await this.leaveService.submitRequest(user.sub, dto);
    return { data };
  }

  @Get('requests')
  async listRequests(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryLeaveRequestsDto,
  ) {
    return this.leaveService.getUserRequests(user.sub, query);
  }

  @Get('balance')
  async getBalance(@CurrentUser() user: JwtPayload) {
    const data = await this.leaveService.getBalances(user.sub);
    return { data };
  }

  @Get('balance/:year')
  async getBalanceByYear(
    @CurrentUser() user: JwtPayload,
    @Param('year') year: string,
  ) {
    const data = await this.leaveService.getBalances(
      user.sub,
      parseInt(year, 10),
    );
    return { data };
  }

  @Get('requests/:id')
  async getRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.leaveService.getRequestById(id, user.sub);
    return { data };
  }

  @Patch('requests/:id/cancel')
  async cancelRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.leaveService.cancelRequest(id, user.sub);
    return { data };
  }
}
