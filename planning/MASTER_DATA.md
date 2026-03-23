# Master Data Architecture

Unified design for all 11 master tables in Rockers HR. Every dropdown, every configurable policy, and every validation rule is driven by these tables. No values are hardcoded in frontend or backend code.

---

## Core Principle

The entire application is 100% dynamic. All dropdown data is fetched from the API at runtime. When an admin deactivates a master record, it disappears from employee-facing dropdowns on the next page load — without any app deployment.

---

## Base Schema (All Master Tables Inherit This)

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
label       TEXT NOT NULL                  -- Display text shown to users
sort_order  INTEGER NOT NULL DEFAULT 0     -- Controls dropdown display order
is_active   BOOLEAN NOT NULL DEFAULT true  -- false = hidden from dropdowns, data preserved
created_by  UUID REFERENCES admin_users(id)
created_at  TIMESTAMPTZ DEFAULT now()
updated_at  TIMESTAMPTZ DEFAULT now()
```

**Soft delete only.** No master record is ever hard-deleted. Setting `is_active = false` hides it from employee-facing dropdowns while preserving all historical references.

### Base Schema Exceptions

Three master tables diverge from the base schema pattern:

| Table | Divergence | Reason |
|-------|-----------|--------|
| `master_file_types` | No `label` or `sort_order`. Uses `mime_type` + `extension` + `context` as identifiers. | File type records are identified by MIME type, not a human-readable label. |
| `master_notification_templates` | No `label` or `sort_order`. Uses `event_key` as identifier and `subject_template` as display text. | Templates are looked up by machine key, not sorted for dropdown display. |
| `master_sla_config` | No `label`, `sort_order`, `is_active`, or `created_by`. Uses `config_key`/`config_value` key-value pattern. | System configuration is a key-value store, not a dropdown source. |

The generic master controller must handle these exceptions. For the 8 standard tables, the controller uses `label` + `sort_order` for display. For the 3 exceptions, table-specific handling is required.

---

## The 11 Master Tables

### 1. `master_qualifications` — Degree / Qualification

Populates the **Highest Degree** dropdown on the employee registration profile form.

**Managed by:** HR Admin

| Seed Label | Sort | Active | Notes |
|------------|------|--------|-------|
| Secondary / 10th | 1 | ✅ | |
| Higher Secondary / 12th | 2 | ✅ | |
| Diploma | 3 | ✅ | |
| Bachelor's | 4 | ✅ | B.A. / B.Sc. / B.Com / B.E. / B.Tech |
| Master's | 5 | ✅ | M.A. / M.Sc. / M.Com / M.E. / M.Tech / MBA |
| PhD / Doctorate | 6 | ✅ | |
| Other | 7 | ✅ | Triggers a free-text "Specify" field when selected |

HR Admin can add CA, LLB, B.Pharm, Chartered Accountant etc. at any time.

---

### 2. `master_genders` — Gender Options

Populates the **Gender** dropdown on the employee registration profile form.

**Managed by:** Super Admin only

| Seed Label | Sort |
|------------|------|
| Male | 1 |
| Female | 2 |
| Other | 3 |
| Prefer not to say | 4 |

---

### 3. `master_role_types` — Employee Role Types

Populates the **Role Type** dropdown on registration. The `system_key` column maps to the permission system and **cannot be changed without a code change** — it drives NestJS guards.

**Managed by:** Super Admin only

**Extra column:** `system_key TEXT NOT NULL` — immutable identifier used in guards.

| Label | system_key | Access |
|-------|-----------|--------|
| Employee | `employee` | Standard dashboard; no approval access |
| Manager | `manager` | Approval dashboard; team leave view |

> New role types require a new NestJS guard. Super Admin can rename the label but must not edit `system_key`.

---

### 4. `master_leave_types` — Leave Types (Extended Schema)

The most complex master table. Has additional columns beyond the base schema.

**Managed by:** HR Admin / Leave Admin

**Extra columns:**

```sql
label               TEXT NOT NULL           -- Display name e.g. "Casual Leave"
annual_days         INTEGER NOT NULL        -- Days per employee per year; HR sets this
probation_allowed   BOOLEAN DEFAULT false   -- Can probation employees use this type?
doc_required        BOOLEAN DEFAULT false   -- Must employee upload supporting doc?
doc_threshold_days  INTEGER                 -- Min duration that triggers doc requirement
carry_over          INTEGER DEFAULT 0       -- ALWAYS 0; non-editable in UI
color               TEXT                    -- Hex string e.g. #3b82f6 for calendar UI
notes               TEXT                    -- Internal HR notes; not shown to employees
```

**Global carry-over policy: ZERO for all types.**
- The `carry_over` column is present for architectural completeness but the UI makes it non-editable.
- It is always `0`. All unused leave expires December 31. Balances reset to full allocation on January 1.

**Seed leave types (day allocations set by HR Admin post-seeding):**

| Label | Probation Allowed | Doc Required | Doc Threshold | Color |
|------|------------------|-------------|---------------|-------|
| Casual Leave | ✅ | ❌ | — | `#3b82f6` |
| Sick Leave | ✅ | ✅ | 2 days | `#ef4444` |
| Paid Leave | ❌ | ❌ | — | `#10b981` |
| Medical Leave | ❌ | ✅ | 1 day | `#f59e0b` |
| Emergency Leave | ✅ | ❌ | — | `#8b5cf6` |
| Maternity / Paternity | ❌ | ✅ | 1 day | `#ec4899` |

---

### 5. `master_leave_durations` — Leave Duration Types

Populates the **Duration Type** selector on the leave application form. The `day_value` controls how much balance is deducted.

**Managed by:** Super Admin only

**Extra column:** `day_value DECIMAL(3,2) NOT NULL`

| Label | day_value | Sort |
|-------|-----------|------|
| Full Day | 1.0 | 1 |
| First Half (Morning) | 0.5 | 2 |
| Second Half (Afternoon) | 0.5 | 3 |

> Quarter-day (0.25) can be added by Super Admin later with no code change.

---

### 6. `master_departments` — Departments

Populates the **Department** field on employee profiles and provides filter options in reports.

**Managed by:** HR Admin

**Extra columns:**
```sql
code        TEXT        -- Short code e.g. "ENG", "HR", "FIN"
manager_id  UUID        -- Optional default manager for the department (FK users)
```

---

### 7. `master_file_types` — Allowed File Types

Controls **all upload validation** across the application. NestJS upload interceptors query this table at runtime — no MIME types or extensions are hardcoded.

**Managed by:** Super Admin only

**Extra columns:**
```sql
mime_type       TEXT NOT NULL   -- e.g. "image/jpeg"
extension       TEXT NOT NULL   -- e.g. ".jpg"
max_size_mb     INTEGER NOT NULL
context         TEXT            -- "profile_photo" | "resume" | "leave_doc"
```

**Default seed values:**

| MIME Type | Extension | Max Size | Context |
|-----------|-----------|----------|---------|
| image/jpeg | .jpg / .jpeg | 2 MB | profile_photo |
| image/png | .png | 2 MB | profile_photo |
| application/pdf | .pdf | 5 MB | resume, leave_doc |
| application/msword | .doc | 5 MB | resume |
| application/vnd.openxmlformats-officedocument.wordprocessingml.document | .docx | 5 MB | resume |

Super Admin can add image/heic for iPhone photos or change size limits without any code deployment.

---

### 8. `master_notification_templates` — Notification Templates

Stores all email and in-app notification content. Templates use `{{token}}` placeholders replaced at send time.

**Managed by:** Super Admin only

**Extra columns:**
```sql
event_key         TEXT NOT NULL UNIQUE    -- Machine identifier for each event
subject_template  TEXT                    -- Email subject (can use tokens)
body_template     TEXT NOT NULL           -- Email body / in-app text with tokens
channel           TEXT NOT NULL           -- "email" | "in_app" | "both"
-- Push notifications (FCM) are automatically sent for any template with channel = 'in_app'
-- or channel = 'both' when the user has a registered FCM token. No separate 'push' channel
-- value is needed.
updated_by        UUID REFERENCES admin_users(id)
```

**Available tokens:** `{{employee_name}}`, `{{leave_type}}`, `{{dates}}`, `{{start_date}}`, `{{end_date}}`, `{{manager_name}}`, `{{reason}}`, `{{sla_remaining}}`, `{{days}}`, `{{admin_name}}`

**Event catalogue:**

| event_key | Subject | Channel |
|-----------|---------|---------|
| `leave.submitted.employee` | Leave Request Submitted | both |
| `leave.submitted.manager` | Approval Required: New Leave Request | both |
| `leave.approved.l1.employee` | Leave Approved by Manager | both |
| `leave.approved.l1.hr` | Leave Awaiting Final Approval | both |
| `leave.approved.l2` | Leave Fully Approved | both |
| `leave.declined` | Leave Request Declined | both |
| `sla.reminder` | Approval Required — SLA Alert | both |
| `sla.escalated.hr` | Leave Escalated to HR | both |
| `sla.escalated.employee` | Your Leave Request Has Been Escalated | both |
| `registration.pending.employee` | Account Pending Activation | email |
| `registration.pending.hr` | New Registration Pending Review | email |
| `registration.activated` | Account Activated | email |
| `balance.expiry` | Unused Leave Expiring | both |

> See `NOTIFICATIONS.md` for full body template examples and token replacement logic.

---

### 9. `master_sla_config` — SLA & System Configuration

Key-value store for all system-level time and threshold settings.

**Managed by:** Super Admin only

**Extra columns:**
```sql
config_key    TEXT NOT NULL UNIQUE
config_value  TEXT NOT NULL
description   TEXT
updated_by    UUID REFERENCES admin_users(id)
```

**All config keys and defaults:**

| config_key | Default | Description |
|------------|---------|-------------|
| `sla.manager_window_hours` | `5` | Business hours before auto-escalation |
| `sla.reminder_at_hours` | `4` | Business hour mark at which reminder is sent |
| `sla.clock_type` | `business` | **Confirmed: business hours only** (Mon–Fri, excl. public holidays) |
| `sla.business_hours_start` | `09:00` | Business day start time (HH:MM, 24-hr) |
| `sla.business_hours_end` | `18:00` | Business day end time (HH:MM, 24-hr) |
| `sla.timezone` | `Asia/Kolkata` | Timezone for business hours calculation (IANA format) |
| `probation.duration_months` | `3` | Leave blocked for this many months after join date |
| `balance.reset_day` | `1` | Day of January when balances reset |
| `balance.expiry_reminder_day` | `20` | December day when year-end expiry reminder is sent |
| `calendar.event_title_format` | `[{{leave_type}}] {{employee_name}}` | Google Calendar event title |

---

### 10. `master_public_holidays` — Public Holidays

Used to accurately calculate working days in leave requests and to detect sandwich leave scenarios.

**Managed by:** HR Admin

**Extra columns:**
```sql
date         DATE NOT NULL
year         INTEGER NOT NULL       -- Indexed for fast year-based lookup
is_optional  BOOLEAN DEFAULT false  -- Optional / restricted holidays
```

HR Admin manages holidays per year. Holidays for the upcoming year should be seeded by December of the current year.

---

### 11. `master_admin_roles` — Admin Roles & Permissions

Stores admin role definitions and their JSONB permission keys.

**Managed by:** Super Admin only

**Extra columns:**
```sql
name         TEXT NOT NULL
permissions  JSONB NOT NULL   -- Array of permission keys e.g. ["leave.approve", "reports.view"]
updated_by   UUID REFERENCES admin_users(id)
```

**Default roles:** Super Admin, HR Manager, Leave Admin, Reports Admin.

> See `ADMIN_RBAC.md` for the full permission matrix.

---

## Master Data API Pattern (NestJS)

All 11 master tables are served by a **single generic NestJS module**. The table name is a route parameter validated against an allowlist.

```
GET    /api/v1/master/:table          Returns active records. Employee + admin use.
GET    /api/v1/master/:table/all      Returns all records including inactive. Admin only.
POST   /api/v1/master/:table          Creates a new master record.
PATCH  /api/v1/master/:table/:id      Updates label, sort_order, or is_active.
DELETE /api/v1/master/:table/:id      Soft-delete: sets is_active = false. Never hard-deletes.
```

**Response shape for `GET /master/:table`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "label": "Casual Leave",
      "sort_order": 1,
      "is_active": true
      // ... table-specific extra fields
    }
  ]
}
```

**Table name allowlist** (validated in NestJS pipe):
```
qualifications | genders | role_types | leave_types | leave_durations |
departments | file_types | notification_templates | sla_config | public_holidays | admin_roles
```

Any request with a table name outside this allowlist returns `400 Bad Request`.

---

## Frontend / Flutter Implementation Pattern

```typescript
// On page load (Next.js)
const [leaveTypes, genders, qualifications] = await Promise.all([
  fetch('/api/v1/master/leave_types').then(r => r.json()),
  fetch('/api/v1/master/genders').then(r => r.json()),
  fetch('/api/v1/master/qualifications').then(r => r.json()),
]);
// Cache in session or React context for the duration of the session
```

```dart
// Flutter: fetch on first launch, refresh on pull-to-refresh
final masterData = await MasterDataService.fetchAll([
  'leave_types', 'genders', 'qualifications', 'departments', 'leave_durations'
]);
// Store in local state; refresh periodically or on app resume
```

**Rules:**
- No hardcoded option arrays anywhere in frontend or Flutter code.
- Inactive records (`is_active: false`) are never shown to employees.
- Admin dropdown for "all records" fetches from `/master/:table/all`.
- On sort_order change by admin, frontend reflects new order on next load.

---

## Lifecycle: Adding a New Leave Type

1. HR Admin opens Admin Panel → Leave Types → Add Type
2. Fills in: label, annual_days, probation_allowed, doc_required, color
3. Saves → `POST /api/v1/master/leave_types` → new row inserted
4. Immediately visible in employee leave application dropdown on next page load
5. Leave balance rows auto-created for all active employees for the current year
6. Audit log records: `master.leave_type.create` — actor: [Admin Name]

No developer involvement. No deployment. No restart.
