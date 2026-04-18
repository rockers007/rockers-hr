# PAYROLL_FRONTEND_DESIGN.md

**Scope:** UI specification for the 9 payroll screens. Derived from `Payroll_for_Rockers_HR_Wireframes_v2_2.html`. All screens are Next.js (React) pages living under `/admin/payroll/**` and `/me/payroll/**` in the existing Rockers HR web app.
**Version:** v2.3

Cross-refs:
- API endpoints each screen consumes → `PAYROLL_API_CONTRACTS.md`
- Role-based gating of buttons/menus → `PAYROLL_RBAC.md`
- Data shape → `PAYROLL_DATABASE_SCHEMA.md`

---

## 1. Screen Inventory

From the wireframes, the 9 screens are:

| # | Screen ID in wireframes | Route in app | Primary actor |
| --- | --- | --- | --- |
| S1 | `screen-corrections` | `/admin/payroll/corrections-banner` *(component, not a page)* | All admins (info banner) |
| S2 | `screen-calc-engine` | `/admin/payroll/master/formulas` | Super Admin |
| S3 | `screen-salary-config` | `/admin/payroll/employees/[userId]/salary` | Super Admin, HR Manager |
| S4 | `screen-payroll-run` | `/admin/payroll/runs/[runId]` | Super Admin, HR Manager |
| S5 | `screen-payslip` | `/admin/payroll/payslip-preview/[userId]/[year]/[month]` | Admins (preview); Employee (own) |
| S6 | `screen-reports` | `/admin/payroll/reports` | Super Admin, HR Manager, Reports Admin |
| S7 | `screen-emp-portal` | `/me/payroll` | Employee |
| S8 | `screen-bank` | `/me/payroll/bank-change` + `/admin/payroll/bank-changes` | Employee (request) + Admin (review) |
| S9 | `screen-mobile` | *(Phase 2 — Flutter)* | Employee (mobile) |

## 2. Shared UI Elements

### 2.1 Navigation

New top-level nav entry **Payroll** (gated by any payroll permission):

```
Dashboard | Leaves | Payroll | Reports | Settings | Profile
```

Within Payroll, secondary nav:

| Item | Permission required |
| --- | --- |
| Dashboard | `payroll.run.view` |
| Runs | `payroll.run.view` |
| Employees | `payroll.salary.view` |
| Bank Changes | `payroll.bank_change.view_any` |
| Reports | `payroll.report.*` |
| Master Data | `payroll.master.*` |

### 2.2 Status Chips

Consistent visual language for payroll run states:

| State | Color | Label |
| --- | --- | --- |
| `DRAFT` | gray | Draft |
| `IN_PROGRESS` | blue | In Progress |
| `REVIEW` | yellow | Under Review |
| `LOCKED` | orange | Locked |
| `RELEASED` | green | Released |
| `BANK_FILE_APPROVED` | teal | Bank File Approved |
| `BANK_FILE_GENERATED` | purple | Bank File Ready |
| `CANCELLED` | red | Cancelled |

### 2.3 Currency Formatting

- Display: `₹ 41,200.00` (Indian grouping: lakh/crore — 12,34,567.89)
- Inputs: accept either `41200` or `41200.00`; always store as NUMERIC(10,2)
- Payslip PDFs **do not** use thousand separators (match the sample: `19100.00`)

---

## 3. Screen S1 — Corrections Banner

Not a dedicated page — a dismissable banner component shown at the top of the Payroll Dashboard on first visit post-upgrade to v2.2. Documents the 5 key formula corrections for admins who were familiar with v1.0.

### 3.1 Content

Header: ⚠ **Key formulas updated — please review (v2.2)**

Body (5 concise points from BRD §1):
1. PF = conditional (`basic >= 15000 ? 1800 : round(basic * 0.12)`) — not MIN() × 12%.
2. CTC = Gross + Employer PF + Incentives. Employer PF is in CTC only, never a deduction.
3. OT rate = Gross ÷ 30 ÷ 9 × 1.5 (9-hour day — confirmed).
4. Salary for Calc = Gross − LWP Deduction. The 7 components apply to SFC, not raw Gross.
5. ESIC rates confirmed (3.25% + 0.75%) — module scaffolded, inactive.

### 3.2 Behaviour

- Shown on `/admin/payroll` dashboard first visit per admin (stored in user prefs).
- Dismiss button + link to full changelog.
- Non-blocking.

---

## 4. Screen S2 — Calculation Engine Formulas

Admin-facing reference showing the live formulas currently in effect. Read-only view of master data rendered as a formula showcase — helpful for new admins and as a training aid.

### 4.1 Sections

| Section | Content |
| --- | --- |
| **Salary for Calculation** | `Sal for Calc = Gross − (Gross ÷ 30) × LWP days` — with live example using a sample gross |
| **7 Components** | Table of current percentages from `payroll_salary_components`. Highlights PF base row. Totals indicator "Sum: 100% ✓" |
| **PF Calculation** | Conditional formula block, with verification table (PQR/HSBC/Reliance/RT-DEV-153) |
| **OT Calculation** | Formula + sample: `38200 ÷ 30 ÷ 9 × 1.5 = ₹212.22/hr` |
| **CTC Formula** | `CTC = Gross + Employer PF + Incentives` with PQR example |
| **ESIC** | Current status pill: **INACTIVE** (Super Admin sees "Activate" button → opens confirmation modal) |
| **Professional Tax** | Flat ₹200 |

### 4.2 Controls

- Super Admin: "Edit Master Data" button (links to Master Data admin)
- Everyone else: read-only view
- Export this screen as PDF (for onboarding docs)

### 4.3 Data Source

`GET /api/v1/payroll/master/components` + `GET /api/v1/payroll/master/statutory`

---

## 5. Screen S3 — Employee Salary Configuration

Admin edits an individual employee's salary structure.

### 5.1 Layout

Two-column:

**Left column (structural):**

| Field | Control | Notes |
| --- | --- | --- |
| Employee | read-only (name, emp_no, designation) | |
| Gross | number input (₹) | Triggers recomputation preview |
| PF Applicable | toggle | Default on |
| Incentive / Fix Variable | number input | |
| TDS (monthly) | number input | |
| Loan EMI | number input | |
| Salary Deduction | number input | |
| Security Return | number input | |

**Right column (auto-calculated preview):**

| Field | Value | Source |
| --- | --- | --- |
| Sal for Calc (0 LWP) | Gross | live |
| Basic (50%) | computed | live |
| HRA (20%) | computed | live |
| ... (rest of 7) | computed | live |
| Employee PF | conditional | live |
| Employer PF | conditional | live |
| Professional Tax | ₹200 | live |
| **CTC** | Gross + Employer PF + Incentive | bold |
| **CTC As Per IT** | Gross + Incentive | |
| **Expected Net (no LWP, no OT)** | computed | bold, blue pill |

### 5.2 Bank Details Section

Below primary config, a read-only block:

- Bank Name
- A/C No (masked: `XXXX-XXXX-8299`, unmask toggle)
- IFSC

Text note: *"To change bank details, ask the employee to submit a bank change request."*

### 5.3 Actions

- **Save** — only enabled when changes exist. Disabled if a payroll run is `IN_PROGRESS` or `REVIEW` for current month.
- **Cancel** — revert to original
- **View History** — opens side drawer with audit log of past edits

### 5.4 Validation

Live client-side:
- All numerics ≥ 0
- Gross required (> 0) to save
- DOB required warning (cannot email payslip without DOB)

Server returns `PR_LOCKED` if current-month run is mid-flight.

---

## 6. Screen S4 — Run Payroll (5-Step Wizard)

The most complex screen. A persistent 5-step progress bar at top, with screen body changing per step.

### 6.1 Progress Bar

```
[1. Select] ───▶ [2. Import] ───▶ [3. Calculate] ───▶ [4. Review] ───▶ [5. Lock & Release]
```

Each step shows: step number, label, status (pending/current/done), timestamp if done.

### 6.2 Step 1 — Select Month

- Month/year picker
- Shows count of active employees that would be included
- "Start Payroll Run" button → `POST /api/v1/payroll/runs`

### 6.3 Step 2 — Import Leave & OT

- Summary panel: "Importing LWP and OT data from Leave Management..."
- Progress bar while import runs
- On complete: summary table
  | Metric | Value |
  | --- | --- |
  | Employees processed | 42 |
  | Total LWP days | 5 |
  | Total OT hours | 18 |
  | Warnings | 0 |
- "Continue to Calculation" → `POST /runs/:id/calculate`

### 6.4 Step 3 — Auto-Calculate

- Progress bar ("Calculating 42 salaries...")
- On complete: totals preview:
  - Total Gross, Total Sal for Calc, Total Net Payable, Total Employer PF, Total Employee PF, Total PT, Total TDS
- "Go to Review" button

### 6.5 Step 4 — Review Salary Register

The heaviest screen. A filterable, sortable table of all employees with all earnings and deductions.

**Header row (grouped columns — v2.3, Review F1):**

> **v2.3:** The ~26 columns are grouped under collapsible column group headers to improve usability. Default view shows the summary group; admin expands groups on demand.

| Group | Columns | Default |
| --- | --- | --- |
| **Identity** | EMP No, Name, Dept | Always visible |
| **Salary** | Gross, SFC | Always visible |
| **Earnings (7 components)** | BASIC, HRA, SP, Conv, LTC, Med, Edu | Collapsed — expand to view |
| **Additions** | Fix Variable, OT Pay, Security Return | Collapsed |
| **Deductions** | PF, ESIC, PT, TDS, Loan, Sal Deduction | Collapsed |
| **Totals** | Total Earnings (A), Total Deductions (B), Net Payable, CTC, CTC/IT | Always visible |
| **Actions** | Preview Payslip, View Breakdown, Warnings | Always visible |

Admin can pin/unpin any group. Preference persists in browser localStorage.

*(Horizontal scroll when groups are expanded. Detail drawer per employee also available by clicking the row.)*

**Inline editable fields** (per D in `WORKFLOW §5.1`): Incentive, TDS, Loan EMI, Sal Deduction, Security Return. Click cell → inline input → save triggers engine re-run for that employee only.

**Non-editable fields** (read-only, gray): Gross, all component amounts, PF, ESIC, PT.

**Warnings column:** Icon if employee has issues (e.g., missing DOB, negative net, pending bank change).

**Totals row** (sticky at bottom): sums of every column.

**Filters:** search by emp_no/name, filter by department, filter by "only employees with LWP", "only employees with OT".

**Actions:**
- **Preview Payslip** per employee (opens modal with watermarked PDF)
- **View Calculation Breakdown** per employee (step-by-step engine trace — debugging aid)
- **Recalculate All** (runs Step 3 again — warns about discarding edits)
- **Export Preview (CSV)** — for offline review
- **Proceed to Lock** — moves to Step 5

### 6.6 Step 5 — Lock & Release

Two sub-steps.

**Sub-step 5a: Lock**
- Confirmation modal: *"Locking is irreversible. No edits allowed after this. Type LOCK {{MONTH}} {{YEAR}} to confirm."*
- On confirm → run validation → if passes, state → `LOCKED`; if fails, show error list.

**Sub-step 5b: Release**
- Date picker for release date (default: today)
- Preview: "This will generate 42 payslips and email them to all employees."
- "Release Payroll" button → backgrounds the payslip job
- Progress panel polls `GET /runs/:id/release-progress`:
  ```
  ✓ 40 payslips generated and emailed
  ⟳ 1 in progress
  ✗ 1 failed — action required
  ```
- After complete: **Bank Transfer File** button appears (Super Admin only).

### 6.7 Cancel Payroll

Available in steps 1–4. Red secondary button bottom-right. Confirmation modal required. Post-cancel, state → `CANCELLED`, run disappears from active list.

---

## 7. Screen S5 — Payslip Preview

Modal or page showing the payslip rendered from data (matched to `Sample_Pay_Slip.pdf` format).

### 7.1 Two Variants

**Admin preview (pre-release):**
- Watermarked "PREVIEW — NOT RELEASED"
- Not password-protected
- Reachable from Review screen (Step 4) and from employee profile

**Employee view (post-release):**
- Full layout matching the PDF spec in `PAYROLL_PAYSLIP_FORMAT.md`
- "Download PDF" button → signed URL to S3
- Password hint shown: *"PDF password: your date of birth in DDMM format."*

### 7.2 Layout

Renders HTML version of the payslip — Zone 1 (header), Zone 2 (meta), Zone 3 (three-column body), Zone 4 (net payable). Exactly mirrors the PDF to avoid surprises.

### 7.3 Print

Browser print style sheet renders without the watermark for employees, with watermark for admin previews.

---

## 8. Screen S6 — Reports

Tabbed interface for the 4 report types.

### 8.1 Tabs

| Tab | Content |
| --- | --- |
| Salary Register | Month picker → full register matching the sample Excel structure. All columns from `Sample_Salary_Sheet.xls` (matched exactly per BRD §5). CSV + PDF export. |
| Department Cost | Department + month pickers → summary card: Total Gross, Total CTC, Total Deductions, Net Payable. Chart (bar) breaking down by dept when "All Departments" selected. |
| Payroll Summary | Period selector (Monthly/Quarterly/Yearly) + FY selector. Company-wide totals + headcount + average salary. Line chart showing net payable trend. |
| Compliance | Month picker → statutory summary: Total Employer PF, Employee PF, Employer ESIC (₹0), Employee ESIC (₹0), PT. "Download PF Challan Summary" button (simple CSV for accountant). |

### 8.2 Export Controls

Top-right of each tab:
- **CSV** button → file download
- **PDF** button → file download
- **Email to me** → sends CSV attachment to logged-in user's email

### 8.3 Permissions

All 4 tabs require `payroll.report.<type>` permission. Reports Admin sees them all (read-only).

---

## 9. Screen S7 — Employee Portal (`/me/payroll`)

Employee self-service hub.

### 9.1 Landing Dashboard

Three cards:

1. **Current Month Preview** — What net payable would be if run today (no LWP applied). Helpful for planning. *(Data source: `GET /api/v1/payroll/me/salary-preview` — see `PAYROLL_API_CONTRACTS.md` §10.1b, added v2.3)*
2. **Last Payslip** — Month, net payable, download link.
3. **YTD Summary (FY {{currentFY}})** — Total earnings, total tax paid, total PF contributed.

### 9.2 Sub-navigation

- **My Payslips** — list of all past payslips, download link per month, filter by FY
- **Salary Breakdown** — current salary structure (masked sensitive fields as needed)
- **Investment Proofs** — upload + list for current FY
- **Bank Details** — view current + link to "Request Change" (S8)
- **OT Tracker** — approved OT hours this month + history

### 9.3 Payslip List

Table:

| Month | Net Payable | Status | Actions |
| --- | --- | --- | --- |
| March 2026 | ₹41,200 | Released | [Download PDF] |
| February 2026 | ₹41,200 | Released | [Download PDF] |
| ... | | | |

Each download click generates a fresh 24h signed S3 URL.

### 9.4 Salary Breakdown

Employee can view (read-only):
- Gross
- 7 components (current %)
- Incentive
- Deductions (PF, PT, their TDS, loan if any)
- CTC
- CTC As Per IT

No edit controls — employee cannot change their own salary.

---

## 10. Screen S8 — Bank Details (Employee Request + Admin Approval)

Two views of the same workflow.

### 10.1 Employee Side (`/me/payroll/bank-change`)

Section A: Current bank details (read-only)
- Bank name, A/C (masked with unmask toggle), IFSC

Section B: Change form (hidden by default, shown on "Request Change")
- New bank name, new A/C, new IFSC (validated with regex on blur)
- Re-enter A/C for confirmation (typo prevention)
- Upload cancelled cheque (optional, PDF/JPG/PNG, ≤ 5MB)
- Submit button → `POST /api/v1/payroll/bank-change`

Section C: Request history
- List of past requests with status chips (Pending / Approved / Rejected)
- Click → detail view with rejection reason if applicable

### 10.2 Admin Side (`/admin/payroll/bank-changes`)

List filter default: Pending (newest first)

Columns: Employee, Submitted, Current Bank, New Bank, Proof, Status, Actions

Actions per row:
- **Review & Approve** — opens modal:
  - Side-by-side compare current vs new
  - View proof doc
  - "Approve" button
- **Reject** — opens modal with required reason text area

### 10.3 Post-Approval Timing

Approved bank change applies **from the next payroll run** (marked via `bank_change_requests.effective_from_run_id` once used).

---

## 11. Screen S9 — Mobile (Flutter, Phase 2)

Wireframe present in the HTML shows mobile mockup for employees. **Not in MVP.** Listed here for design continuity so that Phase 2 can reuse the data APIs without frontend rework.

### 11.1 Phase 2 Screens (preview)

- Home: next payslip preview + quick stats
- Payslips: list + download
- Salary: breakdown
- OT Tracker: view approved OT
- Bank: change request (same workflow as web)
- Notifications: payslip ready, bank change status

APIs needed are already in `PAYROLL_API_CONTRACTS.md` under Group I (`/me/**`). No backend changes required for Phase 2 — only Flutter UI.

---

## 12. Accessibility & Responsive Design

- All screens meet WCAG 2.1 AA: color contrast, keyboard nav, screen reader labels.
- Responsive: admin screens target desktop primary; employee portal must work on mobile web (pre-Phase 2).
- No fixed font sizes below 14px.
- Data tables have a "Compact" / "Comfortable" toggle for admin preferences.

## 12b. Theme & Dark Mode (v2.3)

> **v2.3 (Review item F2).** Payroll screens inherit the existing theme system from the leave module. If the leave module supports dark mode, payroll screens MUST also render correctly in dark mode. Status chips (§2.2) use semantic color tokens (not hardcoded hex) so they adapt to both themes. All new payroll components should use the shared design system's color tokens.

## 13. Loading & Error States

Every screen has defined states:

| State | Design |
| --- | --- |
| Initial load | Skeleton screens (no spinners for primary content) |
| In-flight mutation | Inline button spinner, form disabled |
| Empty | Illustration + explanatory text + primary CTA |
| Error | Banner at top with error message + retry, details expandable |
| Permission denied | Friendly "You don't have access to this page. Contact your admin." |

## 14. Component Library

Reuses existing design system from leave module:
- Buttons (primary/secondary/destructive/ghost)
- Form fields, validation messages
- Modals, drawers
- Data tables (with sticky header, resizable columns)
- Toasts
- Progress steppers (new addition for 5-step payroll wizard — could be added to shared lib)

## 15. Performance Notes

- Review screen (Step 4) for 500+ employees: use virtualized rendering (`react-window`).
- Export to CSV: generate server-side, stream to client — do not materialize large arrays in browser.
- PDF preview in modal: lazy-load the PDF viewer (react-pdf or iframe to `/payslips/.../preview` streaming endpoint).
- Master data screens: single-page SPAs, no pagination needed.

---

*End of PAYROLL_FRONTEND_DESIGN.md. Next: PAYROLL_OPEN_QUESTIONS.md — the remaining unknowns.*
