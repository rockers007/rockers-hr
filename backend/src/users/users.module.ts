import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersAdminController } from './users-admin.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';
import { PayrollRun } from '../payroll/entities/payroll-run.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      LeaveBalance,
      MasterLeaveType,
      MasterSlaConfig,
      PayrollRun,
    ]),
    // For InviteAuthService used by POST /admin/users/invite + resend-invite
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController, UsersAdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
