# PAYROLL_OPEN_QUESTIONS.md

**Scope:** Pending decisions, unresolved items, and future-phase topics for the payroll module. Items move out of this file into the relevant `PAYROLL_*.md` file once resolved, with the BRD version bumped.
**Version:** v2.3

Cross-refs:
- Decisions already resolved → `PAYROLL_PLAN.md` §5 (Decisions Log)
- Leave-module open questions → `OPEN_QUESTIONS.md` (separate file)

---

## 1. Resolved in v2.2 (for the record)

The following open questions from BRD v1.0 / v2.0 were **closed in v2.2** and should not be re-opened here:

| Old question | Resolution | Landed in |
| --- | --- | --- |
| Financial year for YTD | ✅ April–March (Indian FY) | D12 |
| Payroll release day | ✅ Admin sets per run, no fixed date | D13 |
| Bank transfer file | ✅ Yes, NEFT/RTGS format, admin approval mandatory | D14 |
| OT working hours per day | ✅ 9 hours (not 8) | D7 |
| Present Days formula | ✅ WD − LWP only | D10 |
| Payslip field 'COM Leave' | ✅ Renamed to 'Complimentary Off' | D15 |
| PF formula | ✅ Conditional form: `basic >= 15000 ? 1800 : round(basic * 0.12)` | D4 |
| OT base | ✅ Gross-based (not CTC-based) | D7 |
| ESIC rates | ✅ 3.25% employer + 0.75% employee | D9 |

## 2. Active Open Questions

These items are **not blocking MVP implementation** but should be decided before certain downstream milestones.

### Q1 — Tax Calculation Module Timeline

| | |
| --- | --- |
| Topic | Automated TDS calculation with old vs. new tax regime selector, Form 16 generation |
| Why it matters | Currently TDS is manually entered per employee per month. That works but scales poorly. |
| Current workaround | Admin enters TDS value in salary config (stored in `users.tds`), snapshotted per run. |
| Needed for | Phase 2 only. Not blocking MVP. |
| Decision needed | (a) When to build? (b) Scope: Old regime only, or both regimes with comparison? (c) Form 16 inclusion? |
| Priority | Phase 2 |
| Asking | HRBhrugisha V |

### Q2 — ESIC Activation Plan

| | |
| --- | --- |
| Topic | When to activate the ESIC module (`payroll_statutory_config.esic_active = TRUE`) |
| Why it matters | Currently no employees are below the ₹21,000 gross threshold, so ESIC is off. Hiring plans may change this. |
| Current state | Module scaffolded: tables, columns, engine stubs all exist. Single toggle activates it. |
| Decision needed | (a) Is any future hire likely to be below ₹21,000? (b) If yes, when (date/quarter)? (c) Will client register with ESIC authority in advance? |
| Priority | Future — no impact on MVP |
| Asking | HRBhrugisha V |

### Q3 — Bank Transfer File — Exact Format **[P0 BLOCKER — v2.3]**

| | |
| --- | --- |
| Topic | The exact file format for NEFT/RTGS bulk upload, specific to the client's bank |
| Why it matters | **P0 (v2.3 Review):** The file goes directly to the bank; wrong format = file rejected = payroll delayed. This is the highest-risk open question — get a sample file from the bank before building the generator. |
| Current state | Generic placeholder format (`DEFAULT_NEFT` in `payroll_bank_file_formats`) with columns: Employee Name, Bank Name, A/C No, IFSC, Amount |
| Decision needed | (a) Which bank is client using (sample payslip says "RELIANCE" for the A/C but company bank may be different)? (b) Does that bank want .txt / .csv / .xml? (c) Does it want a header row? Custom delimiter? Reference ID? |
| Priority | Before first go-live payroll run |
| Asking | Client's finance team + bank relationship manager |

### Q4 — PDF Generation Library

| | |
| --- | --- |
| Topic | Which NestJS-compatible library to use for payslip PDF generation |
| Why it matters | Core technical decision; affects dev velocity + deployment size |
| Options evaluated | `pdfkit` (recommended), `puppeteer`, `@react-pdf/renderer`, `pdfmake` |
| Recommended | `pdfkit` — lightweight, pure JS, table layout straightforward, no Chromium dependency |
| Decision needed | Rakesh to confirm default; no client input needed |
| Priority | Before PDF implementation sprint |
| Asking | Rakesh Patel (self) |

### Q5 — Payslip PDF Retention Period

| | |
| --- | --- |
| Topic | How long to retain payslip PDFs in S3 |
| Why it matters | Indian statutory minimum is 7 years for employment records. Storage cost at scale. |
| Decision needed | (a) Retain indefinitely (safer, storage is cheap)? (b) Archive older than 7 years to Glacier? (c) Define explicit retention policy for legal compliance officer? |
| Priority | Pre go-live (can default to "indefinite" and revisit) |
| Asking | Client legal/compliance |

### Q6 — Company PIN Code

| | |
| --- | --- |
| Topic | PIN code for the company address on payslip |
| Why it matters | Current address "3rd Floor, Corner Heights, Kalali Road, Vadodara" lacks a PIN code. Payslip shows the address; PIN code is typical for formal documents. |
| Decision needed | Get PIN code for seed `company_profile` row |
| Priority | Pre first payslip release |
| Asking | HRBhrugisha V |

### Q7 — Admin Notification Recipients for Payslip Bounces

| | |
| --- | --- |
| Topic | Who receives N2 (payslip delivery failure) alerts |
| Why it matters | Currently "admins" is vague. Could be all Super Admins, or a dedicated payroll-ops mailbox. |
| Options | (a) All Super Admins + HR Managers; (b) Only the admin who triggered the release; (c) A configurable mailing list stored in master data |
| Recommended | (c) — flexible, lowest surprise. Add a `notification_recipients` table during implementation. |
| Priority | Before Phase 1 go-live |
| Asking | HRBhrugisha V |

### Q8 — Payroll Calendar Lookahead

| | |
| --- | --- |
| Topic | Can admin create a payroll run for a future month (e.g., create April 2026 run on March 28)? |
| Why it matters | Some orgs prepare payroll ahead of month-end. Others wait. |
| Current state | Workflow §2.2 mentions a "configurable override" for mid-month advance runs but the override mechanism is undefined. |
| Decision needed | (a) Allow future-month runs freely? (b) Soft warning + override? (c) Hard block until month ends? |
| Priority | Can be resolved during Step 1 UX design |
| Asking | HRBhrugisha V |

### Q9 — Handling Mid-Month Salary Changes

| | |
| --- | --- |
| Topic | If an employee's `gross` changes mid-month (promotion, correction), how should the next payroll reflect it? |
| Why it matters | Currently the snapshot captures the `gross` at Step 2 import time. A change on day 15 is not pro-rated. |
| Options | (a) Snapshot locks the whole month's gross to Step 2 value (current behavior); (b) Pro-rate — pay old gross for days 1–15, new gross for days 16–30; (c) Manual adjustment via `incentive` field |
| Recommended | (a) for MVP. Pro-ration adds complexity that none of the 5 sample employees exhibited. |
| Priority | Confirm default behavior with HR |
| Asking | HRBhrugisha V |

### Q10 — Terminated Employees' Final Payroll

| | |
| --- | --- |
| Topic | How to handle an employee who leaves mid-month — full & final settlement |
| Why it matters | Current scope is monthly payroll for active employees. F&F involves leave encashment, notice pay, gratuity, etc. — separate module territory. |
| Decision needed | Confirm F&F is Phase 2 (or Phase 3) and not shoehorned into current payroll engine. |
| Priority | Scoping clarification |
| Asking | HRBhrugisha V |

### Q11 — Report Email-to-Self

| | |
| --- | --- |
| Topic | `PAYROLL_FRONTEND_DESIGN.md` §8.2 describes "Email to me" button for reports. Is this in MVP scope? |
| Why it matters | Small feature, but requires email template + rate limiting |
| Priority | Nice-to-have for MVP, safe to defer to Phase 2 |
| Asking | HRBhrugisha V |

### Q12 — Leave-Module Dependency Versions

| | |
| --- | --- |
| Topic | Payroll reads from `leave_requests` and `overtime_requests`. What leave-module version is assumed? |
| Why it matters | Leave module is at BRD v1.9. Column names + statuses may drift. |
| Current assumption | Leave `leave_type` values include 'LWP', 'CL', 'SL', 'PL'; status 'approved'. `overtime_requests` table has `status`, `hours`, `date`, `user_id`. |
| Decision needed | Formalize the read-contract between modules. Add to `PAYROLL_WORKFLOW.md` §3 as "Integration Contract v1". |
| Priority | Before implementation sprint starts |
| Asking | Rakesh Patel (self — sync with leave module spec) |

### Q13 — TestMo Project Setup Confirmation

| | |
| --- | --- |
| Topic | TestMo project ID, API token location, and suite auto-creation policy |
| Why it matters | `PAYROLL_TESTING.md` assumes a TestMo project exists named `Rockers HR — Payroll` with suites S01–S10. Needs confirmation that project exists (or creation is scheduled). |
| Decision needed | (a) Confirm TestMo project key + numeric ID; (b) Who has admin rights to create suites? (c) Should suites be pre-seeded via API (scriptable) or created manually by QA lead? |
| Priority | Before Lane 1 QA authoring begins |
| Asking | Rakesh Patel (self — check existing TestMo instance) |

### Q14 — TestMo Automated Case Creation Policy

| | |
| --- | --- |
| Topic | When a Jest/Playwright test runs with an unknown `PAY-*` ID, should TestMo auto-create the case or reject the result? |
| Why it matters | `PAYROLL_TESTING.md` §9.3 recommends **reject** (prevents silent drift of test inventory). But during rapid early development, auto-create may accelerate things. |
| Options | (a) Strict: reject unknown IDs (safer, more discipline); (b) Permissive: auto-create under a "Uncategorized" section (faster bootstrap); (c) Hybrid: permissive until a go-live gate, strict after |
| Recommended | (c) Hybrid |
| Priority | Can decide after first 20 cases are authored |
| Asking | QA lead + Rakesh |

### Q15 — Leave Module Dependency Tables (v2.3) **[P0 BLOCKER]**

| | |
| --- | --- |
| Topic | The payroll import step (Step 2) directly queries `overtime_requests`, `wfh_entries`, and `complimentary_off` tables from the leave module. These tables are NOT defined in the leave module's DATABASE_SCHEMA.md or PLAN.md. |
| Why it matters | **P0:** If these tables don't exist, the import will fail. OT pay depends on `overtime_requests`. WFH/Comp Off days appear on the payslip working details. |
| Current state | `leave_requests` exists and has LWP/CL/SL/PL types. `overtime_requests`, `wfh_entries`, and `complimentary_off` are referenced by payroll but may not exist. |
| Decision needed | (a) Confirm these tables exist in the leave module. (b) If not, define them as part of payroll module scope or add to leave module backlog. (c) If deferred, update payroll import to handle missing tables gracefully (default to 0 for OT hours, WFH days, Comp Off days). |
| Priority | **P0 — Must resolve before implementation sprint** |
| Asking | Rakesh Patel (self — check leave module codebase) |

### Q16 — Terminated Employee During Active Run (v2.3)

| | |
| --- | --- |
| Topic | What happens if an employee is deactivated AFTER Step 2 import but BEFORE Step 5 release? |
| Why it matters | The employee's salary was snapshot and calculated, but they are now terminated. Their payslip would still generate. |
| Options | (a) Generate payslip anyway — it's their final month's salary; (b) Add an "exclude employee from run" action in Step 4 Review; (c) Flag the employee in Review with a warning, let admin decide |
| Recommended | (c) — flag with warning, let admin decide. Exclusion should not be automatic since the employee may still be owed salary for the month. |
| Priority | Before first go-live |
| Asking | HRBhrugisha V |

### Q17 — Mid-Month Salary Change Documentation (v2.3)

| | |
| --- | --- |
| Topic | Document the limitation that mid-month salary changes (promotions, corrections) are not pro-rated in MVP |
| Why it matters | HR needs to know that a promotion effective day 15 of the month will not be split across old/new gross. The new gross takes effect from the next full payroll run after snapshot. |
| Decision needed | Confirm this is acceptable for MVP. If yes, add a prominent note to the Employee Salary Config screen so admins are aware. |
| Priority | Documentation — not code-blocking |
| Asking | HRBhrugisha V |

## 3. Phase 2 / Future Items (Tracked, Not Blocking)

| # | Item | Notes |
| --- | --- | --- |
| F1 | Flutter mobile app for payroll | Wireframe S9 already drafted; APIs already available (`/me/**`) |
| F2 | Automated TDS calculation (Q1 above) | |
| F3 | ESIC activation (Q2 above) | |
| F4 | Full & Final settlement (Q10 above) | |
| F5 | Form 16 generation | Tied to tax module |
| F6 | Multi-entity payroll | If client expands to multiple legal entities |
| F7 | Pro-rated mid-month joins/exits | Current engine treats snapshot as the source of truth |
| F8 | Custom fields on payslip | Some clients want a "Remarks" or one-off notes row |
| F9 | Payslip QR code linking to online version | Convenience feature |
| F10 | Bonus / Diwali / 13th month payroll runs | Special one-off runs outside monthly cycle |
| F11 | Salary revision / appraisal integration | Automated gross bump from appraisal system |
| F12 | External payroll APIs | Allow accounting software to pull data |

## 4. Clarifications Requested from HRBhrugisha V

Consolidated list (for convenience, grouped by the `Q` numbers above):

- [Q1] Tax module timeline preference
- [Q2] ESIC activation timing, if ever
- [Q3] Bank transfer file format (requires bank coordination)
- [Q5] Payslip retention policy
- [Q6] Company PIN code
- [Q7] Admin notification recipients for failures
- [Q8] Future-month run permission
- [Q9] Mid-month salary change handling
- [Q10] F&F scope confirmation
- [Q11] Report email-to-self in MVP?
- [Q13] TestMo project ID + suite auto-creation policy *(internal, not for HR)*
- [Q14] Automated test case creation policy *(internal, not for HR)*
- **[Q15] Leave module dependency tables — do overtime_requests, wfh_entries, complimentary_off exist? *(P0 blocker, internal)*
- [Q16] Terminated employee during active run — generate payslip or exclude?
- [Q17] Mid-month salary change limitation documentation

## 5. Decision Log Protocol

When any question here is resolved:

1. Get explicit confirmation (email, meeting minutes, or chat with decision-maker).
2. Add a new row to `PAYROLL_PLAN.md` §5 (Decisions Log) with ID `D{n+1}`.
3. Update every file listed in "Files Affected" for the new decision.
4. Remove the question from this file (or mark with "RESOLVED — see D{n}").
5. Bump BRD version (v2.2 → v2.3).

## 6. Version History

| Version | Changes |
| --- | --- |
| v2.2 | Initial open questions file. 12 items tracked. |
| v2.2.1 | Added Q13 (TestMo project setup) and Q14 (automated case creation policy) following introduction of `PAYROLL_TESTING.md`. Total tracked: 14 items. |
| v2.3 | Added Q15 (leave-module dependency tables — P0), Q16 (terminated employee during run), Q17 (mid-month salary change docs). Marked Q3 as P0 blocker. Total tracked: 17 items. |

---

*End of PAYROLL_OPEN_QUESTIONS.md — and final file in the PAYROLL_* planning series.*
