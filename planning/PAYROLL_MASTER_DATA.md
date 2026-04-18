# PAYROLL_MASTER_DATA.md

**Scope:** All admin-configurable master data for payroll. Enforces the core architectural principle: **zero hardcoded values**.
**Version:** v2.3

Cross-refs:
- Schema of each table → `PAYROLL_DATABASE_SCHEMA.md`
- How values are consumed → `PAYROLL_CALCULATION_ENGINE.md`
- Admin permissions → `PAYROLL_RBAC.md` §3

---

## 1. Principle

Every rate, percentage, cap, flag, or enum that influences salary calculation must be:
1. Stored in a master table (not `const` in code).
2. Editable by an admin with the right permission.
3. **Effective from next payroll run** — never retroactive (D20 from PLAN.md).
4. Snapshotted into the run at Step 2 so in-flight runs are immune to master data changes.

## 2. Master Tables Inventory

| # | Table | Purpose | Who Edits |
| --- | --- | --- | --- |
| 1 | `payroll_salary_components` | The 7 earning components (Basic/HRA/SP/Conv/LTC/Med/Edu) and their % of Sal for Calc | Super Admin only |
| 2 | `payroll_statutory_config` | PF cap, PT flat amount, OT multiplier, OT divisors, ESIC rates + active flag | Super Admin only |
| 3 | `payroll_deduction_types` | Enum of deduction types shown on payslip (PF, ESIC, PT, TDS, Security, Loan, Sal Deduction) | Super Admin only |
| 4 | `payroll_earning_types` | Enum of earning additions beyond the 7 components (Fix Variable, OT, Bonus...) | Super Admin only |
| 5 | `payroll_bank_file_formats` | Bank file format templates (NEFT, RTGS, per-client) | Super Admin only |
| 6 | `company_profile` | ROCKERS TECHNOLOGIES address, logo, footer text on payslip | Super Admin only |

> **Note (v2.3):** Working-days config (cycle_days, working_hours_per_day) lives in `payroll_statutory_config` — there is no separate `payroll_working_days_config` table. Single source of truth.

## 3. `payroll_salary_components` — The 7 Components

This is the **most critical** master table. The 7 rows must sum to exactly 100%.

```sql
CREATE TABLE payroll_salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,           -- 'BASIC', 'HRA', 'SP_ALLOW', 'CONVEYANCE', 'LTC', 'RE_MEDICAL', 'EDUCATION'
  display_name VARCHAR(60) NOT NULL,          -- 'Basic Salary', 'HRA', 'Special Allowances', ...
  payslip_label VARCHAR(30) NOT NULL,         -- 'BASIC', 'HRA', 'SP. ALLOWANCES', 'CONVEYANCE', 'LTC', 'RE. MEDICAL', 'EDU. ALLOWANCES'
  percentage NUMERIC(5,2) NOT NULL,           -- 50.00, 20.00, 15.00, 7.00, 5.00, 2.00, 1.00
  display_order SMALLINT NOT NULL,            -- 1..7 (for payslip row order)
  is_pf_base BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE only on BASIC (for PF calculation)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App-layer invariant: SUM(percentage) WHERE is_active = 100.00 (±0.01 tolerance)
-- Enforced at admin update API before commit.
```

### 3.1 Seed Data (v2.2)

| code | display_name | payslip_label | percentage | display_order | is_pf_base |
| --- | --- | --- | --- | --- | --- |
| `BASIC` | Basic Salary | `BASIC` | 50.00 | 1 | **TRUE** |
| `HRA` | House Rent Allowance | `HRA` | 20.00 | 2 | FALSE |
| `SP_ALLOW` | Special Allowances | `SP. ALLOWANCES` | 15.00 | 3 | FALSE |
| `CONVEYANCE` | Conveyance | `CONVEYANCE` | 7.00 | 4 | FALSE |
| `LTC` | Leave Travel Concession | `LTC` | 5.00 | 5 | FALSE |
| `RE_MEDICAL` | Reimbursement Medical | `RE. MEDICAL` | 2.00 | 6 | FALSE |
| `EDUCATION` | Education Allowances | `EDU. ALLOWANCES` | 1.00 | 7 | FALSE |

**Sum check:** 50 + 20 + 15 + 7 + 5 + 2 + 1 = 100 ✓

### 3.2 Edit Rules

- Only one row with `is_pf_base = TRUE` at any time (must be exactly one).
- All `is_active = TRUE` rows sum to 100.00 (±0.01).
- Admin can add new components, but removing/adding changes the 100% invariant — UI forces admin to rebalance.
- Changes take effect from **next payroll run** only (D20). Currently running payrolls are insulated via `payroll_run_employees.snapshot_components`.

## 4. `payroll_statutory_config` — Rates, Caps, Flags

Single-row configuration table (or one row per named profile if client wants multiple). MVP: single row.

```sql
CREATE TABLE payroll_statutory_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name VARCHAR(50) NOT NULL DEFAULT 'DEFAULT',

  -- PF (D4)
  pf_cap_amount NUMERIC(10,2) NOT NULL DEFAULT 15000.00,
  pf_fixed_at_cap NUMERIC(8,2) NOT NULL DEFAULT 1800.00,       -- statutorily fixed
  pf_rate_below_cap NUMERIC(5,4) NOT NULL DEFAULT 0.1200,      -- 12%
  pf_employer_matches_employee BOOLEAN NOT NULL DEFAULT TRUE,

  -- ESIC (D9)
  esic_active BOOLEAN NOT NULL DEFAULT FALSE,                  -- inactive in MVP
  esic_threshold_gross NUMERIC(10,2) NOT NULL DEFAULT 21000.00,
  esic_employer_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0325,     -- 3.25%
  esic_employee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0075,     -- 0.75%

  -- Professional Tax (D8)
  pt_flat_amount NUMERIC(8,2) NOT NULL DEFAULT 200.00,

  -- OT (D7)
  ot_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.50,            -- 1.5×
  ot_divisor_day NUMERIC(4,0) NOT NULL DEFAULT 30,             -- 30 days
  ot_divisor_hour NUMERIC(4,0) NOT NULL DEFAULT 9,             -- 9 hours per day

  -- General
  payroll_cycle_days SMALLINT NOT NULL DEFAULT 30,             -- D1
  financial_year_start_month SMALLINT NOT NULL DEFAULT 4,      -- D12 — April
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',

  effective_from DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active config at a time
CREATE UNIQUE INDEX idx_psc_active ON payroll_statutory_config (is_active) WHERE is_active = TRUE;
```

### 4.1 Seed (v2.2)

| Field | Value |
| --- | --- |
| `pf_cap_amount` | 15000.00 |
| `pf_fixed_at_cap` | 1800.00 |
| `pf_rate_below_cap` | 0.1200 |
| `pf_employer_matches_employee` | TRUE |
| `esic_active` | **FALSE** |
| `esic_threshold_gross` | 21000.00 |
| `esic_employer_rate` | 0.0325 |
| `esic_employee_rate` | 0.0075 |
| `pt_flat_amount` | 200.00 |
| `ot_multiplier` | 1.50 |
| `ot_divisor_day` | 30 |
| `ot_divisor_hour` | 9 |
| `payroll_cycle_days` | 30 |
| `financial_year_start_month` | 4 (April) |
| `currency` | INR |

### 4.2 Critical Implementation Note — PF Formula

Per D4, the **conditional** form must be used in code, not `MIN()`:

```typescript
// CORRECT — matches statutory fixed ceiling semantics
const pf = basic >= config.pf_cap_amount
  ? config.pf_fixed_at_cap
  : Math.round(basic * config.pf_rate_below_cap);

// INCORRECT — numerically equivalent but conveys wrong intent
// const pf = Math.round(Math.min(basic, config.pf_cap_amount) * config.pf_rate_below_cap);
```

Reason: ₹1,800 is a **statutorily fixed** contribution, not a derived percentage. If EPFO later changes the cap to ₹15,500, the fixed amount may **not** auto-change to `15500 * 0.12 = 1860`. It could remain ₹1,800 or jump to a different statutory figure. The conditional form supports this cleanly; `MIN()` does not.

## 5. ~~`payroll_working_days_config`~~ — REMOVED (v2.3)

> **Resolved (v2.3 — Review item I1):** This table has been removed. Working-day config (`payroll_cycle_days = 30`, `ot_divisor_hour = 9`) lives exclusively in `payroll_statutory_config` (see §4). Single source of truth — no separate table.

## 6. `payroll_earning_types` — Payslip Earning Rows Beyond the 7 Components

Earning lines that aren't auto-calculated from Sal for Calc.

```sql
CREATE TABLE payroll_earning_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  display_name VARCHAR(60) NOT NULL,
  payslip_label VARCHAR(30) NOT NULL,
  is_manual BOOLEAN NOT NULL DEFAULT TRUE,       -- admin enters per-employee per-run
  is_auto_from_leave BOOLEAN NOT NULL DEFAULT FALSE,  -- e.g., OT pay
  display_order SMALLINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

### 6.1 Seed (v2.2)

| code | display_name | payslip_label | is_manual | is_auto_from_leave | order |
| --- | --- | --- | --- | --- | --- |
| `FIX_VARIABLE` | Fix Variable / Incentive | `FIX VARIABLE` | TRUE | FALSE | 8 |
| `OT_PAY` | Overtime Pay | `EXTRA WORKING HRS` | FALSE | TRUE | 9 |
| `SECURITY_RETURN` | Security Return | `SECURITY RETURN` | TRUE | FALSE | 10 |
| `BONUS` | Bonus | `BONUS` | TRUE | FALSE | 11 |

> **Note (v2.3 — Review item G4):** `BONUS` is seeded but **not processed by the calculation engine in MVP**. Bonus payroll runs (Diwali, 13th-month, etc.) are Phase 2 (see `PAYROLL_OPEN_QUESTIONS.md` F10). The row exists so the master data table is ready for Phase 2 without a schema migration. MVP payroll runs should ignore earning types where `code = 'BONUS'`. The `payroll.run.add_bonus` RBAC permission is similarly deferred — see `PAYROLL_RBAC.md` §2.2.

(Order 1–7 is reserved for `payroll_salary_components`.)

## 7. `payroll_deduction_types` — Payslip Deduction Rows

```sql
CREATE TABLE payroll_deduction_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  display_name VARCHAR(60) NOT NULL,
  payslip_label VARCHAR(30) NOT NULL,
  is_statutory BOOLEAN NOT NULL DEFAULT FALSE,
  is_auto_calculated BOOLEAN NOT NULL DEFAULT FALSE,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  is_active_by_default BOOLEAN NOT NULL DEFAULT TRUE,   -- ESIC = FALSE initially
  display_order SMALLINT NOT NULL,
  notes TEXT
);
```

### 7.1 Seed (v2.2)

| code | display_name | payslip_label | statutory | auto | manual | active_default | order |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PF_EMPLOYEE` | Employee Provident Fund | `PF` | TRUE | TRUE | FALSE | TRUE | 1 |
| `ESIC_EMPLOYEE` | Employee State Insurance | `ESIC` | TRUE | TRUE | FALSE | **FALSE** | 2 |
| `PT` | Professional Tax | `P.TAX` | TRUE | TRUE | FALSE | TRUE | 3 |
| `TDS` | Tax Deducted at Source | `TDS` | TRUE | FALSE | TRUE | TRUE | 4 |
| `SECURITY` | Security Deposit | `SECURITY` | FALSE | FALSE | TRUE | TRUE | 5 |
| `LOAN_EMI` | Loan Recovery | `LOAN` | FALSE | FALSE | TRUE | TRUE | 6 |
| `SAL_DEDUCTION` | Salary Deduction (Other) | `SAL DEDUCTION` | FALSE | FALSE | TRUE | TRUE | 7 |

## 8. `payroll_bank_file_formats` — Bank File Templates

Supports multiple bank formats (client's bank currently TBC — see `PAYROLL_OPEN_QUESTIONS.md`).

```sql
CREATE TABLE payroll_bank_file_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,                    -- e.g., 'HDFC_NEFT_BULK', 'SBI_RTGS'
  display_name VARCHAR(80) NOT NULL,
  file_extension VARCHAR(10) NOT NULL DEFAULT 'txt',
  delimiter VARCHAR(5) NOT NULL DEFAULT '|',
  has_header_row BOOLEAN NOT NULL DEFAULT TRUE,
  column_order JSONB NOT NULL,    -- ordered array: ["EMP_NAME","BANK_NAME","ACC_NO","IFSC","AMOUNT",...]
  date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
  amount_format VARCHAR(20) NOT NULL DEFAULT 'INR_2DEC',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  template_notes TEXT
);
```

### 8.1 Seed (v2.2 — placeholder until client bank confirmed)

| code | display_name | delimiter | column_order |
| --- | --- | --- | --- |
| `DEFAULT_NEFT` | Generic NEFT Bulk | `\|` | `["EMP_NAME","BANK_NAME","ACC_NO","IFSC","AMOUNT","REMARKS"]` |

## 9. `company_profile` — Header/Footer for Payslips

```sql
CREATE TABLE company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(120) NOT NULL,
  address_line_1 VARCHAR(120),
  address_line_2 VARCHAR(120),
  city VARCHAR(60),
  state VARCHAR(60),
  pincode VARCHAR(10),
  logo_s3_key TEXT,
  payslip_footer_text TEXT NOT NULL DEFAULT 'This is a system generated pay slip and does not require signature',
  pf_establishment_code VARCHAR(30),
  esic_code VARCHAR(30),
  pan_number VARCHAR(10),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 9.1 Seed (v2.2)

| Field | Value |
| --- | --- |
| `company_name` | ROCKERS TECHNOLOGIES |
| `address_line_1` | 3rd Floor, Corner Heights |
| `address_line_2` | Kalali Road |
| `city` | Vadodara |
| `state` | Gujarat |
| `pincode` | *(TBD)* |
| `payslip_footer_text` | This is a system generated pay slip and does not require signature |

## 10. Master Data Change Workflow

```
Admin opens Master Data screen
    ↓
Edits a value (e.g., change HRA from 20% to 22%)
    ↓
Frontend validates (e.g., sum-to-100 rule for components)
    ↓
Confirms with admin: "This change applies to next payroll run only. Current runs are unaffected."
    ↓
API PATCH → backend
    ↓
Backend re-validates, writes to master table, writes audit event
    ↓
Next payroll run's Step 2 snapshot picks up the new value
```

**Critical:** A changed master value NEVER affects a payroll_run that is already in `IN_PROGRESS`, `REVIEW`, `LOCKED`, `RELEASED`, or beyond. The snapshot is the source of truth.

## 11. Cross-Reference: Which Master Powers Which Formula

| Formula in `PAYROLL_CALCULATION_ENGINE.md` | Master table(s) read | Fields |
| --- | --- | --- |
| Sal for Calc | `payroll_statutory_config` | `payroll_cycle_days` |
| 7 components | `payroll_salary_components` | `percentage` for each code |
| Employee/Employer PF | `payroll_statutory_config` | `pf_cap_amount`, `pf_fixed_at_cap`, `pf_rate_below_cap`, `pf_employer_matches_employee` |
| Professional Tax | `payroll_statutory_config` | `pt_flat_amount` |
| OT Pay | `payroll_statutory_config` | `ot_multiplier`, `ot_divisor_day`, `ot_divisor_hour` |
| ESIC (inactive) | `payroll_statutory_config` | `esic_active`, `esic_employer_rate`, `esic_employee_rate`, `esic_threshold_gross` |
| CTC | `payroll_statutory_config` + employee | `pf_employer_matches_employee` + `gross + incentive` |
| Bank Transfer File | `payroll_bank_file_formats` | `column_order`, `delimiter`, etc. |
| Payslip header/footer | `company_profile` | all fields |

## 12. Admin UI Expectations

See `PAYROLL_FRONTEND_DESIGN.md` for the Master Data admin screens. Summary:

| Screen | Tables Edited |
| --- | --- |
| Salary Component Settings | `payroll_salary_components` (7 rows with rebalancer) |
| Statutory Config | `payroll_statutory_config` (single form) |
| ESIC Activation | Toggle `esic_active` (Super Admin only, with confirmation modal) |
| Payslip Format | `payroll_earning_types`, `payroll_deduction_types`, `company_profile` |
| Bank File Format | `payroll_bank_file_formats` |

---

*End of PAYROLL_MASTER_DATA.md. Next: PAYROLL_CALCULATION_ENGINE.md — the formula engine.*
