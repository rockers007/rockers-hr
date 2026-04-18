# PAYROLL_DATABASE_SCHEMA.md

**Scope:** All payroll-specific PostgreSQL tables, indexes, enums, and constraints. Users, departments, leave_requests, overtime_requests, and audit_log are already defined in the existing `DATABASE_SCHEMA.md` (leave module) and are only extended here.
**Version:** v2.3

Cross-refs:
- Master tables → `PAYROLL_MASTER_DATA.md`
- Run lifecycle → `PAYROLL_WORKFLOW.md`
- Calculation rules → `PAYROLL_CALCULATION_ENGINE.md`

---

## 1. Extensions to Existing `users` Table

New columns added to the shared `users` table to support payroll. These live in the same table (not a separate `employee_payroll_profile`) because every employee has a salary and these fields are read very frequently.

```sql
ALTER TABLE users
  ADD COLUMN gross NUMERIC(10,2) DEFAULT 0 NOT NULL,
  ADD COLUMN incentive NUMERIC(10,2) DEFAULT 0 NOT NULL,
  ADD COLUMN tds NUMERIC(10,2) DEFAULT 0 NOT NULL,
  ADD COLUMN loan_emi NUMERIC(10,2) DEFAULT 0 NOT NULL,
  ADD COLUMN sal_deduction NUMERIC(10,2) DEFAULT 0 NOT NULL,
  ADD COLUMN security_return NUMERIC(10,2) DEFAULT 0 NOT NULL,
  ADD COLUMN pf_applicable BOOLEAN DEFAULT TRUE NOT NULL,
  ADD COLUMN bank_name VARCHAR(100),
  ADD COLUMN bank_account_no VARCHAR(40),
  ADD COLUMN bank_ifsc VARCHAR(15),
  ADD COLUMN dob DATE,                -- needed for payslip PDF password (DDMM)
  ADD COLUMN emp_number VARCHAR(30) UNIQUE,   -- e.g., RT-DEV-153
  ADD COLUMN designation VARCHAR(100);        -- e.g., 'FULL STACK DEVELOPER' — shown on payslip Zone 2 (v2.3, Review G6)
```

Notes:
- `gross`, `incentive`, `tds`, `loan_emi`, `sal_deduction`, `security_return` are the **current live values**. At each payroll run, they are snapshotted into `payroll_run_employees` per D20.
- `security_return` is typically a one-time or occasional return (e.g., security deposit refund). It defaults to `0` and should be **manually zeroed out by admin after the run in which it was paid**, otherwise it carries forward to the next run's snapshot. Admins can also override it per-run in Step 4 Review without changing the user-level value. *(v2.3 — Review item I3)*
- `pf_applicable` supports the edge case where an employee has opted out of PF above the threshold (e.g., ABC in the sample salary sheet was PF-exempt).
- `dob` is nullable — but payroll release will refuse to send a payslip for an employee with NULL dob (no password possible).
- `emp_number` is free-form like `RT-DEV-153` (Rockers Technologies – Developer – 153).
- `designation` is free-text set by admin. Required for payslip rendering (Zone 2). *(v2.3 — Review item G6)*

## 2. `payroll_runs` — Run Lifecycle Table

One row per month per company.

```sql
CREATE TYPE payroll_run_state AS ENUM (
  'DRAFT',
  'IN_PROGRESS',
  'REVIEW',
  'LOCKED',
  'RELEASED',
  'BANK_FILE_APPROVED',
  'BANK_FILE_GENERATED',
  'CANCELLED'
);

CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL CHECK (year BETWEEN 2024 AND 2100),
  payroll_cycle_days SMALLINT NOT NULL DEFAULT 30,   -- always 30 per D1
  state payroll_run_state NOT NULL DEFAULT 'DRAFT',
  total_employees INT NOT NULL DEFAULT 0,
  total_net_payable NUMERIC(14,2) DEFAULT 0,
  total_employer_pf NUMERIC(12,2) DEFAULT 0,
  total_employee_pf NUMERIC(12,2) DEFAULT 0,
  total_pt NUMERIC(10,2) DEFAULT 0,
  total_tds NUMERIC(12,2) DEFAULT 0,
  total_incentive NUMERIC(12,2) DEFAULT 0,
  total_ot_pay NUMERIC(12,2) DEFAULT 0,

  release_date DATE,                             -- admin-chosen per D13
  imported_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  bank_file_approved_at TIMESTAMPTZ,
  bank_file_generated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  created_by UUID NOT NULL REFERENCES users(id),
  locked_by UUID REFERENCES users(id),
  released_by UUID REFERENCES users(id),
  bank_file_approved_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active (non-cancelled) run per month+year
CREATE UNIQUE INDEX idx_payroll_runs_active
  ON payroll_runs (month, year)
  WHERE state <> 'CANCELLED';

CREATE INDEX idx_payroll_runs_state ON payroll_runs (state);
CREATE INDEX idx_payroll_runs_year_month ON payroll_runs (year DESC, month DESC);
```

## 3. `payroll_run_employees` — Per-Employee Snapshot

Frozen at Step 2 (import). Contains the structural data for this employee for this run.

```sql
CREATE TABLE payroll_run_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),

  -- snapshot of employee salary structure at Step 2
  snapshot_gross NUMERIC(10,2) NOT NULL,
  snapshot_incentive NUMERIC(10,2) NOT NULL DEFAULT 0,
  snapshot_tds NUMERIC(10,2) NOT NULL DEFAULT 0,
  snapshot_loan_emi NUMERIC(10,2) NOT NULL DEFAULT 0,
  snapshot_sal_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
  snapshot_security_return NUMERIC(10,2) NOT NULL DEFAULT 0,
  snapshot_pf_applicable BOOLEAN NOT NULL,

  -- snapshot of master data at Step 2
  snapshot_components JSONB NOT NULL,      -- [{code:'BASIC',pct:50},...] length 7, sums to 100
  snapshot_statutory JSONB NOT NULL,       -- {pf_cap:15000, pt_flat:200, ot_multiplier:1.5, ot_div_day:30, ot_div_hour:9, esic_active:false, esic_er_rate:0.0325, esic_ee_rate:0.0075}

  -- imported leave & OT counters
  lwp_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  cl_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  sl_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  pl_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  wfh_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  comp_off_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  el_hours NUMERIC(6,2) NOT NULL DEFAULT 0,       -- informational only — displayed on payslip working details, no salary impact (v2.3, Review G5)
  ot_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  present_days NUMERIC(5,2) NOT NULL DEFAULT 30,   -- WD - LWP per D10

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, user_id)
);

CREATE INDEX idx_pre_run ON payroll_run_employees (run_id);
CREATE INDEX idx_pre_user ON payroll_run_employees (user_id);
```

## 4. `payroll_items` — The Computed Salary Rows

The actual computed output of the calculation engine. One active row per `(run_id, user_id)`. Edits in Step 4 soft-delete the old row (by setting `superseded_at`) and write a new one. This preserves edit history.

```sql
CREATE TABLE payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,   -- v2.3: RESTRICT protects released data
  user_id UUID NOT NULL REFERENCES users(id),
  run_employee_id UUID NOT NULL REFERENCES payroll_run_employees(id),

  -- salary for calc
  lwp_deduction NUMERIC(10,2) NOT NULL,
  sal_for_calc NUMERIC(10,2) NOT NULL,

  -- 7 earning components (actual = on gross; payable = on sal_for_calc)
  basic_actual NUMERIC(10,2) NOT NULL,
  basic_payable NUMERIC(10,2) NOT NULL,
  hra_actual NUMERIC(10,2) NOT NULL,
  hra_payable NUMERIC(10,2) NOT NULL,
  sp_allow_actual NUMERIC(10,2) NOT NULL,
  sp_allow_payable NUMERIC(10,2) NOT NULL,
  conveyance_actual NUMERIC(10,2) NOT NULL,
  conveyance_payable NUMERIC(10,2) NOT NULL,
  ltc_actual NUMERIC(10,2) NOT NULL,
  ltc_payable NUMERIC(10,2) NOT NULL,
  re_medical_actual NUMERIC(10,2) NOT NULL,
  re_medical_payable NUMERIC(10,2) NOT NULL,
  education_actual NUMERIC(10,2) NOT NULL,
  education_payable NUMERIC(10,2) NOT NULL,

  -- additions
  fix_variable NUMERIC(10,2) NOT NULL DEFAULT 0,       -- incentive
  ot_per_hour NUMERIC(8,2) NOT NULL DEFAULT 0,
  ot_rate NUMERIC(8,2) NOT NULL DEFAULT 0,
  ot_pay NUMERIC(10,2) NOT NULL DEFAULT 0,
  security_return NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- PF
  employee_pf NUMERIC(8,2) NOT NULL DEFAULT 0,
  employer_pf NUMERIC(8,2) NOT NULL DEFAULT 0,          -- in CTC only, not a deduction

  -- ESIC (scaffolded, inactive)
  employee_esic NUMERIC(8,2) NOT NULL DEFAULT 0,
  employer_esic NUMERIC(8,2) NOT NULL DEFAULT 0,
  esic_applied BOOLEAN NOT NULL DEFAULT FALSE,

  -- other deductions
  professional_tax NUMERIC(8,2) NOT NULL DEFAULT 0,    -- value set by engine from statutory.pt_flat_amount; DB default is 0, not 200 (v2.3, Review D1 — zero-hardcoded principle)
  tds NUMERIC(10,2) NOT NULL DEFAULT 0,
  loan_emi NUMERIC(10,2) NOT NULL DEFAULT 0,
  sal_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- totals
  total_earnings NUMERIC(12,2) NOT NULL,
  total_deductions NUMERIC(12,2) NOT NULL,
  net_payable NUMERIC(12,2) NOT NULL,
  ctc NUMERIC(12,2) NOT NULL,
  ctc_as_per_it NUMERIC(12,2) NOT NULL,

  -- edit tracking
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  superseded_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES payroll_items(id),

  calculation_version SMALLINT NOT NULL DEFAULT 1,    -- incremented per recalc
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (net_payable >= 0),
  CHECK (total_earnings >= total_deductions OR net_payable = 0)
);

-- Exactly one current row per (run,user)
CREATE UNIQUE INDEX idx_payroll_items_current
  ON payroll_items (run_id, user_id)
  WHERE is_current = TRUE;

CREATE INDEX idx_payroll_items_run ON payroll_items (run_id);
CREATE INDEX idx_payroll_items_user ON payroll_items (user_id);
```

## 5. `payslip_deliveries` — Payslip PDF Delivery Log

Tracks each payslip PDF generation and email delivery attempt.

```sql
CREATE TYPE payslip_delivery_status AS ENUM (
  'PENDING', 'GENERATED', 'EMAILED', 'FAILED', 'BOUNCED'
);

CREATE TABLE payslip_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,   -- v2.3: RESTRICT protects released data
  user_id UUID NOT NULL REFERENCES users(id),
  payroll_item_id UUID NOT NULL REFERENCES payroll_items(id),

  s3_key TEXT,                            -- s3://rockers-hr-payslips/{year}/{month}/{emp_id}.pdf
  s3_url_signed TEXT,                     -- short-lived signed URL; regenerated on demand
  pdf_size_bytes INT,
  pdf_password_hint VARCHAR(8) NOT NULL DEFAULT 'DOB in DDMM',

  status payslip_delivery_status NOT NULL DEFAULT 'PENDING',
  sent_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count SMALLINT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (run_id, user_id)
);

CREATE INDEX idx_psd_status ON payslip_deliveries (status);
CREATE INDEX idx_psd_run ON payslip_deliveries (run_id);
```

## 6. `bank_change_requests` — Employee Bank Detail Change Flow

Submitted by employee, approved/rejected by admin, takes effect next payroll.

```sql
CREATE TYPE bank_change_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE bank_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),

  current_bank_name VARCHAR(100),
  current_account_no VARCHAR(40),
  current_ifsc VARCHAR(15),

  new_bank_name VARCHAR(100) NOT NULL,
  new_account_no VARCHAR(40) NOT NULL,
  new_ifsc VARCHAR(15) NOT NULL,

  -- optional proof doc uploaded by employee (cancelled cheque, etc.)
  proof_s3_key TEXT,

  status bank_change_status NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from_run_id UUID REFERENCES payroll_runs(id)  -- which run first used new details
);

CREATE INDEX idx_bcr_user ON bank_change_requests (user_id);
CREATE INDEX idx_bcr_status ON bank_change_requests (status);

-- Only one PENDING per user
CREATE UNIQUE INDEX idx_bcr_pending_per_user
  ON bank_change_requests (user_id)
  WHERE status = 'PENDING';
```

## 7. `investment_proofs` — Employee Self-Service Upload

Stores investment proof documents that employees upload for tax (80C, HRA rent receipts, etc.). No processing in Phase 1 — storage + visibility only.

```sql
CREATE TABLE investment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  financial_year VARCHAR(9) NOT NULL,       -- '2025-2026' format
  category VARCHAR(50) NOT NULL,            -- '80C', 'HRA', '80D', 'Other', etc.
  description TEXT,
  amount NUMERIC(10,2),
  s3_key TEXT NOT NULL,
  file_size_bytes INT,
  mime_type VARCHAR(50),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, financial_year, s3_key)
);

CREATE INDEX idx_ip_user_fy ON investment_proofs (user_id, financial_year);
```

## 8. `bank_transfer_files` — Generated NEFT/RTGS Files

```sql
CREATE TYPE bank_file_type AS ENUM ('NEFT', 'RTGS', 'MIXED');

CREATE TABLE bank_transfer_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,   -- v2.3: RESTRICT protects released data
  file_type bank_file_type NOT NULL DEFAULT 'NEFT',
  employee_count INT NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  s3_key TEXT NOT NULL,
  file_format VARCHAR(30) NOT NULL DEFAULT 'BANK_CUSTOM',  -- TBC per client bank

  is_latest BOOLEAN NOT NULL DEFAULT TRUE,          -- v2.3 (Review D4): allows regeneration; only one latest per run

  approved_by UUID NOT NULL REFERENCES users(id),
  approved_at TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2.3: relaxed from UNIQUE(run_id) to partial unique — allows multiple files per run but only one marked latest
CREATE UNIQUE INDEX idx_btf_latest_per_run
  ON bank_transfer_files (run_id)
  WHERE is_latest = TRUE;
```

## 9. YTD Aggregation View (Financial Year Apr–Mar)

Rather than maintaining a denormalized YTD table, use a view that aggregates from `payroll_items`. The FY boundary is April 1 per D12.

```sql
CREATE OR REPLACE VIEW v_employee_ytd AS
SELECT
  pi.user_id,
  CASE
    WHEN pr.month >= 4 THEN pr.year || '-' || (pr.year + 1)
    ELSE (pr.year - 1) || '-' || pr.year
  END AS financial_year,
  SUM(pi.sal_for_calc) AS ytd_sal_for_calc,
  SUM(pi.total_earnings) AS ytd_earnings,
  SUM(pi.employee_pf) AS ytd_employee_pf,
  SUM(pi.employer_pf) AS ytd_employer_pf,
  SUM(pi.professional_tax) AS ytd_pt,
  SUM(pi.tds) AS ytd_tds,
  SUM(pi.net_payable) AS ytd_net_payable,
  COUNT(*) AS months_processed
FROM payroll_items pi
JOIN payroll_runs pr ON pr.id = pi.run_id
WHERE pi.is_current = TRUE
  AND pr.state IN ('RELEASED', 'BANK_FILE_APPROVED', 'BANK_FILE_GENERATED')
GROUP BY pi.user_id, financial_year;

-- v2.3 (Review D5): composite index for YTD view query pattern
CREATE INDEX idx_payroll_items_user_ytd
  ON payroll_items (user_id)
  WHERE is_current = TRUE;
```

## 10. Indexes Summary

| Table | Index | Purpose |
| --- | --- | --- |
| `payroll_runs` | `idx_payroll_runs_active` (partial unique) | One active run per month |
| `payroll_runs` | `idx_payroll_runs_state` | Dashboard "runs in progress" |
| `payroll_runs` | `idx_payroll_runs_year_month` | History list |
| `payroll_run_employees` | `idx_pre_run`, `idx_pre_user` | Run + employee lookups |
| `payroll_items` | `idx_payroll_items_current` (partial unique) | Current row per employee per run |
| `payroll_items` | `idx_payroll_items_run`, `_user` | Reports + history |
| `payslip_deliveries` | `idx_psd_status`, `_run` | Retry failed deliveries |
| `bank_change_requests` | `idx_bcr_pending_per_user` (partial unique) | One pending request per user |
| `payroll_items` | `idx_payroll_items_user_ytd` (v2.3) | YTD view performance: `(user_id) WHERE is_current = TRUE` |
| `bank_transfer_files` | `idx_btf_latest_per_run` (v2.3) | One latest file per run (partial unique) |
| `investment_proofs` | `idx_ip_user_fy` | Employee portal listing |

## 11. Audit Log Integration

All payroll table mutations use `nestjs-audit-logger` (D18). No separate payroll audit table. Expected event names (see `PAYROLL_RBAC.md` §5 for the full list):

- `payroll.run.created`
- `payroll.run.imported`
- `payroll.run.calculated`
- `payroll.run.item_edited`
- `payroll.run.locked`
- `payroll.run.released`
- `payroll.run.cancelled`
- `payroll.bank_file.approved`
- `payroll.bank_file.downloaded`
- `payroll.bank_change.submitted`
- `payroll.bank_change.approved`
- `payroll.bank_change.rejected`
- `payroll.salary.config_updated`
- `payroll.master.component_updated`
- `payroll.payslip.sent`
- `payroll.payslip.retried`

## 12. Foreign Key Cascade Strategy (updated v2.3)

> **v2.3 (Review item D2):** Changed `payroll_items`, `payslip_deliveries`, and `bank_transfer_files` from CASCADE to RESTRICT. This prevents accidental deletion of released payroll data via direct SQL. Only `payroll_run_employees` uses CASCADE for draft/cancelled run cleanup.

- `payroll_runs` → `ON DELETE RESTRICT` on `users` (creator/locker/releaser never deleted)
- `payroll_run_employees` → `ON DELETE CASCADE` from `payroll_runs` (draft/cancelled run cleanup only)
- `payroll_items` → `ON DELETE RESTRICT` from `payroll_runs` *(v2.3 — protects locked/released data)*
- `payslip_deliveries` → `ON DELETE RESTRICT` from `payroll_runs` *(v2.3)*
- `bank_transfer_files` → `ON DELETE RESTRICT` from `payroll_runs` *(v2.3)*
- Released runs should **never** be deleted in practice; RESTRICT enforces this at DB layer. To clean up a cancelled run's child data, delete `payroll_items` and `payslip_deliveries` first, then delete the run.

## 13. Data Retention

- **Payslip PDFs on S3:** kept indefinitely per Indian statutory retention (minimum 7 years; actual retention TBD with client — see `PAYROLL_OPEN_QUESTIONS.md`)
- **Bank transfer files on S3:** kept 3 years minimum
- **Investment proofs on S3:** kept through end of FY + 1 year

---

*End of PAYROLL_DATABASE_SCHEMA.md. Next: PAYROLL_MASTER_DATA.md — the zero-hardcoded-values store.*
