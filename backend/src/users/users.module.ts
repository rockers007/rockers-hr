import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersAdminController } from './users-admin.controller';
import {
  MyProfileExtrasController,
  AdminProfileExtrasController,
} from './profile-extras.controller';
import { UsersService } from './users.service';
import { ProfileExtrasService } from './profile-extras.service';
import { User } from './entities/user.entity';
import { UserFamilyMember } from './entities/user-family-member.entity';
import { UserDocument } from './entities/user-document.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';
import { MasterDocumentType } from '../master/entities/master-document-type.entity';
import { PayrollRun } from '../payroll/entities/payroll-run.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserFamilyMember,
      UserDocument,
      LeaveBalance,
      MasterLeaveType,
      MasterSlaConfig,
      MasterDocumentType,
      PayrollRun,
    ]),
    // For InviteAuthService used by POST /admin/users/invite + resend-invite
    forwardRef(() => AuthModule),
  ],
  controllers: [
    UsersController,
    UsersAdminController,
    MyProfileExtrasController,
    AdminProfileExtrasController,
  ],
  providers: [UsersService, ProfileExtrasService],
  exports: [UsersService, ProfileExtrasService],
})
export class UsersModule {}
