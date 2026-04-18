import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.dto';
import { LeaveService } from './leave.service';
import { DeclineDto } from './dto';

@Controller('manager/approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'employee')
export class ManagerApprovalController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('pending')
  async getPending(@CurrentUser() user: JwtPayload) {
    const data = await this.leaveService.getPendingManagerApprovals(user.sub);
    return { data };
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.leaveService.approveL1(id, user.sub);
    return { data: { status: 'approved' } };
  }

  @Post(':id/decline')
  async decline(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeclineDto,
  ) {
    await this.leaveService.declineL1(id, user.sub, dto.reason || '');
    return { data: { status: 'declined' } };
  }
}
