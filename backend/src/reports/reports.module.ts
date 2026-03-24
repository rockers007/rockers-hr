import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { LeaveApproval } from '../leave/entities/leave-approval.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest, LeaveBalance, LeaveApproval, User]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
