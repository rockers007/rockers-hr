import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { PayslipDelivery } from '../entities/payslip-delivery.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunEmployee } from '../entities/payroll-run-employee.entity';
import { CompanyProfile } from '../entities/company-profile.entity';
import { User } from '../../users/entities/user.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { PayslipPdfService, passwordFromDob } from './payslip-pdf.service';
import { PayrollAuditService } from '../common/payroll-audit.service';

const MONTH_NAMES_UPPER = [
  'JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER',
];

@Injectable()
export class PayslipDeliveryService {
  private readonly logger = new Logger(PayslipDeliveryService.name);
  private s3: S3Client | null = null;
  private readonly bucket: string;

  constructor(
    @InjectRepository(PayslipDelivery)
    private readonly deliveryRepo: Repository<PayslipDelivery>,
    @InjectRepository(PayrollItem)
    private readonly itemRepo: Repository<PayrollItem>,
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
    @InjectRepository(PayrollRunEmployee)
    private readonly preRepo: Repository<PayrollRunEmployee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CompanyProfile)
    private readonly companyRepo: Repository<CompanyProfile>,
    private readonly pdfService: PayslipPdfService,
    private readonly notifications: NotificationsService,
    private readonly audit: PayrollAuditService,
    private readonly config: ConfigService,
  ) {
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.config.get<string>('AWS_REGION');
    this.bucket =
      this.config.get<string>('AWS_S3_PAYSLIP_BUCKET') ??
      this.config.get<string>('AWS_S3_BUCKET', '');

    if (accessKeyId && secretAccessKey && region) {
      this.s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  /**
   * Fire-and-forget full-run delivery. Invoked from RunsService.release.
   */
  async deliverRun(runId: string, actorId: string): Promise<void> {
    const items = await this.itemRepo.find({
      where: { run_id: runId, is_current: true },
    });
    this.logger.log(`Delivering ${items.length} payslips for run ${runId}`);

    let sent = 0;
    let failed = 0;
    for (const item of items) {
      try {
        await this.deliverOne(runId, item.user_id, actorId);
        sent++;
      } catch (e) {
        failed++;
        this.logger.error(
          `Delivery failed for user ${item.user_id}`,
          e as Error,
        );
      }
    }
    this.logger.log(
      `Run ${runId}: sent ${sent}, failed ${failed}, total ${items.length}`,
    );
  }

  async deliverOne(
    runId: string,
    userId: string,
    actorId: string,
  ): Promise<PayslipDelivery> {
    const item = await this.itemRepo.findOne({
      where: { run_id: runId, user_id: userId, is_current: true },
    });
    if (!item) throw new NotFoundException('Payroll item not found');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException('Run not found');
    const snap = await this.preRepo.findOne({
      where: { run_id: runId, user_id: userId },
    });
    const companyRows = await this.companyRepo.find();
    const company =
      companyRows[0] ??
      ({
        company_name: 'ROCKERS TECHNOLOGIES',
        payslip_footer_text:
          'This is a system generated pay slip and does not require signature',
      } as CompanyProfile);

    const password = passwordFromDob(user.dob);
    if (!password) {
      const failure = await this.recordFailure(
        runId,
        userId,
        item.id,
        'Missing DOB — cannot password-protect PDF',
      );
      return failure;
    }

    // 1. Generate PDF
    const pdf = await this.pdfService.render({
      item,
      user,
      company,
      month: run.month,
      year: run.year,
      monthName: MONTH_NAMES_UPPER[run.month - 1],
      password,
      working: this.buildWorking(snap),
    });

    // 2. Upload to S3
    const s3Key = `payslips/${run.year}/${MONTH_NAMES_UPPER[
      run.month - 1
    ].toLowerCase()}/${user.emp_number ?? user.id}.pdf`;
    let signedUrl: string | null = null;
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: pdf,
          ContentType: 'application/pdf',
          ServerSideEncryption: 'AES256',
          Metadata: {
            'emp-number': user.emp_number ?? 'unknown',
            'payroll-run-id': runId,
            month: `${run.year}-${String(run.month).padStart(2, '0')}`,
            'password-protected': 'true',
          },
        }),
      );
      signedUrl = await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
        { expiresIn: 24 * 60 * 60 }, // 24h
      );
    }

    // 3. Upsert delivery row (generated)
    const delivery = await this.upsertDelivery({
      run_id: runId,
      user_id: userId,
      payroll_item_id: item.id,
      s3_key: s3Key,
      s3_url_signed: signedUrl,
      pdf_size_bytes: pdf.length,
      status: 'GENERATED',
    });

    // 4. Send email
    try {
      const monthLabel = `${MONTH_NAMES_UPPER[run.month - 1]} ${run.year}`;
      await this.notifications.sendEmail(
        user.gmail,
        `Your Payslip for ${monthLabel}`,
        this.buildEmailBody(user.name, monthLabel),
        [
          {
            filename: `payslip_${user.emp_number ?? user.id}_${monthLabel.replace(' ', '_')}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      );

      delivery.status = 'EMAILED';
      delivery.sent_at = new Date();
      const saved = await this.deliveryRepo.save(delivery);

      await this.audit.log({
        actorId,
        action: 'payroll.payslip.sent',
        entityType: 'payslip_deliveries',
        entityId: saved.id,
        after: { user_id: userId, run_id: runId },
      });
      return saved;
    } catch (e) {
      delivery.status = 'FAILED';
      delivery.failure_reason = (e as Error).message;
      delivery.retry_count++;
      return this.deliveryRepo.save(delivery);
    }
  }

  async retry(runId: string, userId: string, actorId: string): Promise<PayslipDelivery> {
    await this.audit.log({
      actorId,
      action: 'payroll.payslip.retried',
      entityType: 'payslip_deliveries',
      after: { run_id: runId, user_id: userId },
    });
    return this.deliverOne(runId, userId, actorId);
  }

  async previewPdf(runId: string, userId: string): Promise<Buffer> {
    const item = await this.itemRepo.findOne({
      where: { run_id: runId, user_id: userId, is_current: true },
    });
    if (!item) throw new NotFoundException('Payroll item not found');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException('Run not found');
    const snap = await this.preRepo.findOne({
      where: { run_id: runId, user_id: userId },
    });
    const [company] = await this.companyRepo.find();

    return this.pdfService.render({
      item,
      user,
      company: company ?? ({
        company_name: 'ROCKERS TECHNOLOGIES',
        payslip_footer_text:
          'This is a system generated pay slip and does not require signature',
      } as CompanyProfile),
      month: run.month,
      year: run.year,
      monthName: MONTH_NAMES_UPPER[run.month - 1],
      watermark: 'PREVIEW — NOT RELEASED',
      working: this.buildWorking(snap),
    });
  }

  async getSignedDownloadUrl(
    runId: string,
    userId: string,
  ): Promise<{ signed_url: string; password_hint: string } | null> {
    const delivery = await this.deliveryRepo.findOne({
      where: { run_id: runId, user_id: userId },
    });
    if (!delivery || !delivery.s3_key || !this.s3) return null;
    const signed_url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: delivery.s3_key }),
      { expiresIn: 24 * 60 * 60 },
    );
    return {
      signed_url,
      password_hint: delivery.pdf_password_hint,
    };
  }

  async releaseProgress(runId: string) {
    const rows = await this.deliveryRepo.find({ where: { run_id: runId } });
    const counts = {
      total: rows.length,
      pending: rows.filter((r) => r.status === 'PENDING').length,
      generated: rows.filter((r) => r.status === 'GENERATED').length,
      emailed: rows.filter((r) => r.status === 'EMAILED').length,
      failed: rows.filter((r) => r.status === 'FAILED').length,
      bounced: rows.filter((r) => r.status === 'BOUNCED').length,
    };
    return { run_id: runId, ...counts, details: rows };
  }

  // --------------------------------------------------------------------------
  private buildWorking(snap: PayrollRunEmployee | null) {
    const dash = (v: string | number | null | undefined) => {
      const n = Number(v ?? 0);
      return n > 0 ? n.toString() : '—';
    };
    return {
      wd: snap ? snap.snapshot_statutory.payroll_cycle_days : 30,
      cl: dash(snap?.cl_days),
      sl: dash(snap?.sl_days),
      lwp: dash(snap?.lwp_days),
      pl: dash(snap?.pl_days),
      wfh: dash(snap?.wfh_days),
      comp_off: dash(snap?.comp_off_days),
      present: snap ? String(snap.present_days) : '30',
    };
  }

  private buildEmailBody(name: string, monthLabel: string): string {
    return `
<!doctype html>
<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<p>Dear ${name},</p>
<p>Please find attached your payslip for <strong>${monthLabel}</strong>.</p>
<p><em>Your payslip is password protected. The password is your date of birth in DDMM format
(e.g. 14 March → 1403).</em></p>
<p>If you have any questions, reply to this email or contact HR.</p>
<p>— Rockers HR</p>
</body></html>`.trim();
  }

  private async upsertDelivery(
    data: Partial<PayslipDelivery> & {
      run_id: string;
      user_id: string;
      payroll_item_id: string;
    },
  ): Promise<PayslipDelivery> {
    let row = await this.deliveryRepo.findOne({
      where: { run_id: data.run_id, user_id: data.user_id },
    });
    if (!row) {
      row = this.deliveryRepo.create(data);
    } else {
      Object.assign(row, data);
    }
    return this.deliveryRepo.save(row);
  }

  private async recordFailure(
    runId: string,
    userId: string,
    itemId: string,
    reason: string,
  ): Promise<PayslipDelivery> {
    return this.upsertDelivery({
      run_id: runId,
      user_id: userId,
      payroll_item_id: itemId,
      status: 'FAILED',
      failure_reason: reason,
    });
  }
}
