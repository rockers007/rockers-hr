import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { PayrollRun } from '../entities/payroll-run.entity';
import { BankTransferFile } from '../entities/bank-transfer-file.entity';
import { BankChangeRequest } from '../entities/bank-change-request.entity';
import { PayrollBankFileFormat } from '../entities/payroll-bank-file-format.entity';
import { PayrollAuditService } from '../common/payroll-audit.service';

export type PreviewAction = 'use_old' | 'exclude_employee' | 'hold_separate';

export interface PreviewRow {
  user_id: string;
  emp_number: string | null;
  name: string;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  net_payable: string;
  has_pending_bank_change: boolean;
}

@Injectable()
export class BankFileService {
  private s3: S3Client | null = null;
  private readonly bucket: string;

  constructor(
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
    @InjectRepository(BankTransferFile)
    private readonly fileRepo: Repository<BankTransferFile>,
    @InjectRepository(BankChangeRequest)
    private readonly bankChangeRepo: Repository<BankChangeRequest>,
    @InjectRepository(PayrollBankFileFormat)
    private readonly formatRepo: Repository<PayrollBankFileFormat>,
    private readonly dataSource: DataSource,
    private readonly audit: PayrollAuditService,
    config: ConfigService,
  ) {
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = config.get<string>('AWS_REGION');
    this.bucket =
      config.get<string>('AWS_S3_BANK_BUCKET') ??
      config.get<string>('AWS_S3_BUCKET', '');
    if (accessKeyId && secretAccessKey && region) {
      this.s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  async preview(runId: string): Promise<{
    rows: PreviewRow[];
    total_amount: string;
    pending_bank_changes: number;
  }> {
    const run = await this.mustRun(runId);
    if (!['RELEASED', 'BANK_FILE_APPROVED', 'BANK_FILE_GENERATED'].includes(run.state)) {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Bank file preview requires RELEASED state; got ${run.state}`,
      });
    }

    const rows: PreviewRow[] = await this.dataSource.query(
      `SELECT
         pi.user_id,
         u.emp_number,
         u.name,
         u.bank_name,
         u.bank_account_no,
         u.bank_ifsc,
         pi.net_payable,
         EXISTS (
           SELECT 1 FROM bank_change_requests b
           WHERE b.user_id = pi.user_id AND b.status = 'PENDING'
         ) AS has_pending_bank_change
       FROM payroll_items pi
       JOIN users u ON u.id = pi.user_id
       WHERE pi.run_id = $1 AND pi.is_current = TRUE AND pi.net_payable > 0
       ORDER BY u.name ASC`,
      [runId],
    );

    const total = rows.reduce((acc, r) => acc + Number(r.net_payable), 0);
    const pending = rows.filter((r) => r.has_pending_bank_change).length;

    return {
      rows,
      total_amount: total.toFixed(2),
      pending_bank_changes: pending,
    };
  }

  async approve(
    runId: string,
    confirmationPhrase: string,
    fileFormatCode: string,
    pendingAction: PreviewAction,
    actorId: string,
  ): Promise<PayrollRun> {
    const expected = 'APPROVE BANK TRANSFER FILE';
    if (confirmationPhrase !== expected) {
      throw new BadRequestException({
        code: 'PR_RUN_VALIDATION_FAILED',
        message: `Confirmation phrase must be "${expected}"`,
      });
    }
    const run = await this.mustRun(runId);
    if (run.state !== 'RELEASED') {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Approval requires RELEASED state; got ${run.state}`,
      });
    }
    const format = await this.formatRepo.findOne({
      where: { code: fileFormatCode, is_active: true },
    });
    if (!format) {
      throw new NotFoundException(`Unknown bank file format: ${fileFormatCode}`);
    }

    run.state = 'BANK_FILE_APPROVED';
    run.bank_file_approved_at = new Date();
    run.bank_file_approved_by = actorId;
    const saved = await this.runRepo.save(run);

    await this.audit.log({
      actorId,
      action: 'payroll.bank_file.approved',
      entityType: 'payroll_runs',
      entityId: runId,
      after: {
        format_code: fileFormatCode,
        pending_bank_changes_action: pendingAction,
      },
    });
    return saved;
  }

  async generate(
    runId: string,
    actorId: string,
  ): Promise<{
    signed_url?: string;
    file_id: string;
    size: number;
    filename: string;
    content: string;
    mime_type: string;
  }> {
    const run = await this.mustRun(runId);
    if (run.state !== 'BANK_FILE_APPROVED' && run.state !== 'BANK_FILE_GENERATED') {
      throw new ConflictException({
        code: 'PR_BANK_FILE_NOT_APPROVED',
        message: 'Bank file must be approved before generation',
      });
    }

    const latest = await this.fileRepo.findOne({
      where: { run_id: runId, is_latest: true },
    });
    // Prefer the format used by the most recent generation for this run; else
    // pick the first active format by code (deterministic). Phase 2: persist
    // the approved format code on payroll_runs so approve→generate are linked
    // in multi-format setups (v2.3 audit item #3).
    const format = latest?.file_format
      ? await this.formatRepo.findOne({
          where: { code: latest.file_format, is_active: true },
        })
      : await this.formatRepo
          .createQueryBuilder('f')
          .where('f.is_active = TRUE')
          .orderBy('f.code', 'ASC')
          .getOne();
    if (!format) {
      throw new NotFoundException('No active bank file format');
    }

    const preview = await this.preview(runId);
    const body = this.renderFile(format, preview.rows);

    // Mark any existing latest non-latest, insert new row
    await this.fileRepo.update({ run_id: runId, is_latest: true }, {
      is_latest: false,
    });

    const key = `bank-files/${run.year}/${String(run.month).padStart(2, '0')}/${runId}_${Date.now()}.${format.file_extension}`;
    let signedUrl: string | undefined;
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: 'text/plain',
          ServerSideEncryption: 'AES256',
        }),
      );
      signedUrl = await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: 15 * 60 },
      );
    }

    const fileRow = this.fileRepo.create({
      run_id: runId,
      file_type: 'NEFT',
      employee_count: preview.rows.length,
      total_amount: preview.total_amount,
      s3_key: key,
      file_format: format.code,
      is_latest: true,
      approved_by: run.bank_file_approved_by ?? actorId,
      approved_at: run.bank_file_approved_at ?? new Date(),
    });
    const saved = await this.fileRepo.save(fileRow);

    if (run.state !== 'BANK_FILE_GENERATED') {
      run.state = 'BANK_FILE_GENERATED';
      run.bank_file_generated_at = new Date();
      await this.runRepo.save(run);
    }

    const filename = `bank_transfer_${run.year}_${String(run.month).padStart(2, '0')}.${format.file_extension}`;

    await this.audit.log({
      actorId,
      action: 'payroll.bank_file.downloaded',
      entityType: 'bank_transfer_files',
      entityId: saved.id,
      after: { size: body.length, regenerated: !!latest },
    });

    return {
      signed_url: signedUrl,
      file_id: saved.id,
      size: body.length,
      filename,
      content: body,
      mime_type: 'text/plain',
    };
  }

  private renderFile(
    format: PayrollBankFileFormat,
    rows: Array<{
      emp_number: string | null;
      name: string;
      bank_name: string | null;
      bank_account_no: string | null;
      bank_ifsc: string | null;
      net_payable: string;
    }>,
  ): string {
    const delim = format.delimiter;
    const columns = format.column_order as unknown as string[];
    const map: Record<string, (r: typeof rows[number]) => string> = {
      EMP_NAME: (r) => r.name,
      EMP_NUMBER: (r) => r.emp_number ?? '',
      BANK_NAME: (r) => r.bank_name ?? '',
      ACC_NO: (r) => r.bank_account_no ?? '',
      IFSC: (r) => r.bank_ifsc ?? '',
      AMOUNT: (r) => Number(r.net_payable).toFixed(2),
      REMARKS: () => 'Salary',
    };

    const lines: string[] = [];
    if (format.has_header_row) lines.push(columns.join(delim));
    for (const r of rows) {
      lines.push(columns.map((c) => (map[c] ?? (() => ''))(r)).join(delim));
    }
    return lines.join('\n');
  }

  private async mustRun(id: string): Promise<PayrollRun> {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }
}
