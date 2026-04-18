import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OvertimeRequest } from './entities/overtime-request.entity';
import { User } from '../users/entities/user.entity';
import { OvertimeService } from './overtime.service';
import { OvertimeController, OvertimeAdminController } from './overtime.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OvertimeRequest, User])],
  controllers: [OvertimeController, OvertimeAdminController],
  providers: [OvertimeService],
  exports: [OvertimeService],
})
export class OvertimeModule {}
