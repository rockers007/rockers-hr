import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SlaService } from './sla.service';
import { Notification } from './entities/notification.entity';
import { MasterNotificationTemplate } from '../master/entities/master-notification-template.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';
import { MasterPublicHoliday } from '../master/entities/master-public-holiday.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { LeaveApproval } from '../leave/entities/leave-approval.entity';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      MasterNotificationTemplate,
      MasterSlaConfig,
      MasterPublicHoliday,
      MasterLeaveType,
      LeaveApproval,
      LeaveRequest,
      LeaveBalance,
      User,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, SlaService],
  exports: [NotificationsService, SlaService],
})
export class NotificationsModule {}
