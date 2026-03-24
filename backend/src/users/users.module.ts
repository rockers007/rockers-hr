import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersAdminController } from './users-admin.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, LeaveBalance, MasterLeaveType, MasterSlaConfig]),
  ],
  controllers: [UsersController, UsersAdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
