# PAYROLL_PAYSLIP_FORMAT.md

**Scope:** The payslip PDF layout, password protection, and email delivery. Layout is matched **exactly** to `Sample_Pay_Slip.pdf` (RT-DEV-153, March 2026) supplied by HRBhrugisha V.
**Version:** v2.3

Cross-refs:
- Data source → `PAYROLL_DATABASE_SCHEMA.md` §4 (`payroll_items`) + §5 (`payslip_deliveries`)
- Release orchestration → `PAYROLL_WORKFLOW.md` §6
- Email content → `PAYROLL_NOTIFICATIONS.md` §2

---

## 1. Layout Overview

A single-page A4 PDF with four horizontal zones:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ZONE 1: COMPANY HEADER                                             │
│  ROCKERS TECHNOLOGIES                                               │
│  3rd Floor, Corner Heights, Kalali Road, Vadodara                   │
├─────────────────────────────────────────────────────────────────────┤
│  ZONE 2: EMPLOYEE META (two columns)                                │
│  EMP NUMBER   BANK NAME                                             │
│  EMP NAME     A/C NO                                                │
│  DESIGNATION  DOJ                                                   │
│  CTC          MONTH                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ZONE 3: THREE-COLUMN BODY                                          │
│  ┌──────────────┬──────────────────────────┬───────────────────┐    │
│  │ WORKING      │ EARNING DETAILS (A)      │ DEDUCTION         │    │
│  │ DETAILS      │ Row | Actual | Payable   │ DETAILS (B)       │    │
│  │              │                          │ Row | Amount      │    │
│  │ WD 30        │ BASIC   19100   19100    │ PF      1800.00   │    │
│  │ CL  —        │ HRA      7640    7640    │ ESIC       0.00   │    │
│  │ SL  —        │ SP.ALLOW 5730    5730    │ P.TAX    200.00   │    │
│  │ LWP —        │ CONVEY.  2674    2674    │ TDS        0.00   │    │
│  │ PL  —        │ LTC      1910    1910    │ SECURITY   0.00   │    │
│  │ WFH —        │ RE.MED    764     764    │                   │    │
│  │ COMP—        │ EDU.      382     382    │                   │    │
│  │              │ FIX VAR  5000    5000    │                   │    │
│  │ PRESENT  30  │ OT HRS      0       0    │                   │    │
│  │              │ TOTAL  43200.00          │ TOTAL    2000.00  │    │
│  └──────────────┴──────────────────────────┴───────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│  ZONE 4: NET PAYABLE + FOOTER                                       │
│  NET PAYABLE (A − B):  ₹ 41200.00                                   │
│  This is a system generated pay slip and does not require signature │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Zone 1 — Company Header

Pulled from `company_profile` master (see `PAYROLL_MASTER_DATA.md` §9):

| Line | Field | Style |
| --- | --- | --- |
| 1 | `company_name` | 14pt bold, centered |
| 2 | `address_line_1, address_line_2, city, state, pincode` joined with commas | 9pt regular, centered |
| 3 | Optional logo (left-aligned, if `logo_s3_key` present) | 40×40 px max |

## 3. Zone 2 — Employee Meta

Two-column key-value grid. Left column and right column alternate:

| Left column | Right column |
| --- | --- |
| `EMP NUMBER : RT-DEV-153` | `BANK NAME : RELIANCE` *(from `users.bank_name`)* |
| `EMP NAME : <name>` | `A/C NO : 12830100028299` *(from `users.bank_account_no`)* |
| `DESIGNATION : FULL STACK DEVELOPER` | `DOJ : 02-06-2025` *(date format `dd-MM-yyyy`)* |
| `CTC : 45000.00` | `MONTH : MARCH_2026` *(uppercase, `MMMM_yyyy`)* |

Font: 10pt regular. Label in slightly bolder weight.

### 3.1 Month Formatting

Payslip shows `MONTH : MARCH_2026`. The underscore is intentional and preserved from the sample. Format code: `MMMM_yyyy` (upper-cased).

## 4. Zone 3 — Three-Column Body

### 4.1 Column Widths (A4 portrait, 595 pt wide)

- Working Details: ~140 pt
- Earning Details (A): ~280 pt (split: Row 100 pt | Actual 90 pt | Payable 90 pt)
- Deduction Details (B): ~175 pt (split: Row 110 pt | Amount 65 pt)

### 4.2 Working Details Column

Each row shows label + value. Where there is no activity, the sample shows `—` (em dash).

| Row | Label | Value |
| --- | --- | --- |
| 1 | `WD` | `30` (always — D1) |
| 2 | `CL` | `cl_days` or `—` if 0 |
| 3 | `SL` | `sl_days` or `—` if 0 |
| 4 | `LWP` | `lwp_days` or `—` if 0 |
| 5 | `PL` | `pl_days` or `—` if 0 |
| 6 | `WFH` | `wfh_days` or `—` if 0 |
| 7 | `Complimentary Off` | `comp_off_days` or `—` if 0 *(D15 — renamed from "COM Leave")* |
| 8 | *(blank spacer)* | |
| 9 | `PRESENT DAYS` | `present_days` **bold** *(per D10: WD − LWP only)* |

All numeric values right-aligned within the cell.

### 4.3 Earning Details Column (A)

Header row: three sub-headers — `Row Name` | `Actual` | `Payable`.

Then one row per earning line (in `display_order` from `payroll_salary_components` and `payroll_earning_types`):

| Row | Actual | Payable |
| --- | --- | --- |
| `BASIC` | `basic_actual` | `basic_payable` |
| `HRA` | `hra_actual` | `hra_payable` |
| `SP. ALLOWANCES` | `sp_allow_actual` | `sp_allow_payable` |
| `CONVEYANCE` | `conveyance_actual` | `conveyance_payable` |
| `LTC` | `ltc_actual` | `ltc_payable` |
| `RE. MEDICAL` | `re_medical_actual` | `re_medical_payable` |
| `EDU. ALLOWANCES` | `education_actual` | `education_payable` |
| `FIX VARIABLE` | `fix_variable` | `fix_variable` *(same value in both columns — incentive is not LWP-affected)* |
| `EXTRA WORKING HRS` | `ot_pay` | `ot_pay` *(same both columns)* |
| *(spacer row)* | | |
| **`TOTAL`** | | **`total_earnings`** (bold, right-aligned) |

Numeric format: 2 decimals, grouping comma for thousands (`19,100.00` — but the sample shows `19100.00` without grouping; match sample). **Decision: no thousand separators** — exactly matches the sample.

### 4.4 Deduction Details Column (B)

| Row | Amount |
| --- | --- |
| `PF` | `employee_pf` |
| `ESIC` | `employee_esic` if `esic_applied` else `0.00` |
| `P.TAX` | `professional_tax` |
| `TDS` | `tds` |
| `SECURITY` | *(security deposit deduction, if any — manual field; else `0.00`)* |
| `LOAN` | `loan_emi` *(only shown if > 0 — otherwise omitted)* |
| `SAL DEDUCTION` | `sal_deduction` *(only shown if > 0)* |
| *(spacer)* | |
| **`TOTAL`** | **`total_deductions`** (bold) |

## 5. Zone 4 — Net Payable + Footer

```
NET PAYABLE (A − B):  ₹ 41200.00
```

- Label font: 11pt bold
- Value font: 14pt bold
- Right-aligned
- **No thousand separators** — consistent with all other amounts on the payslip (matches sample payslip). *(v2.3 — Review item G7: resolved formatting contradiction. All amounts on the payslip use plain decimal format without grouping commas.)*
- Currency symbol: `₹` (Unicode U+20B9). PDF generator must use a font that includes the Rupee glyph (embed `Noto Sans` or `DejaVu Sans`).

Footer line (9pt italic, centered):

```
This is a system generated pay slip and does not require signature
```

Footer text is sourced from `company_profile.payslip_footer_text` (editable).

## 6. PDF Generation Library — Decision Required

**Open question** (tracked in `PAYROLL_OPEN_QUESTIONS.md`): which PDF generator to use in NestJS.

| Option | Pros | Cons |
| --- | --- | --- |
| `pdfkit` | Lightweight, pure JS, easy streaming | Manual layout; more code for tables |
| `puppeteer` (HTML → PDF) | Write in HTML/CSS, pixel-perfect from browser | Heavy (bundles Chromium), ~200MB, slower |
| `@react-pdf/renderer` | JSX-based components | Another React runtime server-side |
| `PDFKit` + `pdfmake` | Declarative document definitions | Extra dep; similar to pdfkit |

**Recommended default:** `pdfkit` with manual layout. Table-oriented rendering is straightforward, performance is good for 1000+ employees, no Chromium overhead. Final call pending Rakesh review.

## 7. Password Protection

Per D11:

```typescript
const password = formatDDMM(user.dob);   // e.g., DOB 14-Mar-1995 → "1403"

// pdfkit supports this via ownerPassword + userPassword
const doc = new PDFDocument({
  userPassword: password,
  ownerPassword: password + '_admin',   // admin master password, not shared
  permissions: { printing: 'highResolution', modifying: false, copying: false },
});
```

### 7.1 DOB Format Function

```typescript
function formatDDMM(dob: Date): string {
  const dd = String(dob.getDate()).padStart(2, '0');
  const mm = String(dob.getMonth() + 1).padStart(2, '0');
  return dd + mm;
}
// 5 January → "0501"
// 14 March → "1403"
// 31 December → "3112"
```

### 7.2 Missing DOB Handling

If `users.dob IS NULL`:
- Payslip generation for that employee **fails** with error.
- Admin sees the failure in Step 5 delivery status.
- Fix: admin updates DOB in `users` table, then retries payslip delivery for that employee only.

## 8. S3 Storage

### 8.1 Path

```
s3://rockers-hr-payslips/{year}/{month_name_lower}/{emp_number}.pdf
```

Example: `s3://rockers-hr-payslips/2026/march/RT-DEV-153.pdf`

### 8.2 Bucket Settings

- Region: ap-south-1 (Mumbai)
- Encryption: SSE-S3 (AES-256) at rest — **required**
- Versioning: enabled (so accidental overwrites don't lose history)
- Public access: blocked at bucket level
- Signed URLs: TTL 24 hours for employee download; TTL 15 min for admin preview

### 8.3 Object Metadata

```
Content-Type: application/pdf
x-amz-meta-emp-number: RT-DEV-153
x-amz-meta-payroll-run-id: <uuid>
x-amz-meta-month: 2026-03
x-amz-meta-password-protected: true
```

## 9. Email Delivery via SMTP

Per D15 + `PAYROLL_WORKFLOW.md` §6.3, payslips are auto-emailed on release.

### 9.1 Recipient

`users.email` (the Gmail company-domain address from original registration).

### 9.2 Template

See `PAYROLL_NOTIFICATIONS.md` §2 for full template. Summary:

| Field | Value |
| --- | --- |
| From | `payroll@rockershr.com` *(configurable)* |
| To | `{user.email}` |
| Subject | `Your Payslip for {MONTH} {YEAR} — Rockers HR` |
| Body | Brief greeting, note about password (DDMM hint), contact for queries |
| Attachment | `payslip_{emp_number}_{MONTH}_{YEAR}.pdf` (password-protected) |

Password is **not** included in email body. Hint is: *"Your payslip is password protected. The password is your date of birth in DDMM format."*

### 9.3 Delivery Tracking

Row in `payslip_deliveries` (see `PAYROLL_DATABASE_SCHEMA.md` §5) per attempt:
- `PENDING` → `GENERATED` → `EMAILED` → (optional: `BOUNCED` / `FAILED`)

Retries: automatic up to 3 attempts with exponential backoff (30s, 2min, 10min). After 3 failures, admin must manually retry from UI.

## 10. Payslip Preview (Admin Tool)

Admin can preview any employee's payslip **before** Step 5 release from the Review screen. Preview:
- Generates PDF on-demand (no S3 write)
- Streams directly to admin browser
- **Watermarked** with "PREVIEW — NOT RELEASED" diagonally across the page
- Not password-protected (preview only)

## 11. Employee Self-Service Download

From the Employee Portal (see `PAYROLL_FRONTEND_DESIGN.md` §7):
- List of released payslips by month
- Click → generate fresh 24h signed URL from S3 → download
- PDF remains password-protected with DOB/DDMM

## 12. Character Set & Font Requirements

- Use a font that includes the Rupee glyph: `Noto Sans`, `DejaVu Sans`, or `Roboto`.
- Embed font in PDF (do NOT rely on reader defaults).
- Handle Unicode: names with Indic scripts (Gujarati, Hindi) must render correctly — use a font with comprehensive Indic support (e.g., `Noto Sans Gujarati`) or fall back to Latin transliteration if font bundling budget is tight.

## 13. Future Enhancements (Phase 2)

Not in MVP but should not be blocked by current design:

- YTD cumulative box (Gross, PF, PT, TDS paid to date this FY)
- Tax regime comparison callout
- Digital signature block
- QR code linking to online payslip page
- Multi-language payslips

These are UI additions; schema in `payroll_items` already carries all data needed.

---

*End of PAYROLL_PAYSLIP_FORMAT.md. Next: PAYROLL_API_CONTRACTS.md — the REST endpoints.*
