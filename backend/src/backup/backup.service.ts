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
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import * as zlib from 'zlib';
import type { Readable } from 'stream';
import type { Response } from 'express';

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

  /**
   * List all backups on S3 (newest first). Returns metadata admins need to
   * choose which snapshot to restore.
   */
  async listBackups(): Promise<
    Array<{
      key: string;
      filename: string;
      size_bytes: number;
      backup_date: string;
      storage_class: string;
    }>
  > {
    if (!this.s3Client) {
      throw new ServiceUnavailableException(
        'S3 is not configured — backups unavailable.',
      );
    }

    const rows: Array<{
      key: string;
      filename: string;
      size_bytes: number;
      backup_date: string;
      storage_class: string;
    }> = [];

    let continuationToken: string | undefined;
    do {
      const res = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${this.s3Prefix}/`,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of res.Contents ?? []) {
        if (!obj.Key || !obj.LastModified) continue;
        if (obj.Key.endsWith('/')) continue; // skip folder markers
        rows.push({
          key: obj.Key,
          filename: obj.Key.replace(`${this.s3Prefix}/`, ''),
          size_bytes: obj.Size ?? 0,
          backup_date: obj.LastModified.toISOString(),
          storage_class: obj.StorageClass ?? 'STANDARD',
        });
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    rows.sort((a, b) => b.backup_date.localeCompare(a.backup_date));
    return rows;
  }

  /**
   * Streams a backup file straight to the admin's browser as a download.
   *
   * - Default (`gz=false`): decompresses the `.sql.gz` on the fly and serves
   *   it as `.sql` so pgAdmin's Query Tool → Open File can load it directly
   *   (or `psql -f backup.sql`). This is the "easy for pgAdmin" path.
   * - `gz=true`: streams the original `.sql.gz` as-is (for admins who want
   *   to keep it compressed or re-upload elsewhere).
   */
  async streamBackup(
    filename: string,
    asGzip: boolean,
    res: Response,
  ): Promise<void> {
    if (!this.s3Client) {
      throw new ServiceUnavailableException(
        'S3 is not configured — backups unavailable.',
      );
    }
    if (filename.includes('/') || filename.includes('..')) {
      throw new NotFoundException('Invalid backup filename');
    }

    const key = `${this.s3Prefix}/${filename}`;

    let s3Object;
    try {
      s3Object = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === 'NoSuchKey' || err?.name === 'NotFound') {
        throw new NotFoundException(`Backup not found: ${filename}`);
      }
      throw e;
    }

    const body = s3Object.Body as Readable;

    if (asGzip) {
      // Stream .sql.gz as-is
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      if (s3Object.ContentLength) {
        res.setHeader('Content-Length', String(s3Object.ContentLength));
      }
      body.pipe(res);
      return;
    }

    // Decompress on the fly and serve as .sql for easy pgAdmin import
    const plainName = filename.replace(/\.gz$/i, '');
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${plainName}"`,
    );
    // Content-Length unknown post-decompress; omit and let chunked transfer handle it.

    const gunzip = zlib.createGunzip();
    body.on('error', (e) => {
      this.logger.error('S3 stream error', e);
      if (!res.headersSent) res.status(500);
      res.end();
    });
    gunzip.on('error', (e) => {
      this.logger.error('gunzip error', e);
      if (!res.headersSent) res.status(500);
      res.end();
    });

    body.pipe(gunzip).pipe(res);
  }
}
