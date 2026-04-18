# PAYROLL_WORKFLOW.md

**Scope:** The monthly payroll processing workflow — from month selection through payslip release and bank transfer file generation.
**Version:** v2.3

Cross-refs:
- Formula details → `PAYROLL_CALCULATION_ENGINE.md`
- Payslip PDF layout → `PAYROLL_PAYSLIP_FORMAT.md`
- RBAC per step → `PAYROLL_RBAC.md`
- Master tables touched → `PAYROLL_MASTER_DATA.md`

---

## 1. Overview — The 5-Step Payroll Run

Every payroll cycle is a **stateful, sequential** process. The payroll run has a lifecycle: `DRAFT → IN_PROGRESS → REVIEW → LOCKED → RELEASED → BANK_FILE_APPROVED → BANK_FILE_GENERATED`. Each step advances the run to the next state and is idempotent within its step.

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Step 1       │ → │ Step 2       │ → │ Step 3       │ → │ Step 4       │ → │ Step 5       │
│ Select Month │   │ Import Leave │   │ Auto-Calc    │   │ Review &     │   │ Lock &       │
│              │   │ & OT         │   │ Salaries     │   │ Approve      │   │ Release      │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
      DRAFT           IN_PROGRESS          REVIEW            REVIEW            LOCKED/RELEASED
                                                                                       │
                                                                                       ▼
                                                                           ┌──────────────────────┐
                                                                           │ Step 6 (optional)     │
                                                                           │ Bank Transfer File    │
                                                                           │ (admin approval req.) │
                                                                           └──────────────────────┘
                                                                             BANK_FILE_APPROVED →
                                                                             BANK_FILE_GENERATED
```

The monthly cycle is always **30 working days** (D1 from PLAN.md) regardless of how many days the calendar month actually has. No timezone or holiday logic applies to the payroll cycle itself.

## 2. Step 1 — Select Month

**Actor:** HR Manager or Super Admin
**State transition:** *(none)* → `DRAFT`
**Precondition:** No existing payroll run for the same `(month, year)` in states other than `CANCELLED`.

### 2.1 Actions

1. Admin opens *Run Payroll* screen, selects `month` (e.g., April 2026).
2. System creates a new row in `payroll_runs`:
   ```
   INSERT INTO payroll_runs (
     id, month, year, state, created_by, created_at, total_employees
   ) VALUES (
     uuid(), 'April', 2026, 'DRAFT', :admin_id, now(), :count
   );
   ```
3. System snapshots **active employees at the moment of creation** into `payroll_run_employees`. Employees deactivated after this snapshot are not retroactively removed. Employees activated after this snapshot are not auto-added — they will be picked up in next month's run.
4. System sets `payroll_cycle_days = 30` as a fixed constant on the run (per D1).

### 2.2 Validation

- Reject if a run for `(month, year)` already exists in state other than `CANCELLED`.
- Reject if no active employees at snapshot time.
- Reject if current date is before month-end (admin should not run payroll for a month that has not completed) — **configurable override** available for mid-month advance runs.

### 2.3 Audit

```
event: payroll.run.created
actor: :admin_id
meta: { run_id, month, year, employee_count }
```

## 3. Step 2 — Import Attendance & Leaves

**Actor:** HR Manager or Super Admin
**State transition:** `DRAFT` → `IN_PROGRESS`
**Precondition:** Run is in `DRAFT`.

### 3.1 What Gets Imported

For each employee in the run, the system queries the Leave Management module:

| Field | Query | Target column |
| --- | --- | --- |
| LWP days | `SUM(days) FROM leave_requests WHERE user_id=X AND leave_type='LWP' AND status='approved' AND start_date >= :month_start AND end_date <= :month_end` | `payroll_run_employees.lwp_days` |
| CL days | same, with `leave_type='CL'` | `.cl_days` |
| SL days | same, with `leave_type='SL'` | `.sl_days` |
| PL days | same, with `leave_type='PL'` | `.pl_days` |
| EL hours (if applicable) | `SUM(hours) FROM leave_requests WHERE leave_type='EL' AND status='approved'` | `.el_hours` *(informational only — no salary impact)* |
| WFH days | `COUNT(*) FROM wfh_entries WHERE user_id=X AND status='approved' AND date BETWEEN :month_start AND :month_end` | `.wfh_days` |
| Complimentary Off days | `COUNT(*) FROM complimentary_off WHERE user_id=X AND status='approved'` | `.comp_off_days` |
| Approved OT hours | `SUM(hours) FROM overtime_requests WHERE user_id=X AND status='approved' AND date BETWEEN :month_start AND :month_end` | `.ot_hours` |

### 3.2 Salary Structure Snapshot

The system **freezes** each employee's current salary structure into the run, so later changes to master data or employee config don't retroactively affect a running payroll:

```
payroll_run_employees.snapshot_gross         ← users.gross (current)
payroll_run_employees.snapshot_incentive     ← users.incentive
payroll_run_employees.snapshot_tds           ← users.tds (monthly)
payroll_run_employees.snapshot_loan_emi      ← users.loan_emi
payroll_run_employees.snapshot_sal_deduction ← users.sal_deduction
payroll_run_employees.snapshot_security_return ← users.security_return
payroll_run_employees.snapshot_pf_applicable ← users.pf_applicable (boolean)
payroll_run_employees.snapshot_components    ← current percentages from payroll_salary_components (JSON)
payroll_run_employees.snapshot_statutory     ← { pf_cap: 15000, pt_flat: 200, ot_multiplier: 1.5, ot_divisor_day: 30, ot_divisor_hour: 9 } (JSON)
```

### 3.3 State Update

```sql
UPDATE payroll_runs SET state = 'IN_PROGRESS', imported_at = now() WHERE id = :run_id;
```

### 3.4 Validation & Edge Cases

- If an employee has no leave/OT data for the month, all counters default to 0 (no error).
- If a Leave request is mid-approval (pending) at the time of import, it is **excluded** (only `status='approved'` counts).
- If LWP days exceed 30, cap at 30 (employee was on LWP the entire month → net payable = 0 + any incentive not tied to present days, per D10 × CALCULATION_ENGINE §5).

### 3.5 Audit

```
event: payroll.run.imported
actor: :admin_id
meta: { run_id, lwp_total: N, ot_hours_total: M, imported_employee_count }
```

## 4. Step 3 — Auto-Calculate Salaries

**Actor:** System (triggered by admin clicking *Calculate*)
**State transition:** `IN_PROGRESS` (remains)
**Precondition:** Import (Step 2) complete.

### 4.1 Calculation Order

For **each** employee in the run, the calculation engine runs in this exact order (see `PAYROLL_CALCULATION_ENGINE.md` for the deterministic pseudocode):

1. `lwp_deduction = round(gross / 30 * lwp_days, 2)`
2. `sal_for_calc = gross - lwp_deduction`
3. For each of 7 components: `amount_actual = round(gross * pct / 100, 2)`, `amount_payable = round(sal_for_calc * pct / 100, 2)`
4. `employer_pf = basic_amount_actual >= 15000 ? 1800 : round(basic_amount_actual * 0.12)` (using **actual** basic, not payable)
5. `employee_pf = same formula` (subject to `pf_applicable` flag)
6. `employer_esic = round(gross * 0.0325)` *(stored, not applied — module inactive)*
7. `employee_esic = round(gross * 0.0075)` *(stored, not applied)*
8. `professional_tax = 200` (master value)
9. `ot_per_hour = round(gross / 30 / 9, 2)`; `ot_rate = round(ot_per_hour * 1.5, 2)`; `ot_pay = round(ot_rate * ot_hours, 2)`
10. `total_earnings = sum(7_components_payable) + incentive + ot_pay + security_return`
11. `total_deductions = employee_pf + professional_tax + tds + loan_emi + sal_deduction` *(ESIC excluded while inactive)*
12. `net_payable = total_earnings - total_deductions`
13. `ctc = gross + employer_pf + incentive` *(employer PF always computed regardless of ESIC active/inactive)*
14. `ctc_as_per_it = gross + incentive`

Each calculation writes one row into `payroll_items` (see `PAYROLL_DATABASE_SCHEMA.md` §4).

### 4.2 State Update

```sql
UPDATE payroll_runs SET state = 'REVIEW', calculated_at = now() WHERE id = :run_id;
```

### 4.3 Audit

```
event: payroll.run.calculated
actor: :admin_id   (or system if scheduled)
meta: { run_id, total_net_payable, total_employer_pf, total_employee_pf, employee_count }
```

## 5. Step 4 — Review & Approve

**Actor:** HR Manager or Super Admin
**State transition:** `REVIEW` → `REVIEW` (can iterate freely) → admin clicks *Approve* to go to next step
**Precondition:** Calculation (Step 3) complete.

### 5.1 Actions

Admin reviews the full salary register (`PAYROLL_FRONTEND_DESIGN.md` §4 — Run Payroll screen). Allowed edits in this state:

| Editable | Not Editable |
| --- | --- |
| `incentive` per employee (for this run only — does not mutate `users.incentive`) | `gross` (locked from snapshot) |
| `tds` per employee (for this run only) | component percentages (locked from snapshot) |
| `loan_emi` per employee (for this run only) | PF amounts (auto-recomputed if basic changes via gross edit — not allowed) |
| `sal_deduction` per employee (for this run only) | LWP/OT days (run new import to refresh) |
| `security_return` per employee | Statutory rates (PT, PF cap, OT multiplier) |

Any edit triggers **recalculation of that employee's row only** (not the whole register) and writes a new `payroll_items` row (soft-delete old via `superseded_at`).

### 5.2 Review Totals Panel

Live-computed totals shown to admin:

- Total Gross
- Total Sal for Calc
- Total Net Payable
- Total Employer PF
- Total Employee PF
- Total PT
- Total TDS
- Total Loan Recovery
- Total Incentives
- Total OT Pay
- Total CTC (+ CTC As Per IT)
- Compliance summary panel (mirrors Compliance Report)

### 5.3 Re-import Option

Admin can trigger a **re-import** which re-runs Step 2 and Step 3, **but only if** no edits have been manually made in Step 4. If edits exist, admin must type confirmation phrase `DISCARD EDITS AND RE-IMPORT` to proceed. This prevents accidental data loss — there is no undo after re-import overwrites manual edits.

> **v2.3 (Review item W2):** Confirmation phrase required when edits exist. Without edits, re-import proceeds with a simple "Are you sure?" confirmation.

### 5.4 Audit

Every individual edit → one audit event:

```
event: payroll.run.item_edited
actor: :admin_id
meta: { run_id, employee_id, field, old_value, new_value }
```

## 6. Step 5 — Lock & Release

**Actor:** HR Manager or Super Admin
**State transition:** `REVIEW` → `LOCKED` → `RELEASED`
**Precondition:** All employees have valid payroll_items rows; no validation errors.

### 6.1 Lock

Admin clicks *Lock Payroll*.
- Validation pass: all employees have net_payable >= 0, no nulls in required fields, component sum matches Sal for Calc within ₹1 tolerance.
- If any validation fails → modal with errors, admin fixes then re-locks.
- On success:
  ```sql
  UPDATE payroll_runs SET state = 'LOCKED', locked_at = now(), locked_by = :admin_id WHERE id = :run_id;
  ```
- **Lock is irreversible** (D19 from PLAN.md). Any correction must be an adjustment entry in the **next month's** payroll run.

### 6.2 Release Day

Admin chooses release date (D13 — no fixed calendar day). Release can be same-day as lock or scheduled for later.

### 6.3 Payslip Generation

On release:
1. For each employee, generate PDF payslip per `PAYROLL_PAYSLIP_FORMAT.md` specification.
2. Upload PDF to AWS S3 under `s3://rockers-hr-payslips/{year}/{month}/{employee_id}.pdf`, encrypted at rest.
3. Password-protect the PDF using employee DOB in DDMM format (D11).
4. Send email via SMTP to employee's Gmail with PDF attached.
5. Write row to `payslip_deliveries` with `sent_at`, `delivery_status`.

### 6.4 In-App Notification

Each employee receives in-app notification: *"Your payslip for {month} {year} is ready. Download from My Payroll."* (see `PAYROLL_NOTIFICATIONS.md` §3).

### 6.5 State Update

```sql
UPDATE payroll_runs
SET state = 'RELEASED',
    released_at = now(),
    released_by = :admin_id,
    release_date = :admin_chosen_date
WHERE id = :run_id;
```

### 6.6 Audit

```
event: payroll.run.locked
actor: :admin_id
meta: { run_id, total_employees, total_net_payable }

event: payroll.run.released
actor: :admin_id
meta: { run_id, release_date, payslips_generated, email_failures }
```

## 7. Step 6 — Bank Transfer File (optional but expected)

**Actor:** Super Admin only *(separate approval step per D14)*
**State transition:** `RELEASED` → `BANK_FILE_APPROVED` → `BANK_FILE_GENERATED`

### 7.1 Why This Is Separated

The bank transfer file executes real money movement. Wrong file → wrong salary payments. Therefore this is a **two-person** or **two-action** control:
- The admin who released payroll *may* be the same person who approves the bank file — that's a business decision left to the client — but the **approval click is a distinct action** and a distinct audit event.

### 7.2 Generate Preview

Admin opens *Bank Transfer File* screen. System generates a preview (not yet downloadable):

| Column | Source |
| --- | --- |
| Employee Name | `users.name` |
| Bank Name | `users.bank_name` (only if not pending a change request) |
| A/C Number | `users.bank_account_no` |
| IFSC | `users.bank_ifsc` |
| Net Payable | `payroll_items.net_payable` |
| Transaction Type | `'NEFT'` or `'RTGS'` (admin-configurable per run) |

### 7.3 Approve

Admin reviews preview, clicks *Approve Bank Transfer File*.
- If any employee has a **pending bank change request**, that employee is flagged and admin must decide: use old details, or delay this employee to next run.
- On approval:
  ```sql
  UPDATE payroll_runs
  SET state = 'BANK_FILE_APPROVED', bank_file_approved_at = now(), bank_file_approved_by = :admin_id
  WHERE id = :run_id;
  ```

### 7.4 Generate File

After approval, admin clicks *Download Bank Transfer File*.
- File format: NEFT/RTGS bulk upload (**exact format TBC with client's bank** — see `PAYROLL_OPEN_QUESTIONS.md`).
- File is generated server-side, uploaded to S3 at `s3://rockers-hr-bank-files/{year}/{month}/{run_id}.txt`, and offered as a signed download URL (TTL 15 min).
- State moves to `BANK_FILE_GENERATED`.

### 7.5 Audit

```
event: payroll.bank_file.approved
actor: :admin_id
meta: { run_id, employee_count, pending_bank_changes: [...] }

event: payroll.bank_file.downloaded
actor: :admin_id
meta: { run_id, file_size, download_url_expires_at }
```

## 8. Run States — Full State Machine

| State | Description | Allowed next states |
| --- | --- | --- |
| `DRAFT` | Just created via Step 1 | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | Import and/or calculation ran | `REVIEW`, `CANCELLED` |
| `REVIEW` | Calculation done, admin reviewing | `REVIEW` (edits), `LOCKED`, `CANCELLED` |
| `LOCKED` | Irreversibly locked, payslips generating | `RELEASED` |
| `RELEASED` | Payslips emailed to employees | `BANK_FILE_APPROVED` |
| `BANK_FILE_APPROVED` | Bank file previewed and approved | `BANK_FILE_GENERATED` |
| `BANK_FILE_GENERATED` | Bank file downloaded — terminal state | — |
| `CANCELLED` | Run abandoned before lock | *(terminal)* |

Cancellation is allowed **only** up to `REVIEW` state. After `LOCKED`, the run is permanent.

## 9. Concurrency & Re-entrancy

- Only one payroll run per `(month, year)` in active (non-cancelled, non-terminal) states. Enforced by unique partial index (see `PAYROLL_DATABASE_SCHEMA.md` §2).
- Two admins can view the same run simultaneously. Last-write-wins for edits in Step 4 — UI shows "Last updated by X at Y" indicator.
- Import (Step 2) and Calculate (Step 3) use a database transaction; partial failures roll back cleanly.
- Payslip generation (Step 5) and bank file generation (Step 6) are **queued background jobs** — the admin UI shows progress and can resume if interrupted.

## 10. Post-Lock Corrections — Adjustment Entries (v2.3)

> **Added v2.3 (Review item G3).** D19 states that locked runs are irreversible. This section defines the formal mechanism for corrections.

### 10.1 Correction Mechanism

When an error is discovered in a locked/released payroll run (e.g., wrong TDS, missing LWP day, incorrect incentive), the correction is applied as an **adjustment entry** in the **next month's** payroll run.

```
Month N (LOCKED/RELEASED — error discovered)
    ↓
Month N+1 (new run — Step 4 Review)
    ↓
Admin adds correction using editable fields:
  - Positive adjustment → increase `incentive` or `security_return`
  - Negative adjustment → increase `sal_deduction`
  - Note in audit log references original run_id + month
```

### 10.2 How Adjustments Are Recorded

In Step 4 of the next month's run, admin edits the affected employee's row:

| Correction type | Field used | Example |
| --- | --- | --- |
| Underpayment (owed to employee) | `incentive` (increased by delta) or `security_return` | Employee was under-paid ₹500 → add ₹500 to incentive |
| Overpayment (owed by employee) | `sal_deduction` (increased by delta) | Employee was over-paid ₹300 → add ₹300 to sal_deduction |
| TDS correction | `tds` (adjusted to compensate) | Wrong TDS last month → adjust this month's TDS |

### 10.3 Audit Trail

Every adjustment edit in Step 4 writes a standard `payroll.run.item_edited` audit event. To link the correction to its origin, the admin should include a note in the audit metadata:

```
event: payroll.run.item_edited
actor: :admin_id
meta: {
  run_id: <current_run>,
  employee_id: <user_id>,
  field: "sal_deduction",
  old_value: "0.00",
  new_value: "300.00",
  correction_ref: "Correction for run <original_run_id> (March 2026) — overpayment of ₹300"
}
```

### 10.4 Limitations

- No dedicated "adjustment" line item on the payslip — adjustments are merged into the standard earning/deduction fields. The employee sees a different `incentive` or `sal_deduction` than usual.
- No automated reconciliation between the original run and the correcting run.
- For large corrections (e.g., entire month's salary was wrong), admin should contact the employee directly and explain the adjustment before payslip release.

> **Phase 2 enhancement:** A dedicated `payroll_adjustments` table with explicit links to the original run, line-item visibility on payslip, and automated correction workflows.

## 11. Failure Recovery

| Failure | Recovery |
| --- | --- |
| SMTP bounce on payslip email | Delivery logged as `failed`; admin can retry individual employee from *Payroll History* screen |
| PDF generation error for one employee | Other employees' payslips proceed; failed employee flagged, admin can retry |
| Import query timeout | Admin can re-run Step 2 from scratch — snapshot is discarded and regenerated |
| Leave DB unavailable during import | Import fails with clear error; admin retries when leave DB is restored. No partial data written. Transaction rolls back cleanly. *(v2.3 — Review item G8)* |
| Lock validation fails | Admin fixes the flagged row(s) in Step 4, re-locks |
| Bank file S3 upload fails | Admin retries; run remains in `BANK_FILE_APPROVED` until successful generation |
| Run stuck in transition (crash during state change) | Super Admin uses the **Stuck Run Recovery** procedure (§11.1) |

### 11.1 Stuck Run Recovery (v2.3)

> **Added v2.3 (Review item W3).** Covers edge cases where the system crashes during a state transition.

If the application crashes mid-transition (e.g., during lock or release), the run may be in an inconsistent state:

| Stuck state | Symptom | Recovery |
| --- | --- | --- |
| `IN_PROGRESS` with partial snapshot | Some employees snapshotted, others not | Re-run Step 2 (import). Import is idempotent — it deletes all existing `payroll_run_employees` for the run and re-creates them. |
| `IN_PROGRESS` with partial calculation | Some `payroll_items` written, others not | Re-run Step 3 (calculate). Calculation deletes all existing `payroll_items` for the run and re-creates them. |
| `LOCKED` with partial payslip generation | Some PDFs generated and emailed, others not | Use the Release Progress screen to identify failed employees. Retry individual employees. Already-sent payslips are not re-sent (deduplicated by `payslip_deliveries` unique constraint). |
| `RELEASED` with no bank file and admin wants to cancel | Cannot cancel — run is past REVIEW | Run is permanent per D19. Admin must use adjustment entries in next month if needed. |

**Super Admin escape hatch:** In extreme cases (e.g., entire run was wrong), a Super Admin can set the run state to `CANCELLED` via direct DB update. This is NOT exposed in the UI and requires direct database access. The `payslip_deliveries` and S3 PDFs remain (already sent to employees). A new run for the same month can then be created. This action must be documented in the audit log manually.

---

*End of PAYROLL_WORKFLOW.md. Next: PAYROLL_DATABASE_SCHEMA.md — the tables.*
