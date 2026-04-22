# Database Schema — PostgreSQL

Complete schema for all tables. Master tables share a common base schema. Business tables reference master tables via foreign keys.

---

## Design Rules

- All primary keys: `UUID`, generated with `gen_random_uuid()`
- All timestamps: `TIMESTAMPTZ` (timezone-aware)
- Soft deletes only: `is_active = false`, never `DELETE`
- All foreign keys: `ON DELETE RESTRICT` — no cascading deletes
- All text fields: `TEXT` (not `VARCHAR`) — PostgreSQL handles length constraints via `CHECK`
- All monetary/day values: `DECIMAL` — never `FLOAT`
- JSONB for flexible key-value stores and audit snapshots

---

## Master Tables

### `master_qualifications`
```sql
CREATE TABLE master_qualifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `master_genders`
```sql
CREATE TABLE master_genders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `master_role_types`
```sql
CREATE TABLE master_role_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  system_key  TEXT NOT NULL UNIQUE,  -- "employee" | "manager" — drives NestJS guards, never change
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `master_leave_types`
```sql
CREATE TABLE master_leave_types (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label               TEXT NOT NULL,
  annual_days         INTEGER NOT NULL CHECK (annual_days > 0),
  probation_allowed   BOOLEAN NOT NULL DEFAULT false,
  doc_required        BOOLEAN NOT NULL DEFAULT false,
  doc_threshold_days  INTEGER,                             -- null = always required if doc_required=true
  carry_over          INTEGER NOT NULL DEFAULT 0 CHECK (carry_over = 0),  -- always 0, global policy
  color               TEXT NOT NULL DEFAULT '#6b7280',     -- hex color for calendar UI
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,                                -- internal HR notes, not shown to employees
  created_by          UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `master_leave_durations`
```sql
CREATE TABLE master_leave_durations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,               -- "Full Day", "First Half", "Second Half"
  day_value   DECIMAL(3,2) NOT NULL,       -- 1.0, 0.5, 0.5
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `master_departments`
```sql
CREATE TABLE master_departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,         -- Short code e.g. "ENG", "HR", "FIN"
  manager_id  UUID REFERENCES users(id) ON DELETE SET NULL,  -- optional default manager
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `master_file_types`
```sql
CREATE TABLE master_file_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type   TEXT NOT NULL,
  extension   TEXT NOT NULL,
  max_size_mb INTEGER NOT NULL,
  context     TEXT NOT NULL CHECK (context IN ('profile_photo', 'resume', 'leave_doc')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `master_notification_templates`
```sql
CREATE TABLE master_notification_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key        TEXT NOT NULL UNIQUE,   -- e.g. "leave.submitted", "sla.escalated"
  subject_template TEXT,                   -- email subject; null for in-app only
  body_template    TEXT NOT NULL,
  channel          TEXT NOT NULL CHECK (channel IN ('email', 'in_app', 'both')),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  updated_by       UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `master_sla_config`
```sql
CREATE TABLE master_sla_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key    TEXT NOT NULL UNIQUE,
  config_value  TEXT NOT NULL,
  description   TEXT,
  updated_by    UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed key: `sla.timezone` with default `Asia/Kolkata` — used by the SLA engine for business-hours calculations
```

### `master_public_holidays`
```sql
CREATE TABLE master_public_holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  date        DATE NOT NULL,
  year        INTEGER NOT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(date)
);
CREATE INDEX idx_public_holidays_year ON master_public_holidays(year) WHERE is_active = true;
```

### `master_admin_roles`
```sql
CREATE TABLE master_admin_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '[]',  -- Array of permission key strings
  created_by  UUID REFERENCES admin_users(id) ON DELETE RESTRICT,  -- nullable; NULL for system-seeded records
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Business Tables

### `users`
```sql
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail               TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  phone               TEXT,
  dob                 DATE,
  gender_id           UUID REFERENCES master_genders(id) ON DELETE RESTRICT,
  role_type_id        UUID NOT NULL REFERENCES master_role_types(id) ON DELETE RESTRICT,
  qualification_id    UUID REFERENCES master_qualifications(id) ON DELETE RESTRICT,
  department_id       UUID REFERENCES master_departments(id) ON DELETE SET NULL,
  extra_info          TEXT,
  photo_s3_key        TEXT,
  resume_s3_key       TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT false,  -- false until HR activates
  join_date           DATE,
  confirmation_date   DATE,                            -- join_date + probation period
  manager_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  is_manager          BOOLEAN NOT NULL DEFAULT false,  -- eligible to be assigned as manager for others; set by HR Admin
  registration_method TEXT NOT NULL DEFAULT 'self',    -- "self" | "admin_direct" | "admin_invite" (v2.0)
  fcm_token           TEXT,                             -- Firebase Cloud Messaging device token; updated on each app launch
  -- v2.0 admin-invite flow (AUTH_REGISTRATION.md)
  password_hash            VARCHAR(80),                 -- bcrypt; NULL for pure Google-only accounts
  invite_token             UUID,                        -- set by admin on invite, cleared on activation
  invite_token_expires_at  TIMESTAMPTZ,                 -- now() + 7 days at invite
  first_login_required     BOOLEAN NOT NULL DEFAULT false,  -- true between invite and activation
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_gmail ON users(gmail);
CREATE INDEX idx_users_manager ON users(manager_id) WHERE is_active = true;
```

### `admin_users`
```sql
CREATE TABLE admin_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_id     UUID NOT NULL REFERENCES master_admin_roles(id) ON DELETE RESTRICT,
  password_hash TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)  -- One admin record per user
);
```

### `leave_requests`
```sql
CREATE TABLE leave_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  leave_type_id     UUID NOT NULL REFERENCES master_leave_types(id) ON DELETE RESTRICT,
  duration_type_id  UUID NOT NULL REFERENCES master_leave_durations(id) ON DELETE RESTRICT,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  working_days      DECIMAL(5,2) NOT NULL,
  reason            TEXT NOT NULL,
  doc_s3_key        TEXT,
  status            TEXT NOT NULL DEFAULT 'PENDING_L1'
                      CHECK (status IN ('PENDING_L1','PENDING_L2','APPROVED','DECLINED','CANCELLED','ESCALATED')),
  sandwich_flag     BOOLEAN NOT NULL DEFAULT false,
  submitted_by      UUID REFERENCES users(id) ON DELETE RESTRICT,  -- null = self-submitted
  admin_notes       TEXT,             -- internal admin note when submitted on behalf
  calendar_event_id TEXT,             -- Google Calendar event ID after approval
  cancelled_at      TIMESTAMPTZ,      -- when cancellation occurred
  cancelled_by      UUID REFERENCES users(id) ON DELETE RESTRICT,  -- who cancelled (self or admin)
  cancelled_by_usertype TEXT CHECK (cancelled_by_usertype IN ('user', 'admin')),  -- distinguishes self-cancellation from admin-cancellation
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_requests_user ON leave_requests(user_id, status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
```

### `leave_approvals`
```sql
CREATE TABLE leave_approvals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE RESTRICT,
  level            INTEGER NOT NULL CHECK (level IN (1, 2)),
  approver_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action           TEXT CHECK (action IN ('approved', 'declined')),  -- null = pending
  reason           TEXT,                  -- required when action = declined
  sla_deadline     TIMESTAMPTZ NOT NULL,
  reminder_deadline  TIMESTAMPTZ NOT NULL,  -- pre-computed; reminder fires when now() >= this
  reminder_sent    BOOLEAN NOT NULL DEFAULT false,
  escalated        BOOLEAN NOT NULL DEFAULT false,
  escalated_at     TIMESTAMPTZ,
  actioned_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leave_approvals_pending ON leave_approvals(leave_request_id, level)
  WHERE action IS NULL;
```

### `leave_balances`
```sql
CREATE TABLE leave_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  leave_type_id   UUID NOT NULL REFERENCES master_leave_types(id) ON DELETE RESTRICT,
  year            INTEGER NOT NULL,
  total_days      DECIMAL(5,2) NOT NULL,   -- Annual allocation (may be prorated on join)
  used_days       DECIMAL(5,2) NOT NULL DEFAULT 0,
  pending_days    DECIMAL(5,2) NOT NULL DEFAULT 0,

  UNIQUE(user_id, leave_type_id, year),
  CHECK (used_days >= 0),
  CHECK (pending_days >= 0)
  -- Note: No CHECK(used_days + pending_days <= total_days) — admin may reduce annual_days mid-year. Balance validation enforced in application code.
);

CREATE INDEX idx_leave_balances_user_year ON leave_balances(user_id, year);
```

### `notifications`
```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  template_id     UUID REFERENCES master_notification_templates(id) ON DELETE SET NULL,
  event_key       TEXT NOT NULL,
  rendered_title  TEXT NOT NULL,
  rendered_body   TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'in_app', 'both')),
  is_read         BOOLEAN NOT NULL DEFAULT false,
  email_sent      BOOLEAN NOT NULL DEFAULT false,
  email_sent_at   TIMESTAMPTZ,
  push_sent       BOOLEAN NOT NULL DEFAULT false,
  push_sent_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read)
  WHERE is_read = false;
```

### `audit_log`
```sql
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID NOT NULL,                         -- Admin who performed the action
  action        TEXT NOT NULL,                         -- e.g. "leave.create", "master.leave_types.update"
  method        TEXT,                                  -- e.g. "on_behalf", "admin_direct"
  entity_type   TEXT NOT NULL,                         -- e.g. "leave_request", "user", "master_leave_types"
  entity_id     UUID,
  on_behalf_of  UUID REFERENCES users(id) ON DELETE RESTRICT,
  before_state  JSONB,
  after_state   JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);
```

---

## Key Indexes Summary

```sql
-- Fast lookup of pending manager approvals (SLA job)
CREATE INDEX idx_leave_approvals_sla_check
  ON leave_approvals(sla_deadline, escalated)
  WHERE action IS NULL AND level = 1 AND escalated = false;

-- Fast working-days calculation
CREATE INDEX idx_public_holidays_year_date
  ON master_public_holidays(year, date)
  WHERE is_active = true;

-- Fast leave balance lookup
CREATE INDEX idx_leave_balances_user_year
  ON leave_balances(user_id, year);
```

---

## Database Initialization Order

Due to foreign key dependencies, tables must be created in this order. All master tables can be created first because `created_by` / `updated_by` references to `admin_users` are nullable (no `NOT NULL` constraint).

1. All master tables with no user/employee FK dependencies: `master_admin_roles`, `master_qualifications`, `master_genders`, `master_role_types`, `master_leave_types`, `master_leave_durations`, `master_file_types`, `master_notification_templates`, `master_sla_config`, `master_public_holidays`
2. `users` (references master tables for gender, role_type, qualification)
3. `admin_users` (references `users` and `master_admin_roles`)
4. `master_departments` (references `users` for `manager_id`)
5. `leave_requests`, `leave_balances`, `notifications`, `audit_log`
6. `leave_approvals`

### Bootstrapping Note

The `created_by` / `updated_by` columns on all master tables are intentionally nullable to resolve the circular FK dependency between master tables and `admin_users`. During initial system seeding, these columns are set to `NULL` (indicating system-seeded records). Once the first Super Admin is created, all subsequent admin CRUD operations on master tables will populate `created_by` / `updated_by` with proper `admin_users` references.

---

## Seed Data Script Order

1. Seed all master tables with `created_by = NULL` (system seed — no admin users exist yet):
   - `master_admin_roles` (4 default roles with permissions)
   - `master_genders`, `master_qualifications`, `master_role_types`, `master_leave_durations`
   - `master_file_types` (5 default entries)
   - `master_sla_config` (9 config keys with defaults — includes business hours start/end)
   - `master_notification_templates` (9 event templates)
   - `master_leave_types` (6 default types — day allocations to be set by HR)
2. Create initial Super Admin `users` record (from env var or CLI prompt)
3. Create `admin_users` record linking the Super Admin user to the Super Admin role
4. All subsequent master data changes via the admin panel will have proper `created_by` / `updated_by` values

---

## Audit Log Library

**Confirmed:** `nestjs-audit-logger`

```bash
npm install nestjs-audit-logger
```

Configure in `AppModule` with a custom PostgreSQL storage adapter that writes to the `audit_log` table defined above. All write-path routes (POST, PATCH, DELETE) are automatically intercepted. GET routes excluded.

```typescript
AuditLoggerModule.forRoot({
  storage: new PostgresAuditStorage(dataSource),
  excludeMethods: ['GET'],
  captureRequestBody: true,
  captureIp: true,
})
```

---

## Additional Index — is_manager

```sql
-- Fast manager dropdown population (only active managers)
CREATE INDEX idx_users_is_manager ON users(is_manager, is_active)
  WHERE is_manager = true AND is_active = true;
```
