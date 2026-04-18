import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Database backups — restricted to super_admin.
 *
 *   POST /api/v1/admin/backup/trigger              — run pg_dump + upload (existing)
 *   GET  /api/v1/admin/backup/list                 — list S3 backups with dates
 *   GET  /api/v1/admin/backup/download/:filename   — stream .sql (decompressed
 *                                                    so pgAdmin Query Tool →
 *                                                    Open File works directly)
 *   GET  /api/v1/admin/backup/download/:filename?gz=1
 *                                                  — stream the original .sql.gz
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
        data: {
          status: 'skipped',
          message: 'Backup skipped — S3 or DATABASE_URL not configured',
        },
      };
    }
    return {
      data: {
        status: 'success',
        key: result.key,
        filename: result.key.split('/').pop(),
        size_bytes: result.size,
        message: 'Database backup completed and uploaded to S3',
      },
    };
  }

  @Get('list')
  async listBackups() {
    const items = await this.backupService.listBackups();
    return { data: { items, count: items.length } };
  }

  @Get('download/:filename')
  async download(
    @Param('filename') filename: string,
    @Query('gz') gz: string | undefined,
    @Res() res: Response,
  ) {
    await this.backupService.streamBackup(filename, gz === '1', res);
  }
}
