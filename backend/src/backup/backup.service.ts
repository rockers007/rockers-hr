import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly s3Prefix = 'db-backups';
  private readonly retentionDays = 7;
  private readonly databaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');
    this.databaseUrl = this.configService.get<string>('DATABASE_URL', '');

    if (accessKeyId && secretAccessKey && this.bucket) {
      this.s3Client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log('Database backup service initialized (S3 target: ' + this.bucket + ')');
    } else {
      this.logger.warn('AWS S3 not configured — database backups disabled');
    }
  }

  /**
   * Daily backup at 2:00 AM (server time).
   * Runs pg_dump, compresses with gzip, uploads to S3, then cleans up old backups.
   */
  @Cron('0 2 * * *')
  async handleDailyBackup(): Promise<void> {
    this.logger.log('Starting scheduled daily database backup...');
    try {
      await this.performBackup();
    } catch (error) {
      this.logger.error(
        'Daily backup failed',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Can also be called manually (e.g., from a controller or CLI).
   */
  async performBackup(): Promise<{ key: string; size: number } | null> {
    if (!this.s3Client) {
      this.logger.warn('S3 not configured — skipping backup');
      return null;
    }

    if (!this.databaseUrl) {
      this.logger.error('DATABASE_URL not configured — cannot backup');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `rockers_hr_${timestamp}.sql.gz`;
    const tmpDir = path.resolve(__dirname, '..', '..', 'tmp');
    const tmpFile = path.join(tmpDir, fileName);

    // Ensure tmp directory exists
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    try {
      // Step 1: pg_dump + gzip
      this.logger.log('Running pg_dump...');
      const pgDumpCmd = `pg_dump "${this.databaseUrl}" --no-owner --no-privileges | gzip > "${tmpFile}"`;
      await execAsync(pgDumpCmd, { timeout: 300_000 }); // 5 minute timeout

      const stats = fs.statSync(tmpFile);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      this.logger.log(`Backup file created: ${fileName} (${sizeMB} MB)`);

      // Step 2: Upload to S3
      const s3Key = `${this.s3Prefix}/${fileName}`;
      const fileBuffer = fs.readFileSync(tmpFile);

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: 'application/gzip',
          StorageClass: 'STANDARD_IA',
          Metadata: {
            'backup-date': new Date().toISOString(),
            'database': 'rockers_hr',
          },
        }),
      );

      this.logger.log(`Uploaded to s3://${this.bucket}/${s3Key}`);

      // Step 3: Cleanup old backups
      await this.cleanupOldBackups();

      // Step 4: Remove local tmp file
      fs.unlinkSync(tmpFile);

      return { key: s3Key, size: stats.size };
    } catch (error) {
      // Clean up tmp file on failure
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
      throw error;
    }
  }

  /**
   * Delete S3 backup files older than retentionDays.
   */
  private async cleanupOldBackups(): Promise<void> {
    if (!this.s3Client) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    this.logger.log(
      `Cleaning up backups older than ${cutoffDate.toISOString().slice(0, 10)} (${this.retentionDays}-day retention)...`,
    );

    try {
      const listResult = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${this.s3Prefix}/`,
        }),
      );

      const contents = listResult.Contents ?? [];
      let deletedCount = 0;

      for (const obj of contents) {
        if (!obj.Key || !obj.LastModified) continue;

        if (obj.LastModified < cutoffDate) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: obj.Key,
            }),
          );
          deletedCount++;
          this.logger.log(`Deleted old backup: ${obj.Key} (${obj.LastModified.toISOString().slice(0, 10)})`);
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old backup(s)`);
      } else {
        this.logger.log('No old backups to clean up');
      }
    } catch (error) {
      this.logger.error(
        'Failed to cleanup old backups',
        error instanceof Error ? error.message : error,
      );
    }
  }
}
