# Notifications & SLA Engine

Design for the email + in-app notification system and the SLA enforcement background job.

---

## Overview

Every notification in Rockers HR is template-driven. The content of every email subject line, email body, and in-app message lives in `master_notification_templates` and is managed by Super Admin. No notification text is hardcoded.

**Two channels:**
- **Email** — SMTP delivery
- **In-app** — PostgreSQL-backed; shown in the notification bell in the web and mobile UI

---

## Template Token System

Templates use `{{token}}` placeholders. The notification service renders these at send time.

### Available Tokens

| Token | Resolves To |
|-------|------------|
| `{{employee_name}}` | Full name of the employee the notification is about |
| `{{admin_name}}` | Name of the admin who performed an action |
| `{{manager_name}}` | Name of the Level 1 approver |
| `{{leave_type}}` | Name of the leave type (e.g., "Casual Leave") |
| `{{dates}}` | Formatted date range (e.g., "Jun 15–16, 2025") |
| `{{start_date}}` | Start date formatted (e.g., "June 15, 2025") |
| `{{end_date}}` | End date formatted |
| `{{working_days}}` | Number of working days (e.g., "2") |
| `{{reason}}` | Decline reason text |
| `{{sla_remaining}}` | Human-readable SLA remaining (e.g., "1 hour 23 minutes") |
| `{{days}}` | Generic day count for balance notifications |
| `{{year}}` | Calendar year (e.g., "2025") |

### Token Rendering (NestJS Service)

```typescript
function renderTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? `{{${key}}}`);
}
```

Unresolved tokens are left as-is (defensive — never crashes, easy to spot in testing).

---

## Event Catalogue

### `leave.submitted.employee`
**Trigger:** Employee submits a leave request.
**Recipients:** Employee (confirmation)

**Template:**
```
Subject: Leave Request Submitted — {{leave_type}}, {{dates}}
Body:    Hi {{employee_name}}, your {{leave_type}} request for {{dates}} ({{working_days}} days)
         has been submitted and is awaiting manager approval.
```

### `leave.submitted.manager`
**Trigger:** Employee submits a leave request.
**Recipients:** Manager (action required)

**Template:**
```
Subject: Approval Required: {{employee_name}} — {{leave_type}}, {{dates}}
Body:    {{employee_name}} has submitted a {{leave_type}} request for {{dates}} ({{working_days}} days).
         Please review and respond within the SLA window.
```

---

### `leave.approved.l1.employee`
**Trigger:** Manager approves at Level 1.
**Recipients:** Employee

**Template:**
```
Subject: Leave Approved by Manager — {{leave_type}}, {{dates}}
Body:    Hi {{employee_name}}, your {{leave_type}} request ({{dates}}) has been approved
         by {{manager_name}} and is now awaiting final HR approval.
```

### `leave.approved.l1.hr`
**Trigger:** Manager approves at Level 1.
**Recipients:** HR Admin (action required — Level 2 approval)

**Template:**
```
Subject: Level 2 Approval Required: {{employee_name}} — {{leave_type}}, {{dates}}
Body:    {{employee_name}}'s {{leave_type}} request for {{dates}} ({{working_days}} days)
         has been approved by {{manager_name}} at Level 1 and is now awaiting your final approval.
```

---

### `leave.approved.l2`
**Trigger:** HR approves at Level 2.
**Recipients:** Employee

**Template — to employee:**
```
Subject: Leave Fully Approved — {{leave_type}}, {{dates}}
Body:    Hi {{employee_name}}, your {{leave_type}} request for {{dates}} has been fully approved.
         A Google Calendar event has been added to the team calendar.
         Enjoy your time off!
```

---

### `leave.declined`
**Trigger:** Manager or HR declines.
**Recipients:** Employee

**Template:**
```
Subject: Leave Request Declined — {{leave_type}}, {{dates}}
Body:    Hi {{employee_name}}, your {{leave_type}} request for {{dates}} has been declined.
         Reason: {{reason}}
         You can submit a new request or contact HR for more information.
```

---

### `sla.reminder`
**Trigger:** SLA engine at `sla.reminder_at_hours` (default: 4h after submission).
**Recipients:** Manager

**Template:**
```
Subject: ⚠️ Approval Required — {{employee_name}} SLA Alert
Body:    {{employee_name}}'s {{leave_type}} leave request for {{dates}} is still awaiting
         your approval. Time remaining: {{sla_remaining}}.
         Please action this request to avoid auto-escalation to HR.
```

---

### `sla.escalated.hr`
**Trigger:** SLA engine at `sla.manager_window_hours` (default: 5h after submission).
**Recipients:** HR Admin

**Template:**
```
Subject: Leave Escalated to HR — {{employee_name}}
Body:    {{employee_name}}'s {{leave_type}} request for {{dates}} has been automatically
         escalated to HR after the manager approval window expired without action.
```

### `sla.escalated.employee`
**Trigger:** SLA engine at `sla.manager_window_hours` (default: 5h after submission).
**Recipients:** Employee

**Template:**
```
Subject: Your Leave Request Has Been Escalated
Body:    Hi {{employee_name}}, your {{leave_type}} request for {{dates}} has been
         escalated to HR for review as the manager SLA window has passed.
```

---

### `registration.pending.employee`
**Trigger:** Employee completes self-registration form.
**Recipients:** Employee

**Template:**
```
Subject: Account Pending Activation — Rockers HR
Body:    Hi {{employee_name}}, thank you for registering. Your profile is currently
         under HR review. You will receive a confirmation email once your account is activated.
```

### `registration.pending.hr`
**Trigger:** Employee completes self-registration form.
**Recipients:** HR Admin

**Template:**
```
Subject: New Registration Pending Activation — {{employee_name}}
Body:    {{employee_name}} has completed self-registration and is awaiting HR activation.
         Please review their profile in the admin panel.
```

---

### `registration.activated`
**Trigger:** HR Admin activates a pending registration.
**Recipients:** Employee

**Template:**
```
Subject: Your Rockers HR Account is Active!
Body:    Hi {{employee_name}}, welcome to Rockers HR! Your account has been activated.
         You can now log in at [APP_URL] using your Gmail account.
         Your leave balance has been set up and ready to use.
```

---

### `balance.expiry`
**Trigger:** Scheduled job on December `balance.expiry_reminder_day` (default: 20th).
**Recipients:** All employees with unused balance > 0

**Template:**
```
Subject: Unused Leave Expiring December 31 — Action Required
Body:    Hi {{employee_name}}, you have {{days}} unused {{leave_type}} days remaining
         that will expire on December 31, {{year}}.
         Unused leave does not carry forward. Please plan your time accordingly.
```

---

## Notification Service (NestJS)

### Architecture

```
BusinessService (e.g., LeaveService)
        │
        ▼
NotificationService.dispatch(event_key, recipients, tokens)
        │
        ├──→ Render template from master_notification_templates
        ├──→ Insert into notifications table (in-app)
        └──→ Queue email via EmailService (SMTP)
```

### `NotificationService.dispatch`

```typescript
async dispatch(
  eventKey: string,
  recipients: { userId: string; email: string }[],
  tokens: Record<string, string>
): Promise<void>
```

1. Fetch template: `SELECT * FROM master_notification_templates WHERE event_key = $1 AND is_active = true`
2. If template not found → log warning and return (never throws — notifications are non-critical)
3. Render subject and body with token replacement
4. For each recipient:
   - Insert `notifications` row (in-app) if `channel IN ('in_app', 'both')`
   - Enqueue email task if `channel IN ('email', 'both')` and SMTP is configured

### Email Service

```typescript
async sendEmail(to: string, subject: string, body: string): Promise<void>
```

Uses `nodemailer` with SMTP config from env vars. On SMTP failure:
- Log error with full detail
- Mark `notifications.email_sent = false`
- Do NOT throw — leave system continues to function without email
- Retry logic: 3 attempts with exponential backoff (1s, 4s, 9s)

### In-App Notification Storage

```sql
INSERT INTO notifications (user_id, template_id, event_key, rendered_title, rendered_body, channel)
VALUES ($1, $2, $3, $4, $5, $6);
```

**Polling:** Mobile app polls `GET /notifications?is_read=false` every 30 seconds or on app foreground. Polling serves as a fallback — FCM push is the primary delivery mechanism for mobile. See Push Notifications section.
**Web:** Polls every 30 seconds on the notification bell endpoint.

---

## Push Notifications (FCM)

Mobile push notifications are delivered via **Firebase Cloud Messaging (FCM)** using the `firebase-admin` SDK in NestJS.

### FCM Token Registration

On each app launch or login, the Flutter app sends its FCM device token to the backend:

```
PATCH /api/v1/users/me/fcm-token
Body: { "fcm_token": "device-token-string" }
```

The token is stored in `users.fcm_token`. Tokens are refreshed on each app launch to handle token rotation.

### Dispatch Flow

When `NotificationService.dispatch()` fires, push is sent alongside email and in-app:

1. If `channel IN ('in_app', 'both')` and `user.fcm_token IS NOT NULL`:
   - Send FCM push via `firebase-admin` SDK
   - Payload: `{ title: rendered_title, body: rendered_body, data: { event_key, entity_id } }`
   - On success: `notifications.push_sent = true`, `push_sent_at = now()`
   - On failure: log warning, do NOT throw — push is non-critical like email
2. Push notifications piggyback on the `in_app` / `both` channel — no separate `push` channel type needed

### FCM Configuration

```typescript
// NestJS module setup
import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FCM_PROJECT_ID,
    clientEmail: process.env.FCM_CLIENT_EMAIL,
    privateKey: process.env.FCM_PRIVATE_KEY,
  }),
});
```

**Environment variables required:**
- `FCM_PROJECT_ID` — Firebase project ID
- `FCM_CLIENT_EMAIL` — Service account email
- `FCM_PRIVATE_KEY` — Service account private key

If FCM env vars are absent, push notifications are skipped (logged as warnings), same as SMTP behavior.

### Polling as Fallback

The Flutter app retains 30-second polling (`GET /notifications?is_read=false`) as a fallback for:
- Devices where FCM is unavailable (e.g., Huawei without Google Play Services)
- Token expiry edge cases
- Web app (FCM is mobile-only in Phase 1)

---

## SLA Engine (Background Job)

The SLA engine is a NestJS `@Cron` job that runs every minute.

### Business Hours Elapsed Calculation

**Confirmed:** SLA is measured in **business hours only** (`sla.clock_type = business`).

Config keys read at runtime from `master_sla_config`:
- `sla.business_hours_start` → `09:00`
- `sla.business_hours_end` → `18:00`
- `sla.manager_window_hours` → `5`
- `sla.reminder_at_hours` → `4`

```typescript
function calcBusinessHoursElapsed(from: Date, to: Date, config: SlaConfig): number {
  const holidays = getHolidaysForYear(to.getFullYear()); // Set<string> from master_public_holidays
  let elapsed = 0;
  let cursor = new Date(from);

  while (cursor < to) {
    const dow = cursor.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidays.has(toDateString(cursor));

    if (!isWeekend && !isHoliday) {
      const dayStart = setTime(cursor, config.businessHoursStart); // 09:00
      const dayEnd   = setTime(cursor, config.businessHoursEnd);   // 18:00
      const windowStart = cursor < dayStart ? dayStart : cursor;
      const windowEnd   = to < dayEnd ? to : dayEnd;

      if (windowStart < windowEnd) {
        elapsed += (windowEnd.getTime() - windowStart.getTime()) / 3_600_000;
      }
    }
    cursor = nextDayStart(cursor); // advance to next calendar day at 00:00
  }
  return elapsed;
}
```

**Example:** Request submitted Friday 17:00.
- Friday 17:00–18:00 = 1 business hour consumed.
- Saturday + Sunday skipped entirely.
- Monday 09:00 resumes. Reminder (4h) fires Monday 13:00. Escalation (5h) fires Monday 14:00.

### Job: `sla-enforcement`

```typescript
@Cron('* * * * *')  // Every minute
async enforceSlaWindows(): Promise<void>
```

**Query — find pending L1 approvals needing reminder:**
```sql
SELECT la.*, lr.user_id, lr.id AS request_id
FROM leave_approvals la
JOIN leave_requests lr ON lr.id = la.leave_request_id
WHERE la.level = 1
  AND la.action IS NULL
  AND la.escalated = false
  AND la.reminder_sent = false
  AND la.reminder_deadline <= now()
```

**For each:** Send `sla.reminder` notification to manager, set `reminder_sent = true`.

**Query — find pending L1 approvals needing escalation:**
```sql
SELECT la.*, lr.user_id, lr.id AS request_id
FROM leave_approvals la
JOIN leave_requests lr ON lr.id = la.leave_request_id
WHERE la.level = 1
  AND la.action IS NULL
  AND la.escalated = false
  AND la.sla_deadline <= now()
```

**For each:**
- Set `leave_approvals.escalated = true`, `escalated_at = now()`
- Set `leave_requests.status = 'ESCALATED'`
- Create level-2 approval record for HR
- Send `sla.escalated` notifications to HR + employee
- Audit log: `action='leave.escalate'`

> **Note:** Both `sla_deadline` and `reminder_deadline` are pre-computed in business hours at approval record creation time using `calcBusinessHoursElapsed()`. The cron job performs simple timestamp comparisons — no per-minute recalculation needed.

**No-manager path:** Requests where `user.manager_id IS NULL` are created directly as `PENDING_L2`. The SLA engine ignores them at Level 1 — they have no Level 1 approval record and go straight to HR.

**SLA config reads:** Config values read from `master_sla_config` on each job run — changes take effect without a restart.

### Job: `balance-year-end-reset`

```typescript
@Cron('0 0 1 1 *')  // January 1 at midnight
async resetAnnualBalances(): Promise<void>
```

1. Set `used_days = 0, pending_days = 0` on all `leave_balances` for the ending year (no, the rows are kept — they represent historical fact)
2. Create new `leave_balances` rows for the new year for all active `users` × all active `master_leave_types`
3. `total_days` = `master_leave_types.annual_days` (full allocation; proration only for new joiners)
4. Log: `audit_log: action='balance.year_reset', actor_id=SYSTEM`

### Job: `balance-expiry-reminder`

```typescript
@Cron('0 9 20 12 *')  // December 20 at 9 AM — or read from master_sla_config
async sendBalanceExpiryReminders(): Promise<void>
```

1. Read `balance.expiry_reminder_day` from `master_sla_config`
2. Find all `leave_balances` where `year = current_year` AND `(total_days - used_days - pending_days) > 0`
3. For each, dispatch `balance.expiry` notification to the employee

---

## Unread Notification Count (API)

```
GET /notifications/count
Response: { "data": { "unread": 3 } }
```

Used by web header bell icon and mobile tab badge. Cached for 30 seconds per user.
