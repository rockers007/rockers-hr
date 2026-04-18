# PAYROLL_API_CONTRACTS.md

**Scope:** NestJS REST API for the payroll module. All endpoints are under `/api/v1/payroll/**`.
**Version:** v2.3

Conventions:
- All endpoints require JWT auth (shared with leave module).
- RBAC enforced per endpoint (see `PAYROLL_RBAC.md`).
- All responses follow `{ success: boolean, data?: any, error?: {code, message, fields?} }`.
- Timestamps: ISO 8601 in UTC.
- Money: numeric strings with 2 decimals (to avoid float precision issues across JSON).
- Pagination: `?page=1&pageSize=50` — default 25, max 200.

---

## 1. Endpoint Groups

| Group | Base path | Primary actors |
| --- | --- | --- |
| A. Employee Salary Config | `/api/v1/payroll/employees/:userId/salary` | Super Admin, HR Manager |
| B. Master Data | `/api/v1/payroll/master/**` | Super Admin |
| C. Payroll Runs | `/api/v1/payroll/runs/**` | Super Admin, HR Manager |
| D. Payslips | `/api/v1/payroll/payslips/**` | Employee (own), Admin (all) |
| E. Bank Change Requests | `/api/v1/payroll/bank-change/**` | Employee (own), Admin |
| F. Investment Proofs | `/api/v1/payroll/investment-proofs/**` | Employee (own), Admin read |
| G. Reports | `/api/v1/payroll/reports/**` | Super Admin, HR Manager, Reports Admin |
| H. Bank Transfer File | `/api/v1/payroll/runs/:runId/bank-file/**` | Super Admin only |
| I. Employee Portal | `/api/v1/payroll/me/**` | Employee (own data only) |

---

## 2. Group A — Employee Salary Config

### 2.1 `GET /api/v1/payroll/employees/:userId/salary`

Get current salary config for an employee.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "emp_number": "RT-DEV-153",
    "name": "...",
    "gross": "38200.00",
    "incentive": "5000.00",
    "tds": "0.00",
    "loan_emi": "0.00",
    "sal_deduction": "0.00",
    "security_return": "0.00",
    "pf_applicable": true,
    "bank_name": "RELIANCE",
    "bank_account_no": "12830100028299",
    "bank_ifsc": "RELI0000123",
    "dob": "1995-03-14",
    "computed_preview": {
      "ctc": "45000.00",
      "ctc_as_per_it": "43200.00",
      "employee_pf": "1800.00",
      "pt": "200.00",
      "expected_net": "41200.00"
    }
  }
}
```

`computed_preview` runs the calculation engine with `lwp_days=0, ot_hours=0` so admin sees a live "what the payslip would look like this month" view.

### 2.2 `PATCH /api/v1/payroll/employees/:userId/salary`

Update employee salary fields. Partial updates allowed.

**Request:**
```json
{
  "gross": "40000.00",
  "incentive": "6000.00",
  "pf_applicable": true
}
```

**Validation:**
- `gross >= 0`
- `incentive, tds, loan_emi, sal_deduction, security_return >= 0`
- Cannot update while a payroll run is in `IN_PROGRESS` or `REVIEW` state for the current month (returns 409).

**Audit event:** `payroll.salary.config_updated`

---

## 3. Group B — Master Data

### 3.1 `GET /api/v1/payroll/master/components`

List the 7 salary components.

### 3.2 `PUT /api/v1/payroll/master/components`

Replace the full 7-component set (atomic). Used by the rebalance UI.

**Request:**
```json
{
  "components": [
    {"code": "BASIC", "percentage": "50.00", "is_pf_base": true, "payslip_label": "BASIC", "display_order": 1},
    {"code": "HRA", "percentage": "20.00", "is_pf_base": false, "payslip_label": "HRA", "display_order": 2},
    ... 7 total
  ]
}
```

**Validation:**
- Exactly 7 components.
- Sum of `percentage` = 100.00 (±0.01).
- Exactly one `is_pf_base = true`.

Returns 400 with field-level errors if invalid.

### 3.3 `GET /api/v1/payroll/master/statutory`

Get the active `payroll_statutory_config` row.

### 3.4 `PATCH /api/v1/payroll/master/statutory`

Update statutory config. Example:
```json
{ "pt_flat_amount": "250.00" }
```

### 3.5 `POST /api/v1/payroll/master/statutory/esic/activate`

Explicit endpoint for ESIC activation (separate from generic update because it's a major toggle — Super Admin only, with "Are you sure?" confirmation).

**Request:**
```json
{ "activate": true, "confirmation_phrase": "ACTIVATE ESIC" }
```

Requires `confirmation_phrase` to match exactly to prevent accidental toggles.

### 3.6 `GET /api/v1/payroll/master/earning-types`
### 3.7 `PATCH /api/v1/payroll/master/earning-types/:code`
### 3.8 `GET /api/v1/payroll/master/deduction-types`
### 3.9 `PATCH /api/v1/payroll/master/deduction-types/:code`
### 3.10 `GET /api/v1/payroll/master/company-profile`
### 3.11 `PATCH /api/v1/payroll/master/company-profile`

Standard CRUD for other master tables.

---

## 4. Group C — Payroll Runs

### 4.1 `GET /api/v1/payroll/runs`

List payroll runs (paginated, filterable).

Query params: `?year=2026&state=RELEASED&page=1&pageSize=25`

### 4.2 `POST /api/v1/payroll/runs`

**Step 1 — Create run (select month).**

```json
{ "month": 4, "year": 2026 }
```

Validation: no active run exists for `(month, year)`.

**Response:** full run object with state `DRAFT` and list of employees snapshot to be processed.

### 4.3 `POST /api/v1/payroll/runs/:runId/import`

**Step 2 — Trigger import from Leave System.**

> **v2.3 (Review item A2):** Always returns immediately with a `job_id`. Frontend polls `GET /runs/:runId` for completion. This ensures a consistent response shape regardless of employee count.

**Response 202:**
```json
{
  "success": true,
  "data": {
    "run_id": "uuid",
    "job_id": "uuid",
    "state": "IN_PROGRESS",
    "message": "Import started. Poll GET /runs/:runId for completion."
  }
}
```

On completion (polled via `GET /runs/:runId`), the run object includes:
```json
{
  "import_summary": {
    "employees": 42,
    "total_lwp_days": 5,
    "total_ot_hours": 18,
    "warnings": []
  }
}
```

### 4.4 `POST /api/v1/payroll/runs/:runId/calculate`

**Step 3 — Run calculation engine for all employees.**

**Response 200:** run object with state `REVIEW` plus totals summary.

### 4.5 `GET /api/v1/payroll/runs/:runId`

Full run detail including totals, state, timestamps.

### 4.6 `GET /api/v1/payroll/runs/:runId/items`

Paginated list of `payroll_items` for a run. Filterable by department, search by emp_number/name.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "user_id": "uuid",
        "emp_number": "RT-DEV-153",
        "name": "...",
        "gross": "38200.00",
        "sal_for_calc": "38200.00",
        "components": {
          "BASIC": { "actual": "19100.00", "payable": "19100.00" },
          "HRA": { "actual": "7640.00", "payable": "7640.00" },
          ...
        },
        "fix_variable": "5000.00",
        "ot_pay": "0.00",
        "employee_pf": "1800.00",
        "employer_pf": "1800.00",
        "professional_tax": "200.00",
        "tds": "0.00",
        "total_earnings": "43200.00",
        "total_deductions": "2000.00",
        "net_payable": "41200.00",
        "ctc": "45000.00",
        "ctc_as_per_it": "43200.00",
        "warnings": []
      }
    ],
    "pagination": { "page": 1, "pageSize": 50, "total": 42 },
    "totals": {
      "total_gross": "...",
      "total_net_payable": "...",
      ...
    }
  }
}
```

### 4.7 `PATCH /api/v1/payroll/runs/:runId/employees/:userId` (v2.3)

> **v2.3 (Review item A1):** Admin can manually correct imported LWP/OT values before calculation, without needing to cancel the run and re-import.

**Step 2b (optional) — Override imported snapshot values.**

Only allowed when run is in `IN_PROGRESS` state (after import, before or after calculation).

**Request:**
```json
{
  "lwp_days": 3,
  "ot_hours": 5.5
}
```

**Editable fields:** `lwp_days`, `ot_hours`, `cl_days`, `sl_days`, `pl_days`, `wfh_days`, `comp_off_days`

**Validation:**
- `lwp_days` between 0 and 30 (capped at `payroll_cycle_days`).
- `ot_hours >= 0`.
- Run must be in `IN_PROGRESS` or `REVIEW` state.
- If run is in `REVIEW`, editing snapshot values triggers automatic recalculation for that employee.

**Audit event:** `payroll.run.snapshot_overridden`

### 4.8 `PATCH /api/v1/payroll/runs/:runId/items/:userId`

**Step 4 — Edit an individual employee's payroll item.**

Editable fields only (see `PAYROLL_WORKFLOW.md` §5.1):
- `incentive`, `tds`, `loan_emi`, `sal_deduction`, `security_return`

**Request:**
```json
{ "tds": "1500.00" }
```

Backend recomputes that employee's row (engine re-run), writes new `payroll_items` row, marks old as `superseded_at`.

### 4.9 `POST /api/v1/payroll/runs/:runId/lock`

**Step 5a — Lock the run.**

```json
{ "confirmation_phrase": "LOCK APRIL 2026" }
```

Server runs validation pass first. Returns errors if any.

### 4.10 `POST /api/v1/payroll/runs/:runId/release`

**Step 5b — Release payslips.**

```json
{ "release_date": "2026-05-02" }
```

- Triggers background job for PDF generation + email delivery.
- Response returns immediately with `job_id`; UI polls progress.

### 4.11 `GET /api/v1/payroll/runs/:runId/release-progress`

Polling endpoint showing per-employee delivery status.

### 4.12 `POST /api/v1/payroll/runs/:runId/cancel`

Cancel a run (only allowed in states `DRAFT`, `IN_PROGRESS`, `REVIEW`).

---

## 5. Group D — Payslips

### 5.1 `GET /api/v1/payroll/payslips/:userId/:year/:month`

Admin: get a specific employee's payslip PDF as a signed URL.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "signed_url": "https://s3.ap-south-1.amazonaws.com/...",
    "expires_at": "2026-04-18T15:30:00Z",
    "password_hint": "DOB in DDMM format"
  }
}
```

### 5.2 `GET /api/v1/payroll/payslips/:userId/:year/:month/preview`

Admin: preview-only payslip (watermarked "PREVIEW — NOT RELEASED", unprotected). Streams PDF directly.

### 5.3 `POST /api/v1/payroll/payslips/:userId/:year/:month/retry-email`

Admin: manually retry email delivery for a specific payslip.

---

## 6. Group E — Bank Change Requests

### 6.1 `POST /api/v1/payroll/bank-change` *(Employee)*

Submit a bank detail change request.

**Request (multipart):**
```
new_bank_name: HDFC Bank
new_account_no: 12345678901234
new_ifsc: HDFC0001234
proof_file: <cancelled cheque.pdf>  (optional)
```

**Validation:**
- Employee has no existing `PENDING` request (returns 409).
- IFSC matches regex `^[A-Z]{4}0[A-Z0-9]{6}$`.
- Account number: min 9, max 18 digits.
- Proof file: max 5MB, `pdf|jpg|png`.

### 6.2 `GET /api/v1/payroll/bank-change/mine` *(Employee)*

List employee's own requests (including history).

### 6.3 `GET /api/v1/payroll/bank-change` *(Admin)*

List all requests. Filter by status. Default: pending first.

### 6.4 `POST /api/v1/payroll/bank-change/:id/approve` *(Admin)*

Approve a pending request. Updates `users.bank_*` fields atomically.

### 6.5 `POST /api/v1/payroll/bank-change/:id/reject` *(Admin)*

Reject with reason.
```json
{ "rejection_reason": "Proof document unclear" }
```

---

## 7. Group F — Investment Proofs

### 7.1 `POST /api/v1/payroll/investment-proofs` *(Employee, multipart)*

Upload an investment proof.

```
financial_year: 2025-2026
category: 80C
description: ELSS Mutual Fund Investment
amount: 50000.00
file: <proof.pdf>
```

**Validation:** file ≤ 5MB, `pdf|jpg|png`, `financial_year` in format `YYYY-YYYY`.

### 7.2 `GET /api/v1/payroll/investment-proofs/mine?fy=2025-2026` *(Employee)*

List own proofs for a FY.

### 7.3 `DELETE /api/v1/payroll/investment-proofs/:id` *(Employee, own only)*

Remove own proof (soft-delete).

### 7.4 `GET /api/v1/payroll/investment-proofs?userId=X&fy=2025-2026` *(Admin read-only)*

Admin view of any employee's proofs.

---

## 8. Group G — Reports

Reports return both JSON for UI display and offer export via query param.

### 8.1 `GET /api/v1/payroll/reports/salary-register?year=2026&month=3&format=json`

Formats: `json`, `csv`, `pdf`. For `csv` and `pdf`, response is a file download.

Columns match `Sample_Salary_Sheet.xls` exactly (see `PAYROLL_MASTER_DATA.md` reference + BRD §5).

### 8.2 `GET /api/v1/payroll/reports/department-cost?year=2026&month=3&department_id=...`

### 8.3 `GET /api/v1/payroll/reports/payroll-summary?year=2026&period=monthly|quarterly|yearly`

### 8.4 `GET /api/v1/payroll/reports/compliance?year=2026&month=3`

Compliance totals (for statutory filings): total Employer PF, Employee PF, Employer ESIC (₹0 while inactive), Employee ESIC (₹0), Professional Tax.

---

## 9. Group H — Bank Transfer File

### 9.1 `GET /api/v1/payroll/runs/:runId/bank-file/preview`

Returns preview JSON of rows that would appear in the file. Highlights employees with pending bank change requests.

### 9.2 `POST /api/v1/payroll/runs/:runId/bank-file/approve`

**Super Admin only.** Marks the run as `BANK_FILE_APPROVED`.

```json
{
  "confirmation_phrase": "APPROVE BANK TRANSFER FILE",
  "file_format_code": "DEFAULT_NEFT",
  "pending_bank_changes_action": "use_old" | "exclude_employee" | "hold_separate"
}
```

> **v2.3 (Review item A4):** `pending_bank_changes_action` options:
> - `"use_old"` — include the employee in the file using their current (old) bank details. Payslip is released normally.
> - `"exclude_employee"` — exclude the employee from the bank file. Their payslip is still released, but they are flagged as "payment pending" and admin must arrange a separate transfer (e.g., manual NEFT).
> - `"hold_separate"` — *(v2.3)* same as `exclude_employee` but additionally generates a separate single-employee file for manual processing.

### 9.3 `POST /api/v1/payroll/runs/:runId/bank-file/generate`

Generate the file (requires approved state). Returns signed S3 URL (TTL 15min).

---

## 10. Group I — Employee Portal (`/me` prefix)

All endpoints in this group derive `user_id` from JWT — employees can only see their own data.

### 10.1 `GET /api/v1/payroll/me/salary`

Own current salary structure (sensitive fields masked if requested by a non-self actor — but this endpoint is self-only).

### 10.1b `GET /api/v1/payroll/me/salary-preview` (v2.3)

> **v2.3 (Review item F3):** Powers the "Current Month Preview" card on the Employee Portal dashboard (`PAYROLL_FRONTEND_DESIGN.md` §9.1).

Runs the calculation engine with the employee's current salary config and `lwp_days=0, ot_hours=0` to produce a "what your payslip would look like this month" preview.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "preview_month": "April",
    "preview_year": 2026,
    "gross": "38200.00",
    "sal_for_calc": "38200.00",
    "total_earnings": "43200.00",
    "total_deductions": "2000.00",
    "estimated_net_payable": "41200.00",
    "note": "Estimate only — actual payslip may differ based on LWP, OT, and admin adjustments."
  }
}
```

This is a read-only calculation — no data is written. Cached for 1 hour per employee (invalidated on salary config change).

### 10.2 `GET /api/v1/payroll/me/payslips?year=2026`

Own payslip list.

### 10.3 `GET /api/v1/payroll/me/payslips/:year/:month/download`

Signed URL for own payslip PDF.

### 10.4 `GET /api/v1/payroll/me/ytd?fy=2025-2026`

Own YTD totals (from `v_employee_ytd` view).

### 10.5 `GET /api/v1/payroll/me/ot-tracker?year=2026&month=3`

Own OT hours summary for a month (approved + pending).

---

> **Note (v2.3 — Review item G4):** There is no bonus-specific endpoint in MVP. The `BONUS` earning type is seeded in master data but not processed by the calculation engine. Bonus payroll runs (Diwali, 13th-month, etc.) are Phase 2. The `payroll.run.add_bonus` RBAC permission is similarly deferred.

## 11. Error Codes (Payroll-specific)

| Code | Message | HTTP |
| --- | --- | --- |
| `PR_RUN_ALREADY_EXISTS` | A payroll run for this month already exists. | 409 |
| `PR_RUN_INVALID_STATE` | Cannot perform this action in current state: `<state>` | 409 |
| `PR_RUN_VALIDATION_FAILED` | Validation errors prevent locking. | 400 |
| `PR_IMPORT_FAILED` | Error importing leave/OT data. | 500 |
| `PR_COMPONENTS_INVALID` | Salary components must sum to 100% with exactly one PF base. | 400 |
| `PR_ESIC_CONFIRMATION_REQUIRED` | ESIC toggle requires confirmation phrase. | 400 |
| `PR_MISSING_DOB` | Cannot generate payslip: employee has no DOB on record. | 400 |
| `PR_BANK_CHANGE_PENDING` | Employee already has a pending bank change request. | 409 |
| `PR_LOCKED` | This payroll run is locked and cannot be edited. | 409 |
| `PR_FORBIDDEN_FIELD` | Field `<f>` is not editable in the current run state. | 403 |
| `PR_BANK_FILE_NOT_APPROVED` | Bank transfer file must be approved before generation. | 409 |

---

## 12. Request/Response Size Constraints

| Endpoint | Max request body | Max response | Timeout |
| --- | --- | --- | --- |
| Payslip generation (per run) | N/A (bg job) | — | 30 min async |
| Bank file generation | N/A (bg job) | — | 10 min async |
| List items (paginated) | 1MB | 5MB | 30s |
| Salary register CSV | 1MB | 50MB | 120s |
| Investment proof upload | 5MB | — | 60s |
| Bank change proof upload | 5MB | — | 60s |

## 13. Idempotency

Mutation endpoints that create significant side effects support `Idempotency-Key` header:

- `POST /runs` (creating a run)
- `POST /runs/:id/lock`
- `POST /runs/:id/release`
- `POST /runs/:id/bank-file/approve`
- `POST /runs/:id/bank-file/generate`

Repeated calls with the same key within 24h return the first response.

> **v2.3 (Review item G9) — Implementation details:**
> - **Storage:** PostgreSQL table `idempotency_keys` (`key VARCHAR(64) PRIMARY KEY, response JSONB, created_at TIMESTAMPTZ`). No Redis dependency for MVP.
> - **Key format:** Client-generated UUID v4 (max 64 chars).
> - **Same key, different body:** Returns the original response. The request body is NOT compared — the key is the sole identifier. This matches Stripe's idempotency semantics.
> - **Cleanup:** Background job deletes keys older than 24h. Run daily.
> - **Concurrency:** `INSERT ... ON CONFLICT DO NOTHING` + `SELECT` pattern — first writer wins.

## 14. OpenAPI

Full OpenAPI 3 spec (with all schemas, examples, and auth) is generated from NestJS controllers using `@nestjs/swagger`. Published at `/api/v1/docs`. The spec above is the contract summary; the OpenAPI file is the executable truth.

---

*End of PAYROLL_API_CONTRACTS.md. Next: PAYROLL_RBAC.md — permissions matrix.*
