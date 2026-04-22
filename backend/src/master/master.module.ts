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
import { MasterMaritalStatus } from './entities/master-marital-status.entity';
import { MasterDocumentType } from './entities/master-document-type.entity';

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
      MasterMaritalStatus,
      MasterDocumentType,
    ]),
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
