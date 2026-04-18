# PAYROLL_TESTING.md

**Scope:** Test strategy, test case organization, and TestMo integration for the payroll module. This file is the contract between the implementation agents and the **QA/test-authoring agent** — it lets test cases be written in parallel with code, and it defines how automated tests report back to TestMo.
**Version:** v2.3

Cross-refs:
- What to test (specs) → every other `PAYROLL_*.md`
- Calculation verification data → `PAYROLL_CALCULATION_ENGINE.md` §6
- API contracts → `PAYROLL_API_CONTRACTS.md`
- UI screens → `PAYROLL_FRONTEND_DESIGN.md`

---

## 1. Why This File Exists

Rockers HR already has **TestMo plugins installed**. That means:

- Manual test cases live in TestMo (organized into Projects → Suites → Sections → Cases).
- Automated tests submit results to TestMo runs via the `testmo` CLI (JUnit XML format).
- QA + dev can work **in parallel**: the test agent reads this file and authors cases in TestMo; implementation agents build code against the same specs; automation runs close the loop.

This file exists so the QA agent doesn't have to re-read the entire planning folder to figure out which tests to write. Every test case needed for MVP can be derived from the tables in this document.

## 2. TestMo Project Structure

One project for the entire payroll module.

```
TestMo Project: "Rockers HR — Payroll"
│
├── Suite: S01 Calculation Engine            ← mirrors PAYROLL_CALCULATION_ENGINE.md
│   ├── Section: Sal for Calc (SFC)
│   ├── Section: Seven Components
│   ├── Section: PF Conditional Logic
│   ├── Section: ESIC Scaffold (Inactive)
│   ├── Section: Professional Tax
│   ├── Section: Overtime
│   ├── Section: CTC + CTC As Per IT
│   ├── Section: Totals & Net Payable
│   ├── Section: Present Days (D10)
│   └── Section: Golden Fixtures (5 sample employees)
│
├── Suite: S02 Workflow State Machine        ← mirrors PAYROLL_WORKFLOW.md
│   ├── Section: Step 1 — Select Month
│   ├── Section: Step 2 — Import Leave & OT
│   ├── Section: Step 3 — Calculate
│   ├── Section: Step 4 — Review & Edit
│   ├── Section: Step 5 — Lock & Release
│   ├── Section: Step 6 — Bank Transfer File
│   ├── Section: Cancellation
│   └── Section: Concurrency & Recovery
│
├── Suite: S03 Database & Schema             ← mirrors PAYROLL_DATABASE_SCHEMA.md
│   ├── Section: Constraints & Invariants
│   ├── Section: Snapshot Immutability
│   ├── Section: Indexes & Uniqueness
│   └── Section: YTD View
│
├── Suite: S04 Master Data                   ← mirrors PAYROLL_MASTER_DATA.md
│   ├── Section: 7 Components (sum=100 rule)
│   ├── Section: Statutory Config
│   ├── Section: ESIC Activation Toggle
│   ├── Section: Effective-Next-Run Rule
│   └── Section: Company Profile
│
├── Suite: S05 API Contracts                 ← mirrors PAYROLL_API_CONTRACTS.md
│   ├── Section: A Salary Config
│   ├── Section: B Master Data
│   ├── Section: C Runs
│   ├── Section: D Payslips
│   ├── Section: E Bank Change
│   ├── Section: F Investment Proofs
│   ├── Section: G Reports
│   ├── Section: H Bank Transfer File
│   ├── Section: I Employee Portal (/me)
│   ├── Section: Error Codes (PR_*)
│   └── Section: Idempotency
│
├── Suite: S06 RBAC                          ← mirrors PAYROLL_RBAC.md
│   ├── Section: Permission Enforcement per Role
│   ├── Section: Self-vs-Any Scope
│   ├── Section: Audit Event Emission
│   └── Section: Separation of Duties
│
├── Suite: S07 Notifications                 ← mirrors PAYROLL_NOTIFICATIONS.md
│   ├── Section: Email Templates (11 templates)
│   ├── Section: Delivery Retry Logic
│   ├── Section: In-app Notifications
│   └── Section: Do-Not-Notify Rules
│
├── Suite: S08 Payslip PDF                   ← mirrors PAYROLL_PAYSLIP_FORMAT.md
│   ├── Section: Layout (Zones 1-4)
│   ├── Section: DDMM Password
│   ├── Section: S3 Upload & Signed URLs
│   ├── Section: SMTP Delivery
│   ├── Section: Missing DOB Handling
│   └── Section: Admin Preview Watermark
│
├── Suite: S09 Frontend (Web)                ← mirrors PAYROLL_FRONTEND_DESIGN.md
│   ├── Section: S2 Formulas Screen
│   ├── Section: S3 Salary Config Screen
│   ├── Section: S4 Payroll Run Wizard
│   ├── Section: S5 Payslip Preview
│   ├── Section: S6 Reports
│   ├── Section: S7 Employee Portal
│   └── Section: S8 Bank Change Flow
│
└── Suite: S10 Cross-Cutting
    ├── Section: Leave Module Integration Contract
    ├── Section: Audit Log Completeness
    ├── Section: Performance (500+ employees)
    ├── Section: Security (IDOR, sensitive data)
    └── Section: Accessibility (WCAG 2.1 AA)
```

## 3. Test Case ID Convention

Each test case in TestMo gets a stable, human-readable ID that also shows up in the Jest/Playwright test name so automation results auto-map to cases.

**Format:** `PAY-{SUITE}-{SECTION}-{NNN}`

Examples:

| ID | Meaning |
| --- | --- |
| `PAY-CALC-SFC-001` | Calc engine → SFC section → case 1 |
| `PAY-CALC-PF-004` | Calc engine → PF Conditional → case 4 |
| `PAY-WORKFLOW-LOCK-002` | Workflow → Lock & Release → case 2 |
| `PAY-API-RUNS-015` | API → Runs → case 15 |
| `PAY-RBAC-SUPER-003` | RBAC → Super Admin scope → case 3 |
| `PAY-E2E-WIZARD-001` | Frontend → Payroll Wizard → case 1 (E2E) |

Suite codes (for compact prefix): `CALC`, `WORKFLOW`, `DB`, `MASTER`, `API`, `RBAC`, `NOTIF`, `PDF`, `E2E`, `CROSS`.

### 3.1 Where the ID Lives

- **In TestMo:** set as the test case's "External ID" or custom field.
- **In code:** prepended to the test name:
  ```typescript
  describe('Calculation Engine — Sal for Calc', () => {
    test('PAY-CALC-SFC-001: zero LWP returns Gross unchanged', () => { ... });
    test('PAY-CALC-SFC-002: 2 LWP days on 38200 Gross → SFC = 35653.33', () => { ... });
  });
  ```
- **Automation → TestMo mapping:** the `testmo automation:run:submit` command parses test names, extracts the ID prefix, and updates the corresponding case in the TestMo run.

## 4. Test Types & Frameworks

| Layer | Framework | Output format | Runs on |
| --- | --- | --- | --- |
| **Unit** (pure functions — calc engine) | Jest | JUnit XML | Every PR, <30s |
| **Integration** (DB + services, no HTTP) | Jest + Testcontainers PostgreSQL | JUnit XML | Every PR, <5min |
| **API / Contract** | Jest + Supertest (against spun-up NestJS app) | JUnit XML | Every PR, <10min |
| **Email / SMTP** | Jest + `mailhog` or `smtp-tester` | JUnit XML | Every PR, mocked |
| **PDF content regression** | Jest + `pdf-lib` text extraction + positional assertions (see §4.1) | JUnit XML | Every PR |
| **E2E Web** | Playwright | JUnit XML | Nightly + pre-release |
| **Manual / exploratory** | TestMo manual runs | Human | Per release |
| **Mobile (Phase 2)** | Flutter integration_test | JUnit XML | Phase 2 only |

### 4.1 PDF Testing Approach (v2.3)

> **v2.3 (Review item T2).** Clarifies the PDF regression strategy.

PDF testing uses **content extraction**, not visual pixel comparison:

1. **`pdf-lib`** parses the generated PDF and extracts all text content with coordinates.
2. Tests assert:
   - Zone 1: company name text present
   - Zone 2: correct employee name, emp_number, CTC, month values
   - Zone 3: all 7 component labels present, amounts match golden fixture (string comparison)
   - Zone 4: Net Payable value matches
   - Password protection: `pdf-lib` confirms the PDF requires a password to open
3. **Golden fixture comparison:** For RT_DEV_153, the extracted text-and-numbers are compared against a committed golden snapshot file (`/src/payroll/test-fixtures/golden-payslip-rt-dev-153.json`).
4. **No pixel/screenshot comparison** in MVP — too brittle across PDF renderers. Visual QA is manual.

All automated runs submit to TestMo via the CLI — see §9.

## 5. Test Case Template

Every TestMo case (manual or automated) uses the same skeleton. This template lets the test agent import cases in bulk without rework.

```
ID:            PAY-{SUITE}-{SECTION}-{NNN}
Title:         <concise imperative description>
Priority:      Critical | High | Medium | Low
Type:          Automated | Manual | Both
Linked spec:   <file>.md §<section>
Decisions:     D<n>, D<m>          ← which locked decisions this test covers
Preconditions: <setup state>
Steps:
  1. <action>
  2. <action>
Expected:
  - <observable result>
  - <observable result>
Automation:
  - Framework: Jest | Playwright | Supertest | etc.
  - Test name: <must include the ID prefix>
Fixtures:
  - <employee name or data scenario>
Notes:         <edge cases, known flakiness, screenshot refs>
```

## 6. Golden Fixtures — The 5 Verified Employees

The BRD v2.2 verified payroll math against 5 real employees. These are the **canonical test fixtures** — they appear in unit, integration, and E2E tests.

| Fixture name | Source | Key scenario |
| --- | --- | --- |
| `RT_DEV_153` | Sample_Pay_Slip.pdf | Gross ₹38,200, Basic ≥ 15K → PF ₹1,800, CTC ₹45,000. **Primary golden case.** |
| `PQR` | Sample_Salary_Sheet.xls | Gross ₹67,815, high Basic ₹33,908 → PF ₹1,800 (capped). CTC ₹84,615. |
| `HSBC` | Sample_Salary_Sheet.xls | Gross ₹25,000, Basic ₹12,500 < 15K → PF 12% = ₹1,500. |
| `RELIANCE` | Sample_Salary_Sheet.xls | Gross ₹24,000, Basic ₹12,000 → PF ₹1,440. |
| `ABC` | Sample_Salary_Sheet.xls | Gross ₹50,000, **PF-exempt** (`pf_applicable = false`). Employer PF = 0, CTC = Gross + 0 + Incentives. |

### 6.1 Seed Data File

Fixtures are stored as a versioned TypeScript file committed with the repo:

```
/src/payroll/test-fixtures/golden-employees.ts
```

Shape:
```typescript
export const GOLDEN_EMPLOYEES = [
  {
    name: 'RT_DEV_153',
    emp_number: 'RT-DEV-153',
    gross: 38200,
    incentive: 5000,
    pf_applicable: true,
    expected: {
      sal_for_calc: 38200,
      basic_actual: 19100,
      hra_actual: 7640,
      // ... all 7 components
      employee_pf: 1800,
      employer_pf: 1800,
      pt: 200,
      total_earnings: 43200,
      total_deductions: 2000,
      net_payable: 41200,
      ctc: 45000,
    },
  },
  // ... 4 more
];
```

Every engine test iterates this array — one fixture failing is one test failure. No fixture leaves the array without a BRD version bump + D-decision update.

## 7. Test Case Seed — Priority Cases by Suite

This is the minimum set a QA agent should author **first** (before any "nice-to-have" edge cases). Each row becomes one TestMo case.

### 7.1 Suite S01 — Calculation Engine (22 priority cases)

| ID | Title | Priority | Decisions |
| --- | --- | --- | --- |
| `PAY-CALC-SFC-001` | Zero LWP → SFC equals Gross | Critical | D3 |
| `PAY-CALC-SFC-002` | LWP > 0 → SFC = Gross − (Gross/30 × LWP days) | Critical | D3 |
| `PAY-CALC-SFC-003` | LWP = 30 → SFC = 0 (no negative) | High | D3 |
| `PAY-CALC-SFC-004` | LWP > 30 capped to 30 at import | High | D3 |
| `PAY-CALC-COMP-001` | 7 components sum to Gross when LWP=0 | Critical | D2 |
| `PAY-CALC-COMP-002` | 7 components sum to SFC when LWP>0 | Critical | D2, D3 |
| `PAY-CALC-COMP-003` | Actual/Payable columns differ only when LWP>0 | Critical | D17 |
| `PAY-CALC-COMP-004` | Fixture RT_DEV_153 produces exact payslip values | Critical | — |
| `PAY-CALC-PF-001` | Basic ≥ 15000 → PF = 1800 fixed (not 12% × 15000) | Critical | D4 |
| `PAY-CALC-PF-002` | Basic < 15000 → PF = round(basic × 0.12) | Critical | D4 |
| `PAY-CALC-PF-003` | Fixture HSBC → Employee PF = 1500 | Critical | D4 |
| `PAY-CALC-PF-004` | Fixture Reliance → Employee PF = 1440 | Critical | D4 |
| `PAY-CALC-PF-005` | `pf_applicable=false` → PF = 0 (both employee and employer) | Critical | D16 |
| `PAY-CALC-PF-006` | Employer PF equals Employee PF when both apply | High | D4, D5 |
| `PAY-CALC-ESIC-001` | `esic_active=false` → ESIC = 0 in deductions (value still stored) | Critical | D9 |
| `PAY-CALC-ESIC-002` | `esic_active=true` + Gross ≥ 21000 → ESIC = 0 (above threshold) | High | D9 |
| `PAY-CALC-ESIC-003` | `esic_active=true` + Gross < 21000 → ESIC applies | High | D9 |
| `PAY-CALC-PT-001` | Professional Tax = 200 (from master) | Critical | D8 |
| `PAY-CALC-OT-001` | OT rate = Gross/30/9 × 1.5 | Critical | D7 |
| `PAY-CALC-OT-002` | Fixture RT_DEV_153 OT with 5 hours = 1061.11 | Critical | D7 |
| `PAY-CALC-CTC-001` | CTC = Gross + Employer PF + Incentive | Critical | D5 |
| `PAY-CALC-CTC-002` | CTC As Per IT = Gross + Incentive (no Employer PF) | Critical | D6 |
| `PAY-CALC-NET-001` | Net payable clamps to 0 (never negative) | Critical | — |
| `PAY-CALC-PRES-001` | Present Days = 30 − LWP only (CL/SL/PL don't reduce) | Critical | D10 |
| `PAY-CALC-ROUND-001` | 7 payable components sum exactly to salForCalc (remainder absorbed by EDUCATION) *(v2.3)* | Critical | — |
| `PAY-CALC-ROUND-002` | 7 actual components sum exactly to gross (remainder absorbed by EDUCATION) *(v2.3)* | Critical | — |

### 7.2 Suite S02 — Workflow (15 priority cases)

| ID | Title | Priority | Decisions |
| --- | --- | --- | --- |
| `PAY-WORKFLOW-CREATE-001` | Create run → state = DRAFT | Critical | — |
| `PAY-WORKFLOW-CREATE-002` | Duplicate run for same (month,year) rejected | Critical | — |
| `PAY-WORKFLOW-IMPORT-001` | Import fetches only approved LWP from leave module | Critical | — |
| `PAY-WORKFLOW-IMPORT-002` | Import fetches approved OT hours, excludes pending | Critical | — |
| `PAY-WORKFLOW-IMPORT-003` | Snapshot freezes employee config — later edits don't affect in-flight run | Critical | D20 |
| `PAY-WORKFLOW-CALC-001` | Calculate transitions IN_PROGRESS → REVIEW | Critical | — |
| `PAY-WORKFLOW-EDIT-001` | Edit incentive in Review → new payroll_items row, old marked superseded | High | — |
| `PAY-WORKFLOW-EDIT-002` | Attempting to edit Gross in Review → rejected | High | — |
| `PAY-WORKFLOW-LOCK-001` | Lock with validation pass → state = LOCKED | Critical | D19 |
| `PAY-WORKFLOW-LOCK-002` | Lock is irreversible — no edits, no cancel afterward | Critical | D19 |
| `PAY-WORKFLOW-RELEASE-001` | Release triggers payslip PDF generation + email per employee | Critical | — |
| `PAY-WORKFLOW-RELEASE-002` | Release date is admin-chosen, not fixed | High | D13 |
| `PAY-WORKFLOW-BANK-001` | Bank file generation requires explicit approve step | Critical | D14 |
| `PAY-WORKFLOW-BANK-002` | Bank file approve → Super Admin only; HR Manager blocked | Critical | D14 |
| `PAY-WORKFLOW-CANCEL-001` | Cancel allowed only in DRAFT/IN_PROGRESS/REVIEW | High | — |
| `PAY-WORKFLOW-CONCURRENT-001` | Two admins edit same employee in Review — last-write-wins, no crash *(v2.3, Review T3)* | Medium | — |

### 7.3 Suite S03 — Database (8 priority cases)

| ID | Title | Priority |
| --- | --- | --- |
| `PAY-DB-INV-001` | Only one non-cancelled payroll_run per (month,year) | Critical |
| `PAY-DB-INV-002` | Only one `is_current=TRUE` payroll_items row per (run,user) | Critical |
| `PAY-DB-INV-003` | Only one PENDING bank_change_request per user | High |
| `PAY-DB-INV-004` | `net_payable >= 0` CHECK enforced | Critical |
| `PAY-DB-SNAP-001` | Master edit during run does not modify `snapshot_components` | Critical |
| `PAY-DB-SNAP-002` | Employee salary edit during run does not modify `snapshot_gross` | Critical |
| `PAY-DB-YTD-001` | View `v_employee_ytd` buckets by April–March FY | High |
| `PAY-DB-YTD-002` | YTD aggregates only RELEASED+ runs (excludes DRAFT, REVIEW) | High |

### 7.4 Suite S04 — Master Data (10 priority cases)

| ID | Title | Priority | Decisions |
| --- | --- | --- | --- |
| `PAY-MASTER-COMP-001` | Saving 7 components that sum to 100 → success | Critical | D2 |
| `PAY-MASTER-COMP-002` | Saving components summing to 99.99 → rejected | Critical | D2 |
| `PAY-MASTER-COMP-003` | Exactly one `is_pf_base=true` required | Critical | — |
| `PAY-MASTER-COMP-004` | Component edit effective next run only | Critical | D20 |
| `PAY-MASTER-STAT-001` | PT amount changeable; applied from next run | High | D8 |
| `PAY-MASTER-STAT-002` | PF cap editable; engine uses new value on next run | High | — |
| `PAY-MASTER-ESIC-001` | ESIC activation requires confirmation phrase | Critical | — |
| `PAY-MASTER-ESIC-002` | ESIC toggle writes audit event with actor + old/new | High | — |
| `PAY-MASTER-COMPANY-001` | Company name/address propagates to next payslip header | Medium | — |
| `PAY-MASTER-BANK-001` | Bank file format column_order affects generated file | High | — |

### 7.5 Suite S05 — API (18 priority cases)

| ID | Title | Priority |
| --- | --- | --- |
| `PAY-API-SALARY-001` | GET returns full salary + computed_preview | High |
| `PAY-API-SALARY-002` | PATCH rejected during IN_PROGRESS run (409 PR_LOCKED) | Critical |
| `PAY-API-RUNS-001` | POST /runs creates with state DRAFT | Critical |
| `PAY-API-RUNS-002` | POST /runs duplicate returns 409 PR_RUN_ALREADY_EXISTS | Critical |
| `PAY-API-RUNS-003` | POST /import transitions to IN_PROGRESS | Critical |
| `PAY-API-RUNS-004` | POST /calculate transitions to REVIEW | Critical |
| `PAY-API-RUNS-005` | PATCH item during REVIEW writes new `payroll_items` | Critical |
| `PAY-API-RUNS-006` | PATCH item during LOCKED returns 409 PR_LOCKED | Critical |
| `PAY-API-RUNS-007` | POST /lock with wrong confirmation phrase → 400 | High |
| `PAY-API-RUNS-008` | POST /lock with validation errors → 400 + error list | High |
| `PAY-API-RUNS-009` | POST /release with future release_date → success | Medium |
| `PAY-API-RUNS-010` | Idempotency-Key replays same response for 24h | High |
| `PAY-API-PAYSLIP-001` | GET returns signed URL with 24h TTL | High |
| `PAY-API-BANK-001` | POST bank-change creates PENDING | High |
| `PAY-API-BANK-002` | Two pending requests per user → 409 | High |
| `PAY-API-BANK-003` | Invalid IFSC regex → 400 field error | High |
| `PAY-API-REPORT-001` | Salary Register CSV matches sample sheet columns | Critical |
| `PAY-API-ME-001` | /me/* returns only requester's data (IDOR check) | Critical |

### 7.6 Suite S06 — RBAC (12 priority cases)

| ID | Title | Priority |
| --- | --- | --- |
| `PAY-RBAC-SUPER-001` | Super Admin can edit master components | Critical |
| `PAY-RBAC-HR-001` | HR Manager cannot edit master components → 403 | Critical |
| `PAY-RBAC-HR-002` | HR Manager can run full 5-step payroll | Critical |
| `PAY-RBAC-HR-003` | HR Manager cannot approve bank transfer file → 403 | Critical |
| `PAY-RBAC-REPORTS-001` | Reports Admin can read salary register | High |
| `PAY-RBAC-REPORTS-002` | Reports Admin cannot create payroll run → 403 | Critical |
| `PAY-RBAC-EMPLOYEE-001` | Employee sees only own payslips | Critical |
| `PAY-RBAC-EMPLOYEE-002` | Employee accessing /payslips/:otherUserId → 403 | Critical |
| `PAY-RBAC-EMPLOYEE-003` | Employee can submit bank change, cannot approve | Critical |
| `PAY-RBAC-AUDIT-001` | payroll.bank_file.approved event written on approval | High |
| `PAY-RBAC-AUDIT-002` | payroll.run.item_edited written per edit with old/new | High |
| `PAY-RBAC-AUDIT-003` | Denied requests also logged for security monitoring | Medium |

### 7.7 Suite S07 — Notifications (10 priority cases)

| ID | Title | Priority |
| --- | --- | --- |
| `PAY-NOTIF-N1-001` | Payslip email sent with correct PDF attachment | Critical |
| `PAY-NOTIF-N1-002` | Email body contains DDMM password hint (not the password itself) | Critical |
| `PAY-NOTIF-N1-003` | Bounced email auto-retries 3 times with exponential backoff | High |
| `PAY-NOTIF-N1-004` | After 3 retries → `FAILED`, triggers N2 admin alert | High |
| `PAY-NOTIF-N4-001` | Bank change submission emails all Super Admins + HR Managers | Medium |
| `PAY-NOTIF-N5-001` | Bank change approval emails employee with masked account | High |
| `PAY-NOTIF-N5-002` | No unmasked account number in any email body | Critical |
| `PAY-NOTIF-N9-001` | Bank file approval email sent only to approver | Medium |
| `PAY-NOTIF-TMPL-001` | Template changes in DB take effect without redeploy | Medium |
| `PAY-NOTIF-ANTI-001` | No email sent for Review-stage item edits (anti-pattern) | High |

### 7.8 Suite S08 — Payslip PDF (12 priority cases)

| ID | Title | Priority | Decisions |
| --- | --- | --- | --- |
| `PAY-PDF-LAYOUT-001` | Generated PDF has 4 zones as specified | Critical | — |
| `PAY-PDF-LAYOUT-002` | 7 component rows render with Actual+Payable columns | Critical | D17 |
| `PAY-PDF-LAYOUT-003` | 'Complimentary Off' label (not 'COM Leave') | Critical | D15 |
| `PAY-PDF-LAYOUT-004` | Present Days value = 30 − LWP | Critical | D10 |
| `PAY-PDF-GOLDEN-001` | RT_DEV_153 PDF numerically matches sample payslip | Critical | — |
| `PAY-PDF-PASS-001` | PDF password = DOB in DDMM for DOB 14-Mar → '1403' | Critical | D11 |
| `PAY-PDF-PASS-002` | PDF password for DOB 5-Jan → '0501' (leading zeros) | Critical | D11 |
| `PAY-PDF-PASS-003` | Missing DOB → payslip generation fails with clear error | High | — |
| `PAY-PDF-S3-001` | PDF uploaded to `s3://.../{year}/{month}/{emp}.pdf` | High | — |
| `PAY-PDF-S3-002` | Bucket has SSE-S3 encryption, versioning, public access blocked | Critical | — |
| `PAY-PDF-PREVIEW-001` | Admin preview is watermarked, not password-protected | High | — |
| `PAY-PDF-FONT-001` | ₹ glyph renders (not placeholder box) | High | — |

### 7.9 Suite S09 — Frontend E2E (10 priority cases)

| ID | Title | Priority |
| --- | --- | --- |
| `PAY-E2E-WIZARD-001` | Admin completes full 5-step payroll run end-to-end | Critical |
| `PAY-E2E-WIZARD-002` | Review screen inline-edits TDS → row recalculated live | Critical |
| `PAY-E2E-WIZARD-003` | Lock confirmation requires typed phrase | High |
| `PAY-E2E-CONFIG-001` | Admin updates employee Gross → preview updates live | High |
| `PAY-E2E-PORTAL-001` | Employee lists + downloads own payslips only | Critical |
| `PAY-E2E-BANK-001` | Employee submits bank change with proof → admin sees in queue | High |
| `PAY-E2E-BANK-002` | Admin approves bank change → employee sees status update | High |
| `PAY-E2E-REPORTS-001` | Salary Register tab exports CSV matching sample format | Critical |
| `PAY-E2E-A11Y-001` | Key screens pass axe accessibility audit | High |
| `PAY-E2E-PERF-001` | Review screen loads 500 employees < 3s (virtualized) | Medium |

### 7.10 Suite S10 — Cross-Cutting (6 priority cases)

| ID | Title | Priority |
| --- | --- | --- |
| `PAY-CROSS-LEAVE-001` | LWP import reads from correct leave_requests columns + statuses | Critical |
| `PAY-CROSS-LEAVE-002` | OT import reads only `status=approved` from overtime_requests | Critical |
| `PAY-CROSS-AUDIT-001` | All 16+ payroll event types appear in nestjs-audit-logger index | High |
| `PAY-CROSS-SEC-001` | Employee payslip URL not predictable / unauthenticated (S3 signed only) | Critical |
| `PAY-CROSS-SEC-002` | Investment proof upload rejects non-PDF/JPG/PNG | High |
| `PAY-CROSS-SEC-003` | Bank account not logged in any plaintext log file | Critical |

**Totals by suite** — suggested minimum coverage:
| Suite | Priority cases | Suite owner (suggested) |
| --- | --- | --- |
| S01 Calc | 24 | QA Agent A |
| S02 Workflow | 16 | QA Agent A |
| S03 DB | 8 | QA Agent B |
| S04 Master | 10 | QA Agent B |
| S05 API | 18 | QA Agent C |
| S06 RBAC | 12 | QA Agent C |
| S07 Notifications | 10 | QA Agent D |
| S08 PDF | 12 | QA Agent D |
| S09 E2E | 10 | QA Agent E |
| S10 Cross | 6 | any |
| **Total** | **126** | |

### 7.11 Priority Tiers (v2.3)

> **v2.3 (Review item T1).** 126 test cases is ambitious for MVP. To allow incremental testing, cases are split into two tiers:

| Tier | Scope | Gate | Cases |
| --- | --- | --- | --- |
| **Tier 1 — Must Ship** | S01 Calc (all 24) + S02 Workflow (all 16) + S05 API critical/high + S06 RBAC critical | All automated, all passing before any release | ~60 |
| **Tier 2 — Should Ship** | All remaining suites (S03, S04, S07, S08, S09, S10) + S05/S06 medium/low | Authored and automated; failures tracked but not hard-blocking | ~66 |

Tier 1 is the MVP gate. Tier 2 is strongly recommended before go-live but does not block internal demo or staging deployment.

## 8. Parallelization Strategy — Who Works on What

The suite boundaries are designed so **different agents can author test cases simultaneously without stepping on each other**. Suggested lanes:

| Lane | Suites | Prerequisite planning files | Can start when |
| --- | --- | --- | --- |
| **Lane 1 — Engine & Workflow** | S01, S02 | `CALCULATION_ENGINE.md`, `WORKFLOW.md` | Planning committed |
| **Lane 2 — Data & Master** | S03, S04 | `DATABASE_SCHEMA.md`, `MASTER_DATA.md` | Planning committed |
| **Lane 3 — API & Security** | S05, S06 | `API_CONTRACTS.md`, `RBAC.md` | Planning committed |
| **Lane 4 — Notifications & PDF** | S07, S08 | `NOTIFICATIONS.md`, `PAYSLIP_FORMAT.md` | Planning committed |
| **Lane 5 — E2E** | S09 | `FRONTEND_DESIGN.md` + UI code merged | After first frontend PR |
| **Lane 6 — Cross-cutting** | S10 | all | After lanes 1–4 complete |

Each lane owns its TestMo suite(s) end-to-end — authoring, reviewing, and later automation integration. No cross-lane dependencies until Lane 5 (E2E needs real UI).

## 9. `testmo` CLI Integration

### 9.1 Prerequisites

TestMo CLI must be installed on CI runners and locally for devs:

```bash
npm install -g @testmo/testmo-cli
```

Environment variables (in CI secrets / dev `.env.test`):

```
TESTMO_URL=https://<your-org>.testmo.net
TESTMO_TOKEN=<api-token>
TESTMO_PROJECT_ID=<numeric-project-id-for-Rockers-HR-Payroll>
```

### 9.2 Running Automated Tests & Submitting Results

The pattern for any test framework that produces JUnit XML:

```bash
# 1. Run tests and write JUnit XML
npx jest --reporters=default --reporters=jest-junit
# → produces ./junit.xml

# 2. Submit to TestMo
testmo automation:run:submit \
  --instance "$TESTMO_URL" \
  --project-id "$TESTMO_PROJECT_ID" \
  --name "Payroll CI Run — $(git rev-parse --short HEAD)" \
  --source "github-actions" \
  --results ./junit.xml
```

Repeat for Playwright (`playwright-junit` reporter), Supertest (within Jest), etc.

### 9.3 Test Case Mapping

TestMo matches JUnit test names to cases using the `PAY-{SUITE}-{SECTION}-{NNN}` prefix. As long as your Jest/Playwright test name starts with the ID, TestMo auto-links results. Unknown IDs create new automated cases — **treat that as an error** (prevents silent drift).

### 9.4 Config file (recommended)

Commit `.testmo-config.json` at repo root so CLI invocations stay short:

```json
{
  "project_id": 42,
  "source": "ci",
  "default_source": "github-actions"
}
```

## 10. CI/CD Flow (GitHub Actions sketch)

```yaml
# .github/workflows/payroll-tests.yml
name: Payroll Tests

on: [push, pull_request]

jobs:
  unit-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test -- --reporters=default --reporters=jest-junit
        env:
          JEST_JUNIT_OUTPUT_FILE: junit-unit.xml
      - name: Submit to TestMo
        if: always()
        run: |
          npm install -g @testmo/testmo-cli
          testmo automation:run:submit \
            --instance "${{ secrets.TESTMO_URL }}" \
            --project-id "${{ secrets.TESTMO_PROJECT_ID }}" \
            --name "Unit/Integration — ${{ github.sha }}" \
            --source github-actions \
            --results junit-unit.xml
        env:
          TESTMO_TOKEN: ${{ secrets.TESTMO_TOKEN }}

  e2e:
    runs-on: ubuntu-latest
    needs: unit-integration
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --reporter=junit
      - name: Submit E2E to TestMo
        if: always()
        run: |
          testmo automation:run:submit \
            --instance "${{ secrets.TESTMO_URL }}" \
            --project-id "${{ secrets.TESTMO_PROJECT_ID }}" \
            --name "E2E — ${{ github.sha }}" \
            --source github-actions \
            --results playwright-junit.xml
        env:
          TESTMO_TOKEN: ${{ secrets.TESTMO_TOKEN }}
```

## 11. Test Data Strategy

| Concern | Approach |
| --- | --- |
| Seed employees | Golden fixture file (§6) loaded once per test DB setup. No randomness. |
| Master data | Fresh seed on each integration test (matches migrations) |
| Leave/OT data | Factories creating approved LWP records for specific months |
| PII scrubbing | Staging DB never mirrors production — test fixtures only |
| Date handling | All tests use **frozen clock** (`sinon.useFakeTimers`) pinned to a known date. No real `new Date()` in tests. |
| Fiscal year edge | Fixture for April 1 (FY rollover) explicitly tested |
| Timezones | All timestamps in UTC; tests assert UTC invariants |

## 12. Flakiness & Retries

| Scenario | Policy |
| --- | --- |
| Unit tests | Zero tolerance — flaky unit test = fix immediately or delete |
| Integration tests | Auto-retry 1× on failure; >1 flake in a week → assign owner |
| E2E tests | Auto-retry 2× (Playwright default); flakes > 5% over 2 weeks → quarantine |
| Network-dependent (SMTP, S3) | Always mocked locally; real integration tested only in dedicated env |

Flaky tests should be tagged `@flaky` in code + marked in TestMo — the CI report calls them out separately so team sees the trend.

## 13. Coverage Matrix — Decisions → Tests

Quick lookup: every locked decision has at least one critical test case guarding it.

| Decision | Primary test ID(s) |
| --- | --- |
| D1 (30-day cycle) | PAY-CALC-OT-001, PAY-CALC-SFC-002 |
| D2 (7 components sum=100) | PAY-MASTER-COMP-001, PAY-MASTER-COMP-002, PAY-CALC-COMP-001 |
| D3 (SFC formula) | PAY-CALC-SFC-001, -002, -003 |
| D4 (PF conditional) | PAY-CALC-PF-001 through -004 |
| D5 (CTC formula) | PAY-CALC-CTC-001 |
| D6 (CTC As Per IT) | PAY-CALC-CTC-002 |
| D7 (OT Gross/30/9 × 1.5) | PAY-CALC-OT-001, -002 |
| D8 (PT = 200) | PAY-CALC-PT-001, PAY-MASTER-STAT-001 |
| D9 (ESIC scaffold) | PAY-CALC-ESIC-001, -002, -003 |
| D10 (Present Days) | PAY-CALC-PRES-001, PAY-PDF-LAYOUT-004 |
| D11 (DDMM password) | PAY-PDF-PASS-001, -002, -003 |
| D12 (FY Apr–Mar) | PAY-DB-YTD-001 |
| D13 (admin-set release) | PAY-WORKFLOW-RELEASE-002 |
| D14 (bank file approval) | PAY-WORKFLOW-BANK-001, -002 |
| D15 ('Complimentary Off') | PAY-PDF-LAYOUT-003 |
| D16 (PF exempt) | PAY-CALC-PF-005 |
| D17 (Actual/Payable cols) | PAY-CALC-COMP-003, PAY-PDF-LAYOUT-002 |
| D18 (nestjs-audit-logger) | PAY-RBAC-AUDIT-* |
| D19 (lock irreversible) | PAY-WORKFLOW-LOCK-001, -002 |
| D20 (next-run-only) | PAY-DB-SNAP-001, PAY-DB-SNAP-002, PAY-MASTER-COMP-004 |
| D21 (TestMo) | *(meta — validated by this file's existence)* |
| Rounding remainder (v2.3) | PAY-CALC-ROUND-001, PAY-CALC-ROUND-002 |
| Concurrent edit (v2.3) | PAY-WORKFLOW-CONCURRENT-001 |

## 14. Non-Goals (Explicitly NOT in MVP Test Scope)

- Load/stress testing beyond 500 employees (Phase 2)
- Chaos engineering (SMTP failures, S3 outages) — basic retry tests only
- Security pen-testing — separate engagement
- Cross-browser matrix beyond Chrome + Safari (Edge, Firefox in Phase 2)
- Flutter mobile tests (Phase 2 only; Suite stubs exist for future)

## 15. Done Definition for MVP Testing

MVP is **testing-ready-to-ship** when:

- [ ] All 126 priority cases exist in TestMo (Tier 1: ~60, Tier 2: ~66)
- [ ] All 24 calc engine cases are automated (Jest) and passing
- [ ] All 5 golden fixtures pass end-to-end through engine
- [ ] RT_DEV_153 PDF output matches sample payslip byte-for-key-value (not pixel-exact)
- [ ] RBAC tests cover every role × every protected endpoint
- [ ] CI submits run to TestMo on every merge to `main`
- [ ] Zero known flakes in unit/integration
- [ ] Manual regression pass signed off by HRBhrugisha V before go-live

---

*End of PAYROLL_TESTING.md. QA agent may now begin authoring cases in parallel with implementation.*
