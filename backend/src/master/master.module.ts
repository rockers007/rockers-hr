import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import {
  MasterQualification,
  MasterGender,
  MasterRoleType,
  MasterLeaveType,
  MasterLeaveDuration,
  MasterDepartment,
  MasterFileType,
  MasterNotificationTemplate,
  MasterSlaConfig,
  MasterPublicHoliday,
  MasterAdminRole,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MasterQualification,
      MasterGender,
      MasterRoleType,
      MasterLeaveType,
      MasterLeaveDuration,
      MasterDepartment,
      MasterFileType,
      MasterNotificationTemplate,
      MasterSlaConfig,
      MasterPublicHoliday,
      MasterAdminRole,
    ]),
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
