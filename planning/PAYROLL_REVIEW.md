# PAYROLL_REVIEW.md

**Scope:** Cross-file review of all 12 `PAYROLL_*.md` planning documents. Captures inconsistencies, ambiguities, missing specs, and questions that should be resolved before or during implementation.
**Reviewer:** AI Agent (Claude)
**Review date:** 2026-04-18
**Files reviewed:** PAYROLL_PLAN, PAYROLL_WORKFLOW, PAYROLL_DATABASE_SCHEMA, PAYROLL_MASTER_DATA, PAYROLL_API_CONTRACTS, PAYROLL_CALCULATION_ENGINE, PAYROLL_RBAC, PAYROLL_NOTIFICATIONS, PAYROLL_FRONTEND_DESIGN, PAYROLL_PAYSLIP_FORMAT, PAYROLL_TESTING, PAYROLL_OPEN_QUESTIONS

---

## 1. Cross-File Inconsistencies

### I1 — Duplicate working-days config (MASTER_DATA vs. STATUTORY_CONFIG)

**Files:** PAYROLL_MASTER_DATA.md `5, PAYROLL_DATABASE_SCHEMA.md

MASTER_DATA.md `5 acknowledges that `payroll_working_days_config` duplicates fields already in `payroll_statutory_config` and recommends merging. However, DATABASE_SCHEMA.md does not define `payroll_working_days_config` at all, implying it was already dropped. Meanwhile, MASTER_DATA.md `2 still lists it as table #3 in the inventory.

**Action needed:** Remove `payroll_working_days_config` from MASTER_DATA.md `2 inventory and `5 entirely, or add it to DATABASE_SCHEMA.md. Recommend the former (single source of truth in `payroll_statutory_config`).

---

### I2 — State transition mismatch: Step 3 end state

**Files:** PAYROLL_WORKFLOW.md `1 vs `4.2

The overview diagram in `1 shows Step 3 (Auto-Calc) ending in `IN_PROGRESS`, but `4.2 explicitly transitions to `REVIEW`:

```sql
UPDATE payroll_runs SET state = 'REVIEW', calculated_at = now() WHERE id = :run_id;
```

The state machine table in `8 says `IN_PROGRESS` can go to `REVIEW`, which is consistent with `4.2 but contradicts the diagram. The diagram should show Step 3 ending at `REVIEW`, not `IN_PROGRESS`.

---

### I3 — `security_return` column inconsistency

**Files:** PAYROLL_DATABASE_SCHEMA.md `1 vs PAYROLL_API_CONTRACTS.md `2.2

DATABASE_SCHEMA adds `security_return` to the `users` table as a live salary config value. API_CONTRACTS `2.2 lists it as a patchable field on the salary config endpoint. However, PAYROLL_WORKFLOW.md `5.1 lists `security_return` as editable in Step 4 Review, which means it can be overridden per-run AND stored as a default on the user.

**Question:** Is `security_return` a recurring monthly amount (like `loan_emi`) or typically a one-time return? If one-time, storing it on `users` as a persistent default seems wrong -- it would carry forward to every future run unless manually zeroed out. Should it default to 0 on `users` and only be set per-run in Step 4?

---

### I4 — `notification_templates` table -- new or existing?

**Files:** PAYROLL_NOTIFICATIONS.md `4 vs PAYROLL_PLAN.md `7

NOTIFICATIONS.md `4 defines a `notification_templates` table with a `CREATE TABLE` statement. But PLAN.md `7 (Master Data Summary) references `master_notification_templates` as an existing leave-module table. Are these the same table? If the leave module already has `master_notification_templates`, the payroll module should INSERT rows into that table rather than creating a new `notification_templates` table.

**Action needed:** Clarify whether payroll seeds into the existing `master_notification_templates` or creates a parallel `notification_templates` table. Recommend using the existing table to avoid two template stores.

---

### I5 — `payroll_run_employees.snapshot_security_return` not in WORKFLOW snapshot list

**Files:** PAYROLL_DATABASE_SCHEMA.md `3 vs PAYROLL_WORKFLOW.md `3.2

DATABASE_SCHEMA defines `snapshot_security_return` on `payroll_run_employees`. WORKFLOW `3.2 lists the snapshot fields but omits `snapshot_security_return`. This field must be snapshotted like the others or it won't be available for the calculation engine.

---

### I6 — RBAC lists 4 roles but PLAN.md lists 6

**Files:** PAYROLL_RBAC.md `1 vs PAYROLL_PLAN.md `3

PLAN.md `3 defines 6 roles: Employee, Manager, HR Admin, Super Admin, Leave Admin, Reports Admin. RBAC.md `1 maps only 4 roles for payroll: SUPER_ADMIN, HR_MANAGER, REPORTS_ADMIN, EMPLOYEE. The naming also differs (`HR Admin` vs `HR_MANAGER`). While RBAC.md `1 states "leave-module roles like LEAVE_APPROVER or MANAGER are not granted payroll permissions," it doesn't explicitly mention `Leave Admin`.

**Action needed:** Add a note to RBAC.md confirming that `Leave Admin` has zero payroll permissions (or map it to something). Also reconcile naming: is the leave-module `HR Admin` the same as payroll's `HR_MANAGER`?

---

## 2. Gaps & Missing Specifications

### G1 — No `overtime_requests` table in leave module schema

PAYROLL_PLAN.md `6 and PAYROLL_WORKFLOW.md `3.1 reference `overtime_requests` as a table in the leave module that payroll imports from. However, the leave module's `PLAN.md` (the main project plan) does not mention overtime tracking at all. Neither `overtime_requests` nor an OT workflow appears anywhere in the leave-module scope.

**Critical question:** Does the `overtime_requests` table exist in the leave module today? If not, who builds it? The payroll calculation engine depends on OT hours -- without this table, OT pay will always be 0. This may need to be added to the leave module scope or built as part of the payroll module.

---

### G2 — No `wfh_entries` or `complimentary_off` tables referenced

PAYROLL_WORKFLOW.md `3.1 imports `wfh_days` from a `wfh_entries` table and `comp_off_days` from a `complimentary_off` table. These tables are not defined in the leave module's DATABASE_SCHEMA.md and are not mentioned in the main PLAN.md.

**Question:** Do these tables exist? If not, should the import step handle their absence gracefully (default to 0)?

---

### G3 — No specification for the "adjustment entry" mechanism (D19)

Decision D19 states that after lock, corrections require a "next-month adjustment entry." But no document specifies:
- How an adjustment entry is created in the next run
- Whether there is a dedicated field or flag for adjustments
- How it appears on the next month's payslip (separate line? merged into earnings/deductions?)
- Whether the audit trail links the correction to the original locked run

**Action needed:** Add an "Adjustments" section to PAYROLL_WORKFLOW.md or create a dedicated spec. Without this, admins have no formal mechanism for corrections beyond manually tweaking next month's `incentive` or `sal_deduction` fields.

---

### G4 — No `Bonus` payslip handling specified

PAYROLL_MASTER_DATA.md `6.1 seeds a `BONUS` earning type (code `BONUS`, display order 11). But no other document specifies:
- How bonuses are entered (per-run? per-employee? bulk?)
- Whether bonuses are separate from `incentive`/`fix_variable`
- How bonuses appear in the calculation engine (not referenced in CALCULATION_ENGINE.md at all)
- Whether bonus is included in `total_earnings`

RBAC.md `2.2 has a permission `payroll.run.add_bonus` but it has no corresponding API endpoint in API_CONTRACTS.md.

**Action needed:** Either add bonus handling to the calculation engine and API, or remove the bonus earning type and `add_bonus` permission from MVP scope.

---

### G5 — `el_hours` column defined but never consumed

DATABASE_SCHEMA.md `3 defines `el_hours` (Earned Leave hours) on `payroll_run_employees`. WORKFLOW.md `3.1 imports it. But the CALCULATION_ENGINE.md never reads or uses `el_hours`. The column comment says "informational only -- no salary impact." If it truly has no salary impact, it should not be in the import query contract -- it adds confusion.

**Action needed:** Confirm `el_hours` is display-only (payslip? reports?) or remove it from the schema.

---

### G6 — No specification for `designation` field on payslip

PAYSLIP_FORMAT.md `3 (Zone 2) shows `DESIGNATION : FULL STACK DEVELOPER`. But DATABASE_SCHEMA.md does not add a `designation` column to the `users` table, and no other payroll document mentions where this value comes from.

**Question:** Does the `users` table already have a `designation` field from the leave module? If not, it needs to be added to the ALTER TABLE in DATABASE_SCHEMA.md `1.

---

### G7 — Payslip Net Payable formatting contradiction

PAYSLIP_FORMAT.md `4.3 states "no thousand separators" for earning/deduction rows (matching the sample). But Zone 4 (`5) shows `Net Payable: 41,200.00` WITH a comma separator. FRONTEND_DESIGN.md `2.3 also notes payslip PDFs "do not use thousand separators" but then the sample layout in `4.3 contradicts itself.

**Action needed:** Decide: does the Net Payable line in Zone 4 use thousand separators or not? The sample payslip PDF should be the arbiter.

---

### G8 — No error handling for leave-module downtime during import

WORKFLOW.md `10 covers SMTP bounce, PDF errors, S3 failures, and import timeout. But it doesn't address what happens if the leave module's database is unavailable during Step 2 import (e.g., the leave DB is being migrated). Since payroll reads leave data via direct DB queries (not an API), a leave DB outage would cause import failure.

**Recommendation:** Add a recovery row to WORKFLOW.md `10: "Leave DB unavailable during import: import fails with clear error; admin retries when leave DB is restored. No partial data written."

---

### G9 — Missing `Idempotency-Key` implementation details

API_CONTRACTS.md `13 lists 5 endpoints supporting `Idempotency-Key` but provides no spec for:
- Where keys are stored (Redis? PostgreSQL?)
- Key format/length constraints
- Behavior when a key is reused with different request body (error? ignore body?)
- Cleanup policy beyond the 24h TTL

**Action needed:** Add implementation notes or defer idempotency to post-MVP (it's a nice-to-have for initial internal use).

---

## 3. Calculation Engine Questions

### C1 — Rounding accumulation across 7 components

CALCULATION_ENGINE.md `3 states intermediate results retain full precision, but `4.2 rounds each component individually. With 7 independent `round2()` calls, the sum of rounded payable amounts may not equal `round2(salForCalc)`.

Example: If `salForCalc = 35653.33`:
- BASIC 50%: `round2(35653.33 * 0.50) = 17826.67`
- HRA 20%: `round2(35653.33 * 0.20) = 7130.67`
- SP 15%: `round2(35653.33 * 0.15) = 5348.00`
- Conv 7%: `round2(35653.33 * 0.07) = 2495.73`
- LTC 5%: `round2(35653.33 * 0.05) = 1782.67`
- Med 2%: `round2(35653.33 * 0.02) = 713.07`
- Edu 1%: `round2(35653.33 * 0.01) = 356.53`
- **Sum: 35653.34** (off by +0.01 from salForCalc)

The testing spec (TESTING.md `7.1, PAY-CALC-COMP-002) and engine spec (`8) both allow `0.05 tolerance. But the payslip shows `total_earnings` which includes this sum. Should the last component absorb the rounding difference to force the sum to match exactly?

**Question:** Does the payslip need the 7-component payable sum to exactly equal `sal_for_calc`? If yes, implement a remainder-absorption strategy on the last component.

---

### C2 — PF calculated on actual basic -- what about LWP = 30?

CALCULATION_ENGINE.md `4.3 confirms PF is calculated on **actual** basic (gross-based, not LWP-adjusted). When LWP = 30, `salForCalc = 0` and all payable components = 0, but PF is still computed on full `basicActual`. This means an employee who was absent the entire month still has PF deducted.

**Question:** Is this the intended behavior? If an employee has zero payable salary, deducting PF from nothing results in negative net payable (clamped to 0). The employee effectively "owes" PF for a month they didn't work. Is this correct per Indian PF regulations, or should PF also be 0 when LWP = full month?

---

### C3 — `fix_variable` same in Actual and Payable columns

PAYSLIP_FORMAT.md `4.3 shows `FIX VARIABLE` with the same value in both Actual and Payable columns, noting "incentive is not LWP-affected." But is this a confirmed business decision? Some orgs pro-rate incentives for LWP months. If an employee has 15 LWP days, do they still get the full incentive?

**Question (for HR):** Is `fix_variable`/incentive always paid in full regardless of LWP days, or should it be pro-rated?

---

## 4. Database Schema Questions

### D1 — `payroll_items.professional_tax` defaults to 200

DATABASE_SCHEMA.md `4 defines `professional_tax NUMERIC(8,2) NOT NULL DEFAULT 200`. Hard-coding 200 as a DB default contradicts the "zero hardcoded values" principle. The calculation engine should always set this from `statutory.pt_flat_amount`. The DB default should be 0, with the engine providing the real value.

**Action needed:** Change `DEFAULT 200` to `DEFAULT 0` in the schema.

---

### D2 — CASCADE on payroll_runs deletion vs. "never delete released runs"

DATABASE_SCHEMA.md `12 states released runs should "never be deleted" (app-layer enforcement) but uses `ON DELETE CASCADE` from `payroll_runs` to child tables. If someone accidentally deletes a released run via direct SQL, all payroll_items, payslip_deliveries, and bank_transfer_files are silently cascaded away.

**Recommendation:** Use `ON DELETE RESTRICT` instead of CASCADE for `payroll_items`, `payslip_deliveries`, and `bank_transfer_files`. Only `payroll_run_employees` should CASCADE (for draft/cancelled run cleanup). Alternatively, add a DB trigger preventing deletion of runs in LOCKED/RELEASED/BANK_FILE_* states.

---

### D3 — No `created_by` on `payroll_salary_components` and other master tables

MASTER_DATA.md `3 defines `payroll_salary_components` with `updated_by` but no `created_by` or `created_at`. Most other tables in the project follow the `created_by/created_at/updated_by/updated_at` pattern. This makes it impossible to audit who initially seeded the data.

---

### D4 — `bank_transfer_files` has `UNIQUE (run_id)` -- only one file per run

DATABASE_SCHEMA.md `8 constrains `bank_transfer_files` to one file per run. But what if an admin needs to regenerate the file (e.g., after a correction)? The current constraint prevents inserting a second row. Should this be relaxed to allow multiple files with a `is_latest` flag?

---

### D5 — Missing index on `payroll_items.user_id + is_current` for YTD view

The `v_employee_ytd` view (`9) filters on `pi.is_current = TRUE` and groups by `pi.user_id`. The existing `idx_payroll_items_current` is a partial unique index on `(run_id, user_id) WHERE is_current = TRUE`. For the YTD view's query pattern, a composite index on `(user_id, is_current)` with an INCLUDE on the aggregated columns would improve performance.

---

## 5. API Contract Questions

### A1 — No PATCH endpoint for `payroll_run_employees` snapshot overrides

WORKFLOW.md `3.4 mentions "If LWP days exceed 30, cap at 30." But what if the import pulls incorrect LWP data (e.g., a leave request was approved by mistake and later cancelled)? There's no API to manually override `lwp_days` or `ot_hours` on the snapshot after import.

**Question:** Should there be a `PATCH /runs/:runId/employees/:userId` endpoint to allow admin manual correction of imported LWP/OT values before calculation? Without this, the only option is to cancel the run, fix the leave data, and re-create.

---

### A2 — `POST /runs/:runId/import` is synchronous for small counts -- threshold unclear

API_CONTRACTS.md `4.3 says import is "synchronous for small employee counts; for >500, returns immediately with a job ID." But this creates two different response shapes for the same endpoint, which complicates frontend handling.

**Recommendation:** Always return immediately with a job ID and let the frontend poll. Simpler contract, consistent UX.

---

### A3 — No bulk salary config endpoint

API_CONTRACTS.md `2 only has individual employee salary endpoints (`GET/PATCH .../employees/:userId/salary`). For initial setup or annual salary revisions affecting many employees, there's no bulk update endpoint.

**Question:** Is bulk salary update needed for MVP, or will admin update employees one-by-one?

---

### A4 — `pending_bank_changes_action` values not validated

API_CONTRACTS.md `9.2 shows `"pending_bank_changes_action": "use_old" | "exclude_employee"` in the bank file approve request. But "exclude_employee" means the employee doesn't get paid this month via the bank file. What happens to their payslip? Is their salary still marked as released? Is there a third option like "hold and pay separately"?

---

## 6. Workflow & Business Logic Questions

### W1 — Step 2 validation `2.2: "Reject if current date is before month-end"

WORKFLOW.md `2.2 says admin should not run payroll for an incomplete month, with a "configurable override." This is also tracked as Open Question Q8. But the phrasing is ambiguous -- does "month-end" mean the last calendar day of the month, or the last business day?

For example, if April 30 is a Saturday, can the admin run April payroll on April 29 (Friday)? This matters because the 30-day payroll cycle (D1) is independent of calendar days.

---

### W2 — Re-import discards edits warning but no undo

WORKFLOW.md `5.3 says re-import is allowed only if no Step 4 edits exist, and if edits exist, admin must confirm discard. But there's no undo mechanism after the discard confirmation. Consider requiring the admin to type a confirmation phrase (similar to lock) to prevent accidental data loss.

---

### W3 — No specification for what happens to payslip_deliveries on run cancellation

If a run is cancelled after payslips were partially generated (e.g., cancel during Step 5b), what happens to the already-generated PDFs on S3 and the already-sent emails? The workflow only allows cancellation up to REVIEW state, so this scenario shouldn't occur. But what if the system crashes during lock transition and the run is stuck?

**Action needed:** Add a "stuck run recovery" procedure to WORKFLOW.md `10.

---

### W4 — `CANCELLED` vs soft-delete semantics

WORKFLOW.md `8 shows `CANCELLED` as a terminal state. DATABASE_SCHEMA.md `2 allows only one active run per (month, year) via partial index `WHERE state <> 'CANCELLED'`. But there's no limit on how many cancelled runs can exist for the same month. Over time, a month could accumulate many cancelled runs.

**Question:** Should there be cleanup logic for cancelled runs, or are they retained indefinitely for audit purposes?

---

## 7. Notifications & Delivery Questions

### N1 — Payslip email `From` address inconsistency

NOTIFICATIONS.md `2 says emails come from `payroll@rockershr.com`. But PLAN.md `6 env vars show `SMTP_FROM="Rockers HR <hr.rockersinfo@gmail.com>"`. These are different domains (`rockershr.com` vs `rockersinfo@gmail.com`).

**Action needed:** Confirm which sending domain is used and ensure SPF/DKIM are configured for it.

---

### N2 — No notification for employee when their salary config changes

NOTIFICATIONS.md `3 has 11 templates but none for "your salary has been updated by admin." If admin changes an employee's gross or incentive, the employee has no way of knowing until the next payslip arrives.

**Question (for HR):** Should employees be notified when their salary config changes? This is a common transparency practice.

---

### N3 — N9 (bank file approved) sent to "audit contacts configured" -- where?

NOTIFICATIONS.md `3 (N9) says the bank file approval email goes to "the approving Super Admin + any audit contacts configured." But there's no `audit_contacts` table or field specified anywhere. This ties into Open Question Q7.

---

## 8. Frontend Design Questions

### F1 — Review screen (S4) column count is extreme

FRONTEND_DESIGN.md `6.5 lists ~26 columns in the review table header. Even with horizontal scroll, this is likely unusable. Consider:
- Grouping columns (Earnings | Deductions | Totals)
- A compact/expanded toggle
- A detail drawer per employee instead of all columns inline

---

### F2 — No mention of dark mode or theme support

FRONTEND_DESIGN.md does not mention dark mode. If the leave module supports theming, payroll screens should inherit the same theme.

---

### F3 — Employee portal "Current Month Preview" card data source unclear

FRONTEND_DESIGN.md `9.1 describes a "Current Month Preview" card showing "what net payable would be if run today." This requires running the calculation engine on-demand for the logged-in employee. But the `/me/salary` API (`10.1) only returns the current salary structure, not a calculated preview.

**Action needed:** Either add a `/me/salary-preview` endpoint that runs the engine with `lwp=0, ot=0`, or clarify that the preview is computed client-side from the salary structure.

---

## 9. Testing Spec Questions

### T1 — 123 test cases may be ambitious for MVP

TESTING.md lists 123 priority test cases across 10 suites. While comprehensive, this is a large test-authoring effort. Consider prioritizing the 22 calc engine cases and 15 workflow cases (37 total) as the "must-have" gate, with the remaining 86 as "should-have."

---

### T2 — PDF visual regression approach unclear

TESTING.md `4 mentions "pdf-lib parse + golden fixture diff" for PDF visual regression. But `pdf-lib` parses PDF structure, not visual appearance. If the goal is to verify layout, either:
- Use screenshot comparison (puppeteer render + pixelmatch)
- Use `pdf-lib` to extract text content and positions, then assert on those

The approach should be explicit to avoid ambiguity during implementation.

---

### T3 — No test cases for concurrent admin edits

WORKFLOW.md `9 mentions "last-write-wins for edits in Step 4" when two admins edit simultaneously. But TESTING.md has no test case covering this scenario. Consider adding a concurrency case to S02 (Workflow).

---

## 10. Open Questions Feedback

### On Q3 (Bank file format)
This is the highest-risk open question. The bank file is the final deliverable of each payroll run. Without the exact format confirmed, the generated file may be rejected by the bank. **Recommend making this a P0 blocker** -- get a sample file from the bank before building the generator.

### On Q9 (Mid-month salary changes)
The recommendation to use option (a) -- snapshot locks the whole month -- is pragmatic for MVP. But document this limitation prominently so HR knows that a promotion effective mid-month will only reflect in the next full month's payroll.

### On Q10 (Terminated employees)
Confirm F&F is out of scope, but also specify: what happens if an employee is deactivated AFTER Step 2 import but BEFORE Step 5 release? Their payslip would still generate. Is that correct? Should there be a "exclude employee from run" action in Step 4?

### On Q12 (Leave module dependency)
This is critical and currently unresolved. The payroll module's import step directly queries leave-module tables (`leave_requests`, `overtime_requests`, `wfh_entries`, `complimentary_off`). If any of these tables don't exist or have different column names, the import will fail. **Recommend formalizing an integration contract before implementation starts.**

---

## 11. Summary of Action Items

> **All items addressed in v2.3 update (2026-04-18).** P0 items escalated to PAYROLL_OPEN_QUESTIONS.md as formal blockers. All other items resolved directly in the affected files.

| # | Priority | Action | Status | Resolution |
| --- | --- | --- | --- | --- |
| 1 | P0 | Confirm `overtime_requests`, `wfh_entries`, `complimentary_off` tables exist in leave module (G1, G2) | ESCALATED | Added as Q15 (P0 blocker) in OPEN_QUESTIONS.md + §6.1 warning in PLAN.md |
| 2 | P0 | Formalize leave-module integration contract (Q12) | ESCALATED | Merged into Q15 in OPEN_QUESTIONS.md |
| 3 | P0 | Get bank file format from client's bank (Q3) | ESCALATED | Q3 marked as P0 blocker in OPEN_QUESTIONS.md |
| 4 | P1 | Fix state diagram: Step 3 ends at REVIEW, not IN_PROGRESS (I2) | RESOLVED | WORKFLOW.md §1 diagram updated |
| 5 | P1 | Remove `payroll_working_days_config` from MASTER_DATA inventory (I1) | RESOLVED | MASTER_DATA.md §2 + §5 updated, decision D22 |
| 6 | P1 | Clarify `notification_templates` vs `master_notification_templates` (I4) | RESOLVED | NOTIFICATIONS.md §4 updated to use existing table, decision D30 |
| 7 | P1 | Add `snapshot_security_return` to WORKFLOW.md snapshot list (I5) | RESOLVED | WORKFLOW.md §3.2 updated |
| 8 | P1 | Reconcile role naming between PLAN.md and RBAC.md (I6) | RESOLVED | RBAC.md §1 updated with mapping note |
| 9 | P1 | Specify adjustment entry mechanism for post-lock corrections (G3) | RESOLVED | WORKFLOW.md §10 added (full spec), decision D27 |
| 10 | P1 | Resolve bonus handling -- in MVP or not? (G4) | RESOLVED | Deferred to Phase 2, decision D29. Notes in MASTER_DATA, RBAC, API_CONTRACTS |
| 11 | P1 | Add `designation` to users table or confirm it exists (G6) | RESOLVED | DATABASE_SCHEMA.md §1 updated with ALTER TABLE |
| 12 | P2 | Change `professional_tax DEFAULT 200` to `DEFAULT 0` (D1) | RESOLVED | DATABASE_SCHEMA.md §4 updated |
| 13 | P2 | Consider RESTRICT instead of CASCADE for released run children (D2) | RESOLVED | DATABASE_SCHEMA.md §4, §5, §8, §12 updated, decision D28 |
| 14 | P2 | Decide on rounding remainder strategy for 7-component sum (C1) | RESOLVED | CALCULATION_ENGINE.md §4.2.1 added, decision D23 |
| 15 | P2 | Confirm PF behavior when LWP = 30 / full month absent (C2) | RESOLVED | CALCULATION_ENGINE.md §4.3 updated, decision D24 |
| 16 | P2 | Confirm incentive is not pro-rated for LWP (C3) | RESOLVED | CALCULATION_ENGINE.md §4.8 updated, decision D25 |
| 17 | P2 | Confirm payslip Net Payable line formatting -- comma or no comma (G7) | RESOLVED | PAYSLIP_FORMAT.md §1, §5 updated — no separators, decision D26 |
| 18 | P2 | Confirm SMTP from address (N1) | RESOLVED | NOTIFICATIONS.md §2 updated — uses shared SMTP_FROM env var |
| 19 | P3 | Add admin snapshot override endpoint or document the absence (A1) | RESOLVED | API_CONTRACTS.md §4.7 added PATCH endpoint |
| 20 | P3 | Add employee salary-change notification or document omission (N2) | RESOLVED | NOTIFICATIONS.md N12 added (in-app notification) |
| 21 | P3 | Add concurrent-edit test case to testing spec (T3) | RESOLVED | TESTING.md §7.2 PAY-WORKFLOW-CONCURRENT-001 added |

### Additional items resolved (not in original action list):

| Item | Resolution |
| --- | --- |
| A2 (always-async import) | API_CONTRACTS.md §4.3 updated — always returns job_id |
| A4 (pending_bank_changes_action) | API_CONTRACTS.md §9.2 expanded with `hold_separate` option |
| G5 (el_hours unused) | DATABASE_SCHEMA.md §3 annotated as informational-only |
| G8 (leave DB downtime) | WORKFLOW.md §11 recovery table updated |
| G9 (idempotency details) | API_CONTRACTS.md §13 expanded with implementation spec |
| W2 (re-import confirmation phrase) | WORKFLOW.md §5.3 updated |
| W3 (stuck run recovery) | WORKFLOW.md §11.1 added |
| D3 (missing created_by) | MASTER_DATA.md §3 schema updated |
| D4 (bank_transfer_files unique) | DATABASE_SCHEMA.md §8 relaxed to partial unique with is_latest |
| D5 (YTD index) | DATABASE_SCHEMA.md §9, §10 updated |
| I3 (security_return semantics) | DATABASE_SCHEMA.md §1 notes clarified |
| F1 (review screen columns) | FRONTEND_DESIGN.md §6.5 column grouping added |
| F2 (dark mode) | FRONTEND_DESIGN.md §12b added |
| F3 (salary-preview endpoint) | API_CONTRACTS.md §10.1b + FRONTEND_DESIGN.md §9.1 updated |
| T1 (priority tiers) | TESTING.md §7.11 added |
| T2 (PDF testing approach) | TESTING.md §4.1 added |
| N3 (audit contacts config) | NOTIFICATIONS.md §5.1 added with payroll_notification_recipients table |
| Q10 feedback (terminated employees) | OPEN_QUESTIONS.md Q16 added |
| Q9 feedback (mid-month salary) | OPEN_QUESTIONS.md Q17 added |

---

*End of PAYROLL_REVIEW.md. All 21 original action items addressed. 3 P0 items escalated as formal blockers in OPEN_QUESTIONS.md. All files bumped to v2.3.*
