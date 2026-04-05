import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveController } from './leave.controller';
import { ManagerApprovalController } from './manager-approval.controller';
import { AdminApprovalController } from './admin-approval.controller';
import { LeaveService } from './leave.service';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveApproval } from './entities/leave-approval.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { MasterLeaveDuration } from '../master/entities/master-leave-duration.entity';
import { MasterPublicHoliday } from '../master/entities/master-public-holiday.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveRequest,
      LeaveApproval,
      LeaveBalance,
      MasterLeaveType,
      MasterLeaveDuration,
      MasterPublicHoliday,
      MasterSlaConfig,
      User,
    ]),
    NotificationsModule,
    CalendarModule,
  ],
  controllers: [
    LeaveController,
    ManagerApprovalController,
    AdminApprovalController,
  ],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
