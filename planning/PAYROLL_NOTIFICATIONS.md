# PAYROLL_NOTIFICATIONS.md

**Scope:** All email and in-app notifications sent by the payroll module. Transport reuses the leave module's SMTP + in-app channels defined in `NOTIFICATIONS.md`.
**Version:** v2.3

Cross-refs:
- SMTP configuration + transport → `NOTIFICATIONS.md` (leave module)
- Trigger points in workflow → `PAYROLL_WORKFLOW.md`
- Delivery tracking → `PAYROLL_DATABASE_SCHEMA.md` §5 (`payslip_deliveries`)

---

## 1. Channels

Payroll uses two channels — the same transports already wired for the leave module:

| Channel | Use |
| --- | --- |
| **Email (SMTP)** | Payslip delivery (with attachment), bank change status, major payroll events to admins |
| **In-app** | Dashboard notifications for admins + employees |

No SMS in MVP. No push notifications (Flutter is Phase 2).

## 2. Template Conventions

- All emails are HTML with a plain-text fallback.
- Subject lines are sentence case except proper nouns.
- From address: uses the shared `SMTP_FROM` env variable (currently `Rockers HR <hr.rockersinfo@gmail.com>` — see `PLAN.md` §6). *(v2.3 — Review item N1: reconciled with env vars. `payroll@rockershr.com` was a placeholder; actual sender is the configured SMTP_FROM. Ensure SPF/DKIM are configured for whichever domain is used.)*
- Every email ends with a footer: company name + "This is an automated message — please do not reply."
- Sensitive data (passwords, account numbers) is **never** included in email body.
- Variables use `{{variable}}` syntax (Handlebars-compatible).

## 3. Notification Catalog

### N1. Payslip Released (Email to Employee)

**Trigger:** Step 5b (release) succeeds for an individual employee. One email per employee per run.

**Channel:** Email with PDF attachment
**Recipient:** `users.email` (employee's Gmail)
**Template ID:** `payroll.payslip_released`

**Subject:**
```
Your payslip for {{monthName}} {{year}} — Rockers HR
```

**Body (HTML):**
```html
<p>Hi {{firstName}},</p>

<p>Your payslip for <strong>{{monthName}} {{year}}</strong> is now available. Please find it attached to this email.</p>

<p><strong>Password:</strong> Your payslip is password protected. The password is your date of birth in <code>DDMM</code> format (e.g., if your DOB is 14 March, the password is <code>1403</code>).</p>

<p><strong>Net Payable:</strong> ₹{{netPayable}}</p>
<p><strong>Credited to:</strong> {{bankName}} A/C ending {{bankAccountLast4}}</p>

<p>You can also view and download your past payslips anytime from the <a href="{{portalUrl}}">Employee Portal</a>.</p>

<p>If you spot any discrepancy, please reach out to HR within 7 days.</p>

<p>Regards,<br/>
Rockers HR Payroll Team</p>

<hr/>
<p style="font-size:11px;color:#888;">
  Rockers Technologies, 3rd Floor, Corner Heights, Kalali Road, Vadodara.<br/>
  This is an automated message — please do not reply.
</p>
```

**Attachment:**
- File: `payslip_{{empNumber}}_{{MONTH}}_{{YEAR}}.pdf` (e.g., `payslip_RT-DEV-153_MARCH_2026.pdf`)
- Password-protected using DOB DDMM (per `PAYROLL_PAYSLIP_FORMAT.md` §7)

**Failure handling:** On SMTP bounce or error, `payslip_deliveries.status = FAILED` or `BOUNCED`. Auto-retry up to 3 times (30s, 2min, 10min). After that, manual retry by admin required.

### N2. Payslip Bounced (Email to Admin)

**Trigger:** Payslip email bounces after auto-retries exhausted.

**Channel:** Email
**Recipient:** Admin contact(s) — configurable via `payroll_statutory_config` or separate notification settings table
**Template ID:** `payroll.payslip_bounced`

**Subject:**
```
[Action Required] Payslip delivery failed: {{empNumber}} — {{monthName}} {{year}}
```

**Body (HTML):**
```html
<p>Hi Admin,</p>

<p>The payslip for <strong>{{employeeName}} ({{empNumber}})</strong> for <strong>{{monthName}} {{year}}</strong> could not be delivered after {{retryCount}} attempts.</p>

<p><strong>Failure reason:</strong> {{failureReason}}</p>
<p><strong>Employee email on record:</strong> {{email}}</p>

<p>Please check the employee's email address and retry from the <a href="{{adminRetryUrl}}">Payroll Release Status</a> screen.</p>
```

### N3. Payslip Available (In-App to Employee)

**Trigger:** Same as N1, simultaneously.

**Channel:** In-app
**Template ID:** `payroll.payslip_available_inapp`

**Content (short):**
```
Your payslip for {{monthName}} {{year}} is ready. Net payable: ₹{{netPayable}}. Download from My Payroll.
```

Click-through destination: Employee Portal payslip list.

### N4. Bank Change Submitted (Email to Admins)

**Trigger:** Employee submits bank detail change request (`POST /api/v1/payroll/bank-change`).

**Channel:** Email
**Recipient:** All Super Admins + HR Managers
**Template ID:** `payroll.bank_change_submitted`

**Subject:**
```
New bank change request: {{empNumber}}
```

**Body:**
```html
<p>Hi,</p>

<p><strong>{{employeeName}} ({{empNumber}})</strong> has submitted a bank detail change request on {{submittedAt}}.</p>

<p><strong>New details:</strong></p>
<ul>
  <li>Bank: {{newBankName}}</li>
  <li>A/C: {{newAccountNoMasked}}</li>
  <li>IFSC: {{newIfsc}}</li>
</ul>

<p>Please <a href="{{reviewUrl}}">review and approve/reject</a> before the next payroll run.</p>
```

Account number is masked (`XXXX-XXXX-1234`) to reduce sensitive data in email.

### N5. Bank Change Approved (Email + In-app to Employee)

**Trigger:** Admin approves bank change.

**Channel:** Email + In-app
**Template ID:** `payroll.bank_change_approved`

**Subject:**
```
Your bank change request has been approved
```

**Body (excerpt):**
```
Hi {{firstName}},

Your bank detail change has been approved. Your salary for the next payroll run will be credited to your new account ({{newBankName}} A/C ending {{bankAccountLast4}}).

If you did not submit this change, please contact HR immediately.

Regards,
Rockers HR Payroll Team
```

**In-app:**
```
Bank details updated ✓ New bank: {{newBankName}}, A/C ending {{last4}}. Effective next payroll.
```

### N6. Bank Change Rejected (Email + In-app to Employee)

**Trigger:** Admin rejects bank change.

**Channel:** Email + In-app
**Template ID:** `payroll.bank_change_rejected`

**Subject:**
```
Your bank change request needs attention
```

**Body:**
```html
<p>Hi {{firstName}},</p>

<p>Your recent bank detail change request could not be approved.</p>

<p><strong>Reason:</strong> {{rejectionReason}}</p>

<p>You can submit a new request from the <a href="{{portalUrl}}">Employee Portal</a> with corrected details or additional documentation.</p>
```

### N7. Payroll Run Locked (In-app to HR Team)

**Trigger:** Payroll run transitions from `REVIEW` → `LOCKED` (Step 5a).

**Channel:** In-app
**Recipient:** Super Admins + HR Managers + Reports Admins
**Template ID:** `payroll.run_locked_inapp`

**Content:**
```
Payroll for {{monthName}} {{year}} has been locked by {{lockedBy}}. Total net payable: ₹{{totalNetPayable}}. Ready to release.
```

No email version — this is informational, and email fatigue from internal team notifications is a known issue.

### N8. Payroll Run Released (In-app to HR Team)

**Trigger:** `LOCKED` → `RELEASED` (Step 5b complete).

**Channel:** In-app
**Template ID:** `payroll.run_released_inapp`

**Content:**
```
Payroll for {{monthName}} {{year}} released. {{payslipsGenerated}} payslips sent.
{{#if emailFailures}} {{emailFailures}} delivery failures — review status screen. {{/if}}
```

### N9. Bank Transfer File Approved (Email to Super Admin who approved + audit team)

**Trigger:** Super Admin approves bank transfer file (Step 6).

**Channel:** Email
**Recipient:** The approving Super Admin (confirmation) + any audit contacts configured in `payroll_notification_recipients` (see below)
**Template ID:** `payroll.bank_file_approved`

**Subject:**
```
Bank transfer file approved — {{monthName}} {{year}}
```

**Body:**
```html
<p>Hi,</p>

<p>The bank transfer file for <strong>{{monthName}} {{year}}</strong> payroll has been approved by <strong>{{approvedBy}}</strong> at {{approvedAt}}.</p>

<ul>
  <li>Employees: {{employeeCount}}</li>
  <li>Total amount: ₹{{totalAmount}}</li>
  <li>Format: {{fileFormat}}</li>
</ul>

<p>The file is now available for download from the <a href="{{downloadUrl}}">Bank Transfer screen</a>. Download URL expires in 15 minutes after generation.</p>

<p>⚠️ Handle this file carefully — it authorizes real money transfers.</p>
```

### N12. Salary Config Updated (In-app to Employee) (v2.3)

> **v2.3 (Review item N2):** Added so employees are informed when their salary structure changes.

**Trigger:** Admin updates an employee's salary config via `PATCH /api/v1/payroll/employees/:userId/salary`.

**Channel:** In-app only (no email — salary details are sensitive; in-app notification prompts the employee to check their portal)
**Template ID:** `payroll.salary_config_updated_inapp`

**Content (short):**
```
Your salary structure has been updated by HR. Please review your current breakdown in My Payroll > Salary Breakdown.
```

Click-through destination: Employee Portal salary breakdown page.

**Note:** The notification does NOT include the old or new salary values. The employee views the updated values in the portal.

### N10. Investment Proof Uploaded (In-app confirmation to Employee)

**Trigger:** Employee uploads investment proof.

**Channel:** In-app only (no email — low-importance confirmation)
**Template ID:** `payroll.investment_proof_uploaded_inapp`

**Content:**
```
Investment proof uploaded: {{category}} — ₹{{amount}} ({{fileName}}).
```

### N11. Payslip Delivery Summary (Email to HR, optional)

**Trigger:** After Step 5b completes (typically within 5 minutes of release start).

**Channel:** Email
**Recipient:** HR Manager who released payroll
**Template ID:** `payroll.release_summary`

**Subject:**
```
Payroll release summary: {{monthName}} {{year}}
```

**Body:**
```
Release complete. Summary:

• Payslips generated: {{successCount}} / {{totalCount}}
• Failed deliveries: {{failureCount}}
• Average send time per payslip: {{avgMs}}ms

{{#if failures}}
Failed deliveries:
{{#each failures}}
  • {{empNumber}}: {{failureReason}}
{{/each}}

Please review and retry from the Release Status screen.
{{/if}}
```

## 4. Template Storage

> **v2.3 (Review item I4):** Payroll templates are stored in the **existing** `master_notification_templates` table from the leave module — not a separate `notification_templates` table. This avoids two template stores and reuses the existing admin UI for template editing.

Payroll templates are distinguished by their `template_id` prefix (`payroll.*`). The leave module uses unprefixed or `leave.*` prefixed IDs. Both live in the same table:

```sql
-- Existing table from leave module (no changes needed):
-- master_notification_templates
--   id, template_id (UNIQUE), channel, subject_template, body_html_template,
--   body_text_template, body_inapp_template, variables_schema (JSONB),
--   is_active, updated_by, updated_at

-- Payroll seeds 12 rows (11 original + N12 from v2.3) with template_id prefix 'payroll.*'
```

Payroll seeds the 12 payroll templates listed above during DB migration (INSERT with `ON CONFLICT DO NOTHING` to avoid clobbering any HR-customized templates on re-migration).

## 5. Trigger Points Matrix

| Event in Workflow | Notifications Fired |
| --- | --- |
| Employee submits bank change | N4 (email to admins) |
| Admin approves bank change | N5 (email + in-app to employee) |
| Admin rejects bank change | N6 (email + in-app to employee) |
| Employee uploads investment proof | N10 (in-app to employee) |
| Payroll run locked (Step 5a) | N7 (in-app to HR team) |
| Payslip generated for employee (Step 5b) | N1 (email+attach), N3 (in-app), log to `payslip_deliveries` |
| Payslip email bounces (after retries) | N2 (email to admin), log flagged in `payslip_deliveries` |
| Payroll release complete | N8 (in-app), N11 (email summary to releaser) |
| Super Admin approves bank transfer file | N9 (email to approver) |
| Admin updates employee salary config | N12 (in-app to employee) *(v2.3)* |

### 5.1 Notification Recipients Configuration (v2.3)

> **v2.3 (Review item N3, ties into Open Question Q7).** Defines where "audit contacts" and "admin contacts" are configured.

For notifications that go to "admins" or "audit contacts" (N2, N4, N9, N11), the recipients are resolved as follows:

1. **Default:** All users with `SUPER_ADMIN` role + all users with `HR_MANAGER` role.
2. **Override (optional):** A `payroll_notification_recipients` configuration table allows Super Admin to set explicit email lists per notification type:

```sql
CREATE TABLE payroll_notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(50) NOT NULL,   -- e.g., 'payslip_bounce', 'bank_file_approved', 'release_summary'
  email VARCHAR(120) NOT NULL,              -- can be a group/alias: 'payroll-ops@rockershr.com'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

If no rows exist for a given `notification_type`, the system falls back to the default (all Super Admins + HR Managers).

## 6. Variable Reference

Common variables used across templates. Each template's `variables_schema` column enumerates exactly which it requires.

| Variable | Source | Example |
| --- | --- | --- |
| `{{firstName}}` | `users.name` split on first space | `Rakesh` |
| `{{employeeName}}` | Full `users.name` | `Rakesh Patel` |
| `{{empNumber}}` | `users.emp_number` | `RT-DEV-153` |
| `{{email}}` | `users.email` | `rakesh@rockers.com` |
| `{{monthName}}` | Month name from run | `March` |
| `{{year}}` | Year from run | `2026` |
| `{{MONTH}}` | Uppercase month for filenames | `MARCH` |
| `{{YEAR}}` | Year for filenames | `2026` |
| `{{netPayable}}` | `payroll_items.net_payable` formatted | `41,200.00` |
| `{{bankName}}` | `users.bank_name` | `Reliance` |
| `{{bankAccountLast4}}` | Last 4 digits of `users.bank_account_no` | `8299` |
| `{{newAccountNoMasked}}` | Masked new account number | `XXXX-XXXX-8299` |
| `{{portalUrl}}` | Env variable | `https://rockers-hr.example.com/me` |
| `{{reviewUrl}}` | Admin deep-link | `https://.../admin/bank-changes/{{id}}` |
| `{{totalNetPayable}}` | `payroll_runs.total_net_payable` formatted | `15,42,300.00` |
| `{{payslipsGenerated}}` | Count of `EMAILED` deliveries | `42` |
| `{{emailFailures}}` | Count of `FAILED`/`BOUNCED` | `0` |

## 7. Localisation

MVP is **English only**. Templates are designed with variable substitution, so adding Hindi/Gujarati variants post-MVP is a matter of adding rows with different `template_id` suffixes (`payroll.payslip_released.hi`, `.gu`) and choosing per user preference. The schema supports this — no migration needed.

## 8. Email Deliverability Notes

- SPF + DKIM for `rockershr.com` must be configured before go-live (infra task, not payroll-module task).
- SMTP rate limits: existing leave module handles this via a queued transport (BullMQ or similar — already chosen in leave module). Payroll emits to the same queue.
- For the initial rollout, the client should send a test email to all employees before first payroll run to warm up the sending domain and let employees whitelist the address.

## 9. Do Not Notify

**Explicit anti-patterns** we do not do:

- ❌ Send email on every item edit in Review (spam).
- ❌ Send weekly payroll summary automatically (HR can pull reports on demand).
- ❌ Send email on ESIC toggle or master data changes (audit log is enough).
- ❌ Include password in the payslip email (defeats security).
- ❌ Include full bank account number in any email (masked only).
- ❌ Send notifications to terminated/inactive employees.

---

*End of PAYROLL_NOTIFICATIONS.md. Next: PAYROLL_FRONTEND_DESIGN.md — the 9 screens.*
