import { Controller, Post, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Manual backup trigger — restricted to super_admin.
 * POST /api/v1/admin/backup/trigger
 */
@Controller('admin/backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('trigger')
  async triggerBackup() {
    const result = await this.backupService.performBackup();
    if (!result) {
      return {
        data: { status: 'skipped', message: 'Backup skipped — S3 or DATABASE_URL not configured' },
      };
    }
    return {
      data: {
        status: 'success',
        key: result.key,
        size_bytes: result.size,
        message: 'Database backup completed and uploaded to S3',
      },
    };
  }
}
