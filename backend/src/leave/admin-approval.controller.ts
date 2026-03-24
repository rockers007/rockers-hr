import {
  Controller,
  Get,
  Post,
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
  AdminCreateLeaveRequestDto,
  AdminQueryLeaveRequestsDto,
  DeclineDto,
} from './dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminApprovalController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('approvals/pending')
  async getPendingApprovals() {
    const data = await this.leaveService.getPendingHrApprovals();
    return { data };
  }

  @Post('approvals/:id/approve')
  async approveL2(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.leaveService.approveL2(id, user.sub);
    return { data: { status: 'approved' } };
  }

  @Post('approvals/:id/decline')
  async declineL2(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeclineDto,
  ) {
    await this.leaveService.declineL2(id, user.sub, dto.reason || '');
    return { data: { status: 'declined' } };
  }

  @Get('leave/requests')
  async getAllRequests(@Query() query: AdminQueryLeaveRequestsDto) {
    return this.leaveService.getAllRequests(query);
  }

  @Post('leave/requests')
  async submitOnBehalf(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: AdminCreateLeaveRequestDto,
  ) {
    const data = await this.leaveService.submitRequest(
      dto.user_id,
      dto,
      admin.sub,
      dto.admin_notes,
    );
    return { data };
  }
}
