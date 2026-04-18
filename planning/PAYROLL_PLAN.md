# PAYROLL_PLAN.md

**Module:** Payroll Management System (extension of Rockers HR Leave Management System)
**BRD Version:** v2.3 (v2.2 verified against `Sample_Pay_Slip.pdf` + `Sample_Salary_Sheet.xls`; v2.3 cross-file review fixes)
**Phase:** Phase 1 — MVP
**Last updated:** v2.3 sync

---

## 1. Purpose of This Folder

This `/planning` directory is the shared memory for all coding agents working on Rockers HR. The **payroll module** is added as a sibling feature to the existing leave management system. All payroll-specific planning files are prefixed `PAYROLL_*.md` so that leave-management planning files remain untouched and the two modules can evolve independently while sharing core infrastructure (users, auth, RBAC scaffolding, audit log, notifications transport).

## 2. Core Architectural Principle (inherited from leave module)

> **Zero hardcoded values.** Every salary component percentage, statutory cap, rate, and configuration is stored in master database tables and is admin-configurable. No `const BASIC_PERCENT = 50` anywhere in the code — always fetched from `payroll_salary_components`.

This is enforced across the payroll calculation engine, payslip generator, and all reports.

## 3. Module Scope Summary

### ✅ In Scope — Phase 1 MVP

| Area | Included |
| --- | --- |
| Salary config | Per-employee Gross, Incentives/Fixed Variable, TDS, Loan EMI, Sal Deduction, PF applicability flag |
| Salary components | 7 components as % of Sal for Calc, all stored in master (Basic 50, HRA 20, SP 15, Conv 7, LTC 5, RE Med 2, Edu 1) |
| CTC auto-calc | Gross + Employer PF + Incentives |
| Salary for Calc | Gross − LWP Deduction (LWP imported from Leave System) |
| Overtime pay | Gross ÷ 30 ÷ 9 × 1.5 (9-hr working day, confirmed) |
| Employee PF | Conditional: if Basic ≥ ₹15,000 → ₹1,800 fixed; else 12% × Basic |
| Employer PF | Same conditional logic as Employee PF; included in CTC only |
| Professional Tax | ₹200 fixed for all employees (all earn ≥ ₹15,000) |
| TDS / Loan / Sal Deduction | Manual admin entries per employee per month |
| ESIC module | Scaffolded, **NOT activated** (Employer 3.25%, Employee 0.75%; threshold Gross < ₹21,000) |
| 5-step payroll run | Select → Import → Calculate → Review → Lock & Release |
| Payslip | Password-protected PDF (DOB in DDMM), exact match to sample payslip, auto-emailed via SMTP |
| Employee self-service | Download payslips, salary breakdown view, investment proof upload, bank detail change request |
| Bank change workflow | Employee submits → Admin approves → updated for next payroll |
| Reports | Salary Register, Department Cost, Payroll Summary (M/Q/Y), Compliance — CSV + PDF export |
| Bank transfer file | NEFT/RTGS bulk upload file — **admin approval mandatory** before generation |
| RBAC | Layered on existing Leave System roles |
| FY | April–March (Indian Financial Year) — YTD resets April 1 |
| Release day | Admin sets per payroll run (no fixed date) |
| Platform | Web only for MVP |

### ❌ Out of Scope — Phase 2 (Post-MVP)

- Mobile Flutter app for payroll (leave module already has Flutter; payroll Phase 2)
- Tax calculation module (old vs new regime) with Form 16 generation
- ESIC activation (no current employees below ₹21,000 gross)
- Payroll API for external integration
- Advanced analytics / custom dashboards
- Multi-company / multi-entity payroll

## 4. Planning File Index (Payroll Module)

| # | File | Purpose |
| --- | --- | --- |
| 1 | `PAYROLL_PLAN.md` | *(this file)* Overview, scope, decisions log, integration map |
| 2 | `PAYROLL_WORKFLOW.md` | 5-step monthly payroll run, bank transfer file flow, payslip release |
| 3 | `PAYROLL_DATABASE_SCHEMA.md` | All payroll tables (transactional + derived) |
| 4 | `PAYROLL_MASTER_DATA.md` | Salary components master, statutory rates, PF/ESIC/PT config |
| 5 | `PAYROLL_API_CONTRACTS.md` | REST endpoints for admin + employee self-service |
| 6 | `PAYROLL_RBAC.md` | 10 payroll permissions mapped to roles |
| 7 | `PAYROLL_NOTIFICATIONS.md` | Email templates, in-app notifications, triggers |
| 8 | `PAYROLL_FRONTEND_DESIGN.md` | 9 screens: config, run, payslip, reports, portal, bank, calc engine, corrections banner, mobile stub |
| 9 | `PAYROLL_CALCULATION_ENGINE.md` | Deterministic formula engine (NestJS pseudocode) |
| 10 | `PAYROLL_PAYSLIP_FORMAT.md` | PDF layout matching sample, password rule, SMTP delivery |
| 11 | `PAYROLL_TESTING.md` | TestMo test strategy, suite structure, case IDs, automation integration, parallel QA workflow |
| 12 | `PAYROLL_OPEN_QUESTIONS.md` | Pending items (tax calc timeline, ESIC activation, etc.) |

## 5. Confirmed Decisions Log (v2.2)

All items below are **decided and locked**. Changes require BRD version bump and propagation across all affected `PAYROLL_*.md` files.

| # | Decision | Source | Files Affected |
| --- | --- | --- | --- |
| D1 | Payroll cycle is always 30 working days regardless of calendar month (28/29/30/31) | Meeting + sample payslip | CALCULATION_ENGINE, WORKFLOW |
| D2 | All 7 component %s (Basic/HRA/SP/Conv/LTC/Med/Edu = 50/20/15/7/5/2/1) are admin-configurable master data; must sum to 100% | BRD §2.2 | MASTER_DATA, CALCULATION_ENGINE, DATABASE_SCHEMA |
| D3 | Salary for Calc (SFC) = Gross − (Gross ÷ 30 × LWP days). All 7 components apply to SFC, **not raw Gross** | Sample salary sheet | CALCULATION_ENGINE, PAYSLIP_FORMAT |
| D4 | PF uses conditional logic: `basic >= 15000 ? 1800 : round(basic * 0.12)`. Do **NOT** implement as `MIN(basic, 15000) * 0.12` — ₹1,800 is a statutory fixed ceiling | BRD Addendum | CALCULATION_ENGINE, MASTER_DATA |
| D5 | CTC = Gross + Employer PF + Incentives/Fixed Variable. Employer PF is in CTC but **not** a payslip deduction | BRD §2.4 | CALCULATION_ENGINE, PAYSLIP_FORMAT |
| D6 | CTC As Per IT = Gross + Incentives (no Employer PF — for TDS/income tax purposes only) | BRD §2.4 | CALCULATION_ENGINE, API_CONTRACTS |
| D7 | OT rate = Gross ÷ 30 ÷ **9** × 1.5 (9-hour working day, **not 8**) | BRD Addendum §2 | CALCULATION_ENGINE, MASTER_DATA |
| D8 | Professional Tax = ₹200 fixed for all employees (all earn ≥ ₹15,000 threshold) | BRD §2.6 | MASTER_DATA, CALCULATION_ENGINE |
| D9 | ESIC module built but inactive. Rates: Employer 3.25% + Employee 0.75% of Gross. Threshold < ₹21,000 gross | BRD §2.6 | MASTER_DATA, CALCULATION_ENGINE |
| D10 | Present Days = WD (30) − LWP days **only**. CL/SL/PL/WFH/Complimentary Off do NOT reduce Present Days | BRD Addendum §3 | PAYSLIP_FORMAT, CALCULATION_ENGINE |
| D11 | Payslip PDF password = DOB in DDMM format (e.g., 14 March → `1403`) | BRD §3.5 | PAYSLIP_FORMAT |
| D12 | FY for YTD = April–March (Indian FY). YTD resets every April 1 | BRD Addendum §1 | DATABASE_SCHEMA, API_CONTRACTS |
| D13 | Payroll release day = admin sets per run. No fixed calendar date | BRD Addendum §1 | WORKFLOW |
| D14 | Bank transfer file = NEFT/RTGS bulk upload. Admin approval **mandatory** before file is generated for download | BRD Addendum §1 | WORKFLOW, RBAC, DATABASE_SCHEMA |
| D15 | Payslip label 'COM Leave' renamed to 'Complimentary Off' | BRD Addendum §4 | PAYSLIP_FORMAT |
| D16 | Some employees may be PF-exempt. Admin flag `pf_applicable = false` at employee level | BRD §2.3 | DATABASE_SCHEMA, CALCULATION_ENGINE |
| D17 | Employee earning rows on payslip show two sub-columns: **Actual** (full month) and **Payable** (LWP-adjusted) | Sample payslip | PAYSLIP_FORMAT |
| D18 | Payroll audit logging uses the same `nestjs-audit-logger` library already in use for leave module | Inherited from leave BRD v1.9 | DATABASE_SCHEMA, RBAC |
| D19 | Payroll lock is irreversible for that month. No edits allowed after lock. Corrections require next-month adjustment entry | BRD §6 Step 5 | WORKFLOW, RBAC |
| D20 | Salary component percentage changes take effect **from next payroll month**, not retroactively | BRD §2.2 | MASTER_DATA, WORKFLOW |
| D21 | Test case management uses **TestMo** (plugins already installed). All payroll test cases live under a single TestMo project `Rockers HR — Payroll`, with suites mirroring the planning files. Automated runs submit via `testmo` CLI (JUnit XML). Parallel test-authoring begins once planning folder is committed | Client tooling choice | TESTING, PLAN |
| D22 | `payroll_working_days_config` table removed — working-day config lives exclusively in `payroll_statutory_config` (single source of truth) | v2.3 Review I1 | MASTER_DATA |
| D23 | 7-component rounding remainder absorbed by last component (EDUCATION) to guarantee exact sum | v2.3 Review C1 | CALCULATION_ENGINE, TESTING |
| D24 | PF is deducted even when LWP = 30 (full month absent) — per Indian EPFO regulations, PF is mandatory regardless of attendance | v2.3 Review C2 | CALCULATION_ENGINE |
| D25 | Incentive (fix_variable) is NOT pro-rated for LWP — paid in full regardless of absent days | v2.3 Review C3 | CALCULATION_ENGINE, PAYSLIP_FORMAT |
| D26 | Payslip PDF uses NO thousand separators anywhere — all amounts in plain decimal format (e.g., `41200.00` not `41,200.00`) | v2.3 Review G7 | PAYSLIP_FORMAT, FRONTEND_DESIGN |
| D27 | Post-lock corrections use next-month adjustment entries via editable fields (incentive/sal_deduction). No dedicated adjustment line item in MVP | v2.3 Review G3 | WORKFLOW |
| D28 | `payroll_items`, `payslip_deliveries`, `bank_transfer_files` use `ON DELETE RESTRICT` (not CASCADE) to protect released payroll data | v2.3 Review D2 | DATABASE_SCHEMA |
| D29 | Bonus earning type is seeded but NOT processed by calculation engine in MVP. `payroll.run.add_bonus` permission is deferred to Phase 2 | v2.3 Review G4 | MASTER_DATA, RBAC, API_CONTRACTS |
| D30 | Payroll notifications use the existing `master_notification_templates` table from the leave module — no separate template table | v2.3 Review I4 | NOTIFICATIONS |

## 6. Integration with Leave Management System

The payroll module **reads from** the leave module. There is no write-back from payroll to leave.

```
┌─────────────────────────────────────┐         ┌─────────────────────────────────────┐
│  LEAVE MANAGEMENT (existing)        │         │  PAYROLL (new)                      │
│                                     │         │                                     │
│  • users (shared)                   │ ───────▶│  • reads users (Gmail, DOJ, DOB)    │
│  • leave_requests                   │         │                                     │
│    └─ where type='LWP' & approved   │ ───────▶│  • imports LWP days → SFC calc      │
│  • overtime_requests                │         │                                     │
│    └─ where status='approved'       │ ───────▶│  • imports OT hours → OT pay calc   │
│  • audit_log (nestjs-audit-logger)  │ ◀─────▶ │  • writes payroll audit events      │
│  • notifications transport          │ ◀─────▶ │  • uses same SMTP + in-app channel  │
└─────────────────────────────────────┘         └─────────────────────────────────────┘
```

Integration points in code:

| Payroll needs | Source (leave module) | When |
| --- | --- | --- |
| Employee master (name, emp_no, DOJ, DOB, Gmail, bank, department) | `users` table | On payroll run start (Step 1) |
| LWP days for the month | `leave_requests WHERE leave_type='LWP' AND status='approved' AND date BETWEEN month_start AND month_end` | Step 2 (import) |
| OT approved hours for the month | `overtime_requests WHERE status='approved' AND date BETWEEN month_start AND month_end` | Step 2 (import) |
| Paid leave counters (CL/SL/PL) for payslip working details | same `leave_requests` aggregated | Step 3 (calculate) |

See `PAYROLL_WORKFLOW.md` §2 for exact import query contracts.

### 6.1 Leave Module Dependency Warning (v2.3)

> **P0 Blocker (Review items G1, G2, Q15):** The payroll import step queries three tables that are NOT currently defined in the leave module's DATABASE_SCHEMA.md or PLAN.md:
> - `overtime_requests` — source of OT hours for OT pay calculation
> - `wfh_entries` — source of WFH day counts for payslip working details
> - `complimentary_off` — source of comp-off day counts for payslip working details
>
> **Before implementation begins**, confirm whether these tables exist in the leave module. If they don't:
> - Option A: Build them as part of payroll module scope (import will create the tables).
> - Option B: Add them to the leave module backlog and implement before payroll import.
> - Option C: Make the import handle missing tables gracefully (default OT/WFH/CompOff to 0 and log a warning).
>
> This is tracked in `PAYROLL_OPEN_QUESTIONS.md` Q15.

## 7. Tech Stack Recap

Inherited from the leave module — no additions for payroll MVP:

| Layer | Tech |
| --- | --- |
| Admin web | Next.js (React) |
| API backend | NestJS (Node.js) |
| Database | PostgreSQL |
| File storage | AWS S3 (encrypted bucket for payslip PDFs + investment proofs) |
| Email transport | SMTP |
| Audit log | `nestjs-audit-logger` |
| Mobile | Flutter — **Phase 2 only** for payroll |
| PDF generation | (TBD — `pdfkit` or `puppeteer`; see `PAYROLL_PAYSLIP_FORMAT.md` §6) |
| Test management | **TestMo** (CLI + plugins already installed; see `PAYROLL_TESTING.md`) |
| Test frameworks | Jest (NestJS unit + integration), Supertest (API), Playwright (Next.js E2E), widget tests (Flutter, Phase 2) |

## 8. Planning Methodology (inherited from leave module)

1. BRD version locks → planning folder propagation
2. Every confirmed decision is traced to **every** file it affects (see Decisions Log column "Files Affected")
3. Open questions live in `PAYROLL_OPEN_QUESTIONS.md` and are removed once resolved
4. Planning files are agent-consumable: precise, structured, self-contained within domain
5. Cross-file references use explicit file + section anchors (e.g., `PAYROLL_CALCULATION_ENGINE.md §4.2`)

## 9. Version History

| Version | Date | Changes |
| --- | --- | --- |
| v2.2 | prior | Initial creation of PAYROLL_* planning folder. All 20 decisions from BRD v2.2 captured. Verified against Sample_Pay_Slip.pdf (RT-DEV-153, March 2026) and Sample_Salary_Sheet.xls (ABC/PQR/HSBC/Reliance). |
| v2.2.1 | prior | Added `PAYROLL_TESTING.md` for TestMo integration. New decision **D21** covering test management tooling. Tech stack extended with test frameworks. Enables parallel QA authoring alongside implementation. |
| v2.3 | current | **Cross-file review.** 9 new decisions (D22–D30). Fixed: state diagram (I2), duplicate working-days table removed (I1/D22), snapshot_security_return added (I5), role naming reconciled (I6), PT default 200→0 (D1), CASCADE→RESTRICT on released data (D2/D28), bank_transfer_files allows regeneration (D4), YTD index added (D5), designation column added (G6), rounding remainder absorption (C1/D23), LWP=30 PF clarified (C2/D24), incentive not pro-rated (C3/D25), payslip formatting unified (G7/D26), adjustment entry mechanism added (G3/D27), bonus deferred (G4/D29), notification table unified (I4/D30), leave DB downtime recovery (G8), stuck run recovery (W3), re-import confirmation phrase (W2), snapshot override API (A1), always-async import (A2), bank change action options expanded (A4), idempotency details (G9), salary-preview endpoint (F3), salary-change notification (N2), notification recipients config (N3), column grouping for review screen (F1), dark mode note (F2), PDF testing clarified (T2), concurrent edit test added (T3), priority tiers (T1). 3 new open questions (Q15–Q17). |

---

*End of PAYROLL_PLAN.md. Next file: PAYROLL_WORKFLOW.md — the 5-step monthly payroll run.*
