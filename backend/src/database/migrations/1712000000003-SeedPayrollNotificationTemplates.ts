import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds payroll notification templates into master_notification_templates
 * per PAYROLL_NOTIFICATIONS.md §3 and D30 (shared template table).
 * Idempotent via ON CONFLICT (event_key).
 */
export class SeedPayrollNotificationTemplates1712000000003
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{
      event_key: string;
      subject?: string;
      body: string;
      channel: 'email' | 'in_app' | 'both';
    }> = [
      {
        event_key: 'payroll.payslip_released',
        subject: 'Your payslip for {{monthName}} {{year}} — Rockers HR',
        channel: 'email',
        body: `<p>Hi {{firstName}},</p>
<p>Your payslip for <strong>{{monthName}} {{year}}</strong> is attached.</p>
<p><strong>Password:</strong> Date of birth in DDMM format (e.g. 14 March → <code>1403</code>).</p>
<p><strong>Net Payable:</strong> ₹{{netPayable}}</p>
<p>You can also view past payslips from the Employee Portal.</p>
<p>Regards,<br/>Rockers HR Payroll Team</p>
<hr/>
<p style="font-size:11px;color:#888;">Rockers Technologies, Vadodara. Automated message — please do not reply.</p>`,
      },
      {
        event_key: 'payroll.payslip_available_inapp',
        channel: 'in_app',
        body: 'Your payslip for {{monthName}} {{year}} is ready. Net payable: ₹{{netPayable}}. Download from My Payroll.',
      },
      {
        event_key: 'payroll.payslip_bounced',
        subject:
          '[Action Required] Payslip delivery failed: {{empNumber}} — {{monthName}} {{year}}',
        channel: 'email',
        body: `<p>Hi Admin,</p>
<p>The payslip for <strong>{{employeeName}} ({{empNumber}})</strong> for <strong>{{monthName}} {{year}}</strong> could not be delivered after {{retryCount}} attempts.</p>
<p><strong>Failure reason:</strong> {{failureReason}}</p>
<p><strong>Employee email:</strong> {{email}}</p>
<p>Please verify the address and retry from the Payroll Release Status screen.</p>`,
      },
      {
        event_key: 'payroll.bank_change_submitted',
        subject: 'New bank change request: {{employeeName}}',
        channel: 'email',
        body: `<p>Hi Admin,</p>
<p><strong>{{employeeName}}</strong> has submitted a bank detail change request on {{submittedAt}}. Please review and approve or reject from the admin panel.</p>`,
      },
      {
        event_key: 'payroll.bank_change_approved',
        subject: 'Your bank change request was approved',
        channel: 'email',
        body: `<p>Hi {{firstName}},</p>
<p>Your bank detail change request has been approved. New details will be used from the next payroll run.</p>`,
      },
      {
        event_key: 'payroll.bank_change_rejected',
        subject: 'Your bank change request was rejected',
        channel: 'email',
        body: `<p>Hi {{firstName}},</p>
<p>Your bank detail change request was rejected. Reason: {{reason}}</p>
<p>Please submit a new request with corrected details.</p>`,
      },
      {
        event_key: 'payroll.salary_updated',
        subject: 'Your salary structure was updated',
        channel: 'email',
        body: `<p>Hi {{firstName}},</p>
<p>Your salary structure has been updated by HR. The new configuration will take effect from the next payroll run.</p>`,
      },
      {
        event_key: 'payroll.run_released',
        subject: 'Payroll run released: {{monthName}} {{year}}',
        channel: 'in_app',
        body: 'Payroll for {{monthName}} {{year}} has been released. {{employeeCount}} payslips dispatched.',
      },
    ];

    for (const r of rows) {
      await queryRunner.query(
        `INSERT INTO master_notification_templates (event_key, subject_template, body_template, channel, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (event_key) DO UPDATE SET
           subject_template = EXCLUDED.subject_template,
           body_template = EXCLUDED.body_template,
           channel = EXCLUDED.channel,
           updated_at = now()`,
        [r.event_key, r.subject ?? null, r.body, r.channel],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM master_notification_templates WHERE event_key LIKE 'payroll.%'`,
    );
  }
}
