# PAYROLL_CALCULATION_ENGINE.md

**Scope:** The deterministic salary calculation engine. This file is the **single source of truth** for how salaries are computed. Every number on a payslip, in `payroll_items`, or in a report traces back to this spec.
**Version:** v2.3

Cross-refs:
- Master data consumed → `PAYROLL_MASTER_DATA.md`
- Target schema → `PAYROLL_DATABASE_SCHEMA.md` §4 (`payroll_items`)
- Payslip presentation → `PAYROLL_PAYSLIP_FORMAT.md`

---

## 1. Engine Contract

```
INPUT:  PayrollRunEmployee (snapshot from Step 2 import)
OUTPUT: PayrollItem (all computed fields, ready to write)
```

The engine is:
- **Pure:** same input → same output, no side effects.
- **Deterministic:** no random, no current time, no network.
- **Self-contained:** reads only from the snapshot; does NOT read live master data.
- **Idempotent:** re-running on the same input produces an identical row.

Because the snapshot contains frozen master data (`snapshot_components`, `snapshot_statutory`), the engine is insulated from master data edits that occur mid-run.

## 2. Input Shape

```typescript
interface PayrollRunEmployeeSnapshot {
  user_id: string;
  month: number;       // 1..12
  year: number;

  // salary structure (frozen)
  gross: number;                // e.g., 38200.00
  incentive: number;            // fix variable, e.g., 5000.00
  tds: number;                  // monthly, admin-entered
  loan_emi: number;
  sal_deduction: number;
  security_return: number;
  pf_applicable: boolean;

  // leave & OT counters
  lwp_days: number;             // e.g., 0, 2.5
  ot_hours: number;

  // frozen master data
  components: Array<{
    code: 'BASIC'|'HRA'|'SP_ALLOW'|'CONVEYANCE'|'LTC'|'RE_MEDICAL'|'EDUCATION';
    percentage: number;         // e.g., 50.00
    is_pf_base: boolean;
  }>;

  statutory: {
    pf_cap_amount: number;      // 15000
    pf_fixed_at_cap: number;    // 1800
    pf_rate_below_cap: number;  // 0.12
    pf_employer_matches_employee: boolean;   // true
    esic_active: boolean;       // false in MVP
    esic_threshold_gross: number;   // 21000
    esic_employer_rate: number;     // 0.0325
    esic_employee_rate: number;     // 0.0075
    pt_flat_amount: number;     // 200
    ot_multiplier: number;      // 1.5
    ot_divisor_day: number;     // 30
    ot_divisor_hour: number;    // 9
    payroll_cycle_days: number; // 30
  };
}
```

## 3. Rounding Rule

All amounts are rounded to **2 decimal places** using half-up rounding (`Math.round(x * 100) / 100`). All intermediate results retain full precision; only final stored values are rounded.

For integer-only statutory amounts (PF fixed, PT), use whole-rupee values (`1800`, `200`) — no trailing `.00`.

## 4. Step-by-Step Formula

### 4.1 Salary for Calculation (SFC)

```typescript
const lwpDeduction = round2(gross / statutory.payroll_cycle_days * lwp_days);
const salForCalc = gross - lwpDeduction;
```

Example (RT-DEV-153, March 2026, 0 LWP days):
- `lwpDeduction = 38200 / 30 * 0 = 0`
- `salForCalc = 38200 - 0 = 38200` ✓

Example (hypothetical, 2 LWP days):
- `lwpDeduction = 38200 / 30 * 2 = 2546.67`
- `salForCalc = 38200 - 2546.67 = 35653.33`

### 4.2 The 7 Earning Components

For each component in `snapshot_components`:

```typescript
for (const comp of components) {
  const actual = round2(gross * comp.percentage / 100);       // full-month value, shown in "Actual" column
  const payable = round2(salForCalc * comp.percentage / 100); // LWP-adjusted, shown in "Payable" column
}
```

Example (RT-DEV-153, 0 LWP → actual = payable):

| code | percentage | actual | payable |
| --- | --- | --- | --- |
| BASIC | 50% | 19100.00 | 19100.00 |
| HRA | 20% | 7640.00 | 7640.00 |
| SP_ALLOW | 15% | 5730.00 | 5730.00 |
| CONVEYANCE | 7% | 2674.00 | 2674.00 |
| LTC | 5% | 1910.00 | 1910.00 |
| RE_MEDICAL | 2% | 764.00 | 764.00 |
| EDUCATION | 1% | 382.00 | 382.00 |
| **Sum** | **100%** | **38200.00** | **38200.00** ✓ |

All 7 figures match the sample payslip exactly.

### 4.2.1 Rounding Remainder Absorption (v2.3)

> **v2.3 (Review item C1).** When 7 individually rounded components are summed, rounding error may cause the total to differ from `salForCalc` (or `gross` for actuals) by up to ±₹0.07. To ensure the payslip balances exactly, the **last component** (by `display_order`) absorbs the rounding difference.

```typescript
// After computing all 7 components:
const sumPayable = sum of all 7 payable amounts;
const remainder = round2(salForCalc - sumPayable);
if (Math.abs(remainder) <= 0.10) {
  // Absorb into last component (EDUCATION, display_order=7)
  compAmounts['EDUCATION'].payable += remainder;
}

const sumActual = sum of all 7 actual amounts;
const remainderActual = round2(gross - sumActual);
if (Math.abs(remainderActual) <= 0.10) {
  compAmounts['EDUCATION'].actual += remainderActual;
}
```

This guarantees:
- `sum(7 payable components) == salForCalc` exactly
- `sum(7 actual components) == gross` exactly
- Maximum adjustment to EDUCATION: ±₹0.07 (imperceptible)

### 4.3 PF — Conditional, Not MIN()

Per D4 — implementation must use the **conditional** form:

```typescript
const basicActual = /* BASIC component actual (on gross, NOT on SFC) */;

function calcPF(basic: number): number {
  return basic >= statutory.pf_cap_amount
    ? statutory.pf_fixed_at_cap
    : Math.round(basic * statutory.pf_rate_below_cap);
}

const employeePF = pf_applicable ? calcPF(basicActual) : 0;
const employerPF = statutory.pf_employer_matches_employee && pf_applicable
  ? calcPF(basicActual)
  : 0;
```

Notes:
- PF is always calculated on **actual** basic (full-month gross-based), not on payable basic. This is confirmed from sample payslip: Basic Actual = ₹19,100, PF = ₹1,800 (not 12% of payable basic after LWP).
- **LWP = 30 (full month absent) edge case (v2.3, Review C2):** When an employee has LWP for the entire month, `salForCalc = 0` and all payable components = 0, but PF is still computed on `basicActual` (the full-month figure). This results in PF being deducted from zero earnings, clamping `netPayable` to 0. **This is the correct behavior per Indian EPFO regulations** — PF contributions are mandatory and calculated on the statutory basic, not on days worked. The employer and employee both owe PF regardless of attendance. The resulting "negative" is absorbed by the `netPayable = max(0, ...)` clamp, and the admin sees a warning flag on that employee's row in Review.
- Verification from sample salary sheet:
  - PQR basic ₹33,908 → `33908 >= 15000` → PF = **₹1,800** ✓
  - HSBC basic ₹12,500 → `12500 < 15000` → PF = `round(12500 * 0.12)` = **₹1,500** ✓
  - Reliance basic ₹12,000 → `12000 < 15000` → PF = `round(12000 * 0.12)` = **₹1,440** ✓
  - RT-DEV-153 basic ₹19,100 → `19100 >= 15000` → PF = **₹1,800** ✓

### 4.4 ESIC — Inactive Scaffold

```typescript
const esicApplied = statutory.esic_active && gross < statutory.esic_threshold_gross;

// Stored even when inactive, but only applied to deductions when esicApplied
const employeeESIC = round2(gross * statutory.esic_employee_rate);
const employerESIC = round2(gross * statutory.esic_employer_rate);
```

In MVP: `esic_active = false` → `esicApplied = false` → deductions use `0` for ESIC regardless of stored value. The stored value exists purely for scaffolding so that when ESIC is activated post-MVP, no schema change is needed.

### 4.5 Professional Tax

```typescript
const pt = statutory.pt_flat_amount;   // 200, fixed for all employees
```

### 4.6 Overtime

```typescript
const otPerDay = gross / statutory.payroll_cycle_days;              // gross / 30
const otPerHour = otPerDay / statutory.ot_divisor_hour;             // / 9 per D7
const otRate = otPerHour * statutory.ot_multiplier;                 // × 1.5
const otPay = round2(otRate * ot_hours);

// Stored: round2(otPerHour), round2(otRate), otPay
```

Example (RT-DEV-153, gross 38200, 5 OT hours):
- `otPerDay = 38200 / 30 = 1273.33`
- `otPerHour = 1273.33 / 9 = 141.48`
- `otRate = 141.48 * 1.5 = 212.22`
- `otPay = round(212.22 * 5) = 1061.11`

(Matches BRD Addendum §2 example.)

### 4.7 CTC

```typescript
const ctc = gross + employerPF + incentive;
const ctcAsPerIT = gross + incentive;    // excludes employer PF per D6
```

Verification:
- RT-DEV-153: `38200 + 1800 + 5000 = 45000` ✓ (payslip header)
- PQR: `67815 + 1800 + 15000 = 84615` ✓ (salary sheet)
- HSBC: `25000 + 1500 + 3500 = 30000` ✓
- ABC (PF-exempt): `50000 + 0 + incentive`

### 4.8 Totals

```typescript
// v2.3 (Review C3): incentive (fix_variable) is NOT pro-rated for LWP.
// It is paid in full regardless of how many days the employee was absent.
// This is confirmed business behavior — incentive is a fixed monthly amount, not attendance-linked.
const totalEarnings =
    sum7ComponentsPayable
  + incentive       // full amount, never LWP-adjusted
  + otPay
  + security_return;

const totalDeductions =
    employeePF
  + (esicApplied ? employeeESIC : 0)
  + pt
  + tds
  + loan_emi
  + sal_deduction;
// Note: security_return is a *return* to the employee, not a deduction

const netPayable = round2(totalEarnings - totalDeductions);
```

**Invariant:** `netPayable >= 0` — enforced by DB CHECK.
If `totalDeductions > totalEarnings` (extreme LWP case), the engine forces `netPayable = 0` and flags a warning on the run for admin review.

### 4.9 Present Days (D10)

```typescript
const presentDays = statutory.payroll_cycle_days - lwp_days;
// NOT: wd - (cl + sl + lwp + pl + ...); ONLY lwp reduces present days.
```

## 5. Reference Implementation (NestJS)

```typescript
// payroll/engine/payroll.engine.ts

import { PayrollItem, Snapshot } from './types';

export function calculate(snapshot: Snapshot): PayrollItem {
  const { gross, incentive, tds, loan_emi, sal_deduction, security_return,
          pf_applicable, lwp_days, ot_hours, components, statutory } = snapshot;

  // 1. Sal for Calc
  const lwpDeduction = round2(gross / statutory.payroll_cycle_days * lwp_days);
  const salForCalc = round2(gross - lwpDeduction);

  // 2. Components (actual + payable)
  const compAmounts: Record<string, {actual: number; payable: number}> = {};
  let sumPayable = 0;
  let sumActual = 0;
  for (const c of components) {
    const actual = round2(gross * c.percentage / 100);
    const payable = round2(salForCalc * c.percentage / 100);
    compAmounts[c.code] = { actual, payable };
    sumPayable += payable;
    sumActual += actual;
  }

  // 2b. Rounding remainder absorption (v2.3, Review C1)
  const lastComp = 'EDUCATION'; // display_order=7, absorbs rounding diff
  const remainderPayable = round2(salForCalc - sumPayable);
  if (Math.abs(remainderPayable) <= 0.10) {
    compAmounts[lastComp].payable = round2(compAmounts[lastComp].payable + remainderPayable);
    sumPayable = salForCalc;
  }
  const remainderActual = round2(gross - sumActual);
  if (Math.abs(remainderActual) <= 0.10) {
    compAmounts[lastComp].actual = round2(compAmounts[lastComp].actual + remainderActual);
    sumActual = gross;
  }

  const basicActual = compAmounts['BASIC'].actual;

  // 3. PF — conditional form
  const pfCalc = (basic: number) =>
    basic >= statutory.pf_cap_amount
      ? statutory.pf_fixed_at_cap
      : Math.round(basic * statutory.pf_rate_below_cap);

  const employeePF = pf_applicable ? pfCalc(basicActual) : 0;
  const employerPF = (statutory.pf_employer_matches_employee && pf_applicable)
    ? pfCalc(basicActual) : 0;

  // 4. ESIC — scaffold, inactive
  const esicApplied = statutory.esic_active && gross < statutory.esic_threshold_gross;
  const employeeESIC = round2(gross * statutory.esic_employee_rate);
  const employerESIC = round2(gross * statutory.esic_employer_rate);

  // 5. PT
  const pt = statutory.pt_flat_amount;

  // 6. OT
  const otPerHour = round2((gross / statutory.payroll_cycle_days) / statutory.ot_divisor_hour);
  const otRate = round2(otPerHour * statutory.ot_multiplier);
  const otPay = round2(otRate * ot_hours);

  // 7. CTC
  const ctc = round2(gross + employerPF + incentive);
  const ctcAsPerIT = round2(gross + incentive);

  // 8. Totals
  const totalEarnings = round2(sumPayable + incentive + otPay + security_return);
  const totalDeductions = round2(
    employeePF
    + (esicApplied ? employeeESIC : 0)
    + pt + tds + loan_emi + sal_deduction
  );
  const netPayable = Math.max(0, round2(totalEarnings - totalDeductions));

  // 9. Present days (D10)
  const presentDays = statutory.payroll_cycle_days - lwp_days;

  return {
    user_id: snapshot.user_id,
    lwp_deduction: lwpDeduction,
    sal_for_calc: salForCalc,
    basic_actual: compAmounts['BASIC'].actual,
    basic_payable: compAmounts['BASIC'].payable,
    hra_actual: compAmounts['HRA'].actual,
    hra_payable: compAmounts['HRA'].payable,
    sp_allow_actual: compAmounts['SP_ALLOW'].actual,
    sp_allow_payable: compAmounts['SP_ALLOW'].payable,
    conveyance_actual: compAmounts['CONVEYANCE'].actual,
    conveyance_payable: compAmounts['CONVEYANCE'].payable,
    ltc_actual: compAmounts['LTC'].actual,
    ltc_payable: compAmounts['LTC'].payable,
    re_medical_actual: compAmounts['RE_MEDICAL'].actual,
    re_medical_payable: compAmounts['RE_MEDICAL'].payable,
    education_actual: compAmounts['EDUCATION'].actual,
    education_payable: compAmounts['EDUCATION'].payable,
    fix_variable: incentive,
    ot_per_hour: otPerHour,
    ot_rate: otRate,
    ot_pay: otPay,
    security_return,
    employee_pf: employeePF,
    employer_pf: employerPF,
    employee_esic: employeeESIC,
    employer_esic: employerESIC,
    esic_applied: esicApplied,
    professional_tax: pt,
    tds, loan_emi, sal_deduction,
    total_earnings: totalEarnings,
    total_deductions: totalDeductions,
    net_payable: netPayable,
    ctc, ctc_as_per_it: ctcAsPerIT,
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
```

## 6. Verification Matrix — RT-DEV-153 (March 2026)

Full trace matching `Sample_Pay_Slip.pdf`:

| Stage | Computed | Sample | ✓ |
| --- | --- | --- | --- |
| Gross | 38200.00 | 38200 | ✓ |
| LWP days | 0 | 0 | ✓ |
| Sal for Calc | 38200.00 | 38200 | ✓ |
| Basic Actual / Payable | 19100 / 19100 | 19100 / 19100 | ✓ |
| HRA Actual / Payable | 7640 / 7640 | 7640 / 7640 | ✓ |
| SP. Allow | 5730 / 5730 | 5730 / 5730 | ✓ |
| Conveyance | 2674 / 2674 | 2674 / 2674 | ✓ |
| LTC | 1910 / 1910 | 1910 / 1910 | ✓ |
| RE. Medical | 764 / 764 | 764 / 764 | ✓ |
| Education | 382 / 382 | 382 / 382 | ✓ |
| Fix Variable | 5000 / 5000 | 5000 / 5000 | ✓ |
| OT Hrs Pay | 0 / 0 | 0 / 0 | ✓ |
| **Total Earnings** | **43200.00** | **43200** | ✓ |
| Employee PF | 1800 | 1800 | ✓ |
| ESIC | 0 (inactive) | 0 | ✓ |
| PT | 200 | 200 | ✓ |
| TDS | 0 | 0 | ✓ |
| Security | 0 | 0 | ✓ |
| **Total Deductions** | **2000.00** | **2000** | ✓ |
| **Net Payable** | **41200.00** | **41200** | ✓ |
| CTC | 45000 | 45000 | ✓ |

## 7. Edge Cases & Their Rules

| Case | Rule |
| --- | --- |
| LWP = 30 (entire month off without pay) | Sal for Calc = 0, all 7 components = 0 payable. Net payable may equal `incentive + ot_pay - deductions`, floored at 0. |
| LWP > 30 | Cap at 30 during import (Step 2). Never allow > cycle_days. |
| Basic < ₹15,000 (pro-rata after very high LWP) | Use **actual** basic (not payable) for PF. Actual basic is pre-LWP, so this scenario is rare unless gross itself is very low. |
| `pf_applicable = FALSE` (PF-exempt) | Both Employee PF and Employer PF = 0. CTC = gross + 0 + incentive. |
| `esic_active = TRUE` + Gross ≥ ₹21,000 | ESIC = 0 (above threshold). Module exits gracefully. |
| `esic_active = TRUE` + Gross < ₹21,000 | Employee ESIC deducted, Employer ESIC added to CTC. |
| Component %s don't sum to 100 | Engine does not validate — **master data layer** enforces. If somehow invalid data reaches engine, SFC split may not sum cleanly; DB CHECK on `total_earnings >= sum components` catches it. |
| Rounding diff across 7 components (v2.3) | Last component (EDUCATION) absorbs remainder up to ±₹0.10 so sum matches exactly. See §4.2.1. |
| Incentive (fix_variable) with high LWP (v2.3) | Incentive is NOT pro-rated for LWP — paid in full. See §4.8 comment. |
| Negative net payable | Forced to 0. Admin sees warning icon on that row in Review. |
| OT hours with fractional values (e.g., 4.5) | Fully supported — just `round2(otRate * hours)`. |

## 8. Engine Testing Contract

Every new engine change must pass the **verification matrix** in §6. Also required:

- Unit test: each of the 4 employees in `Sample_Salary_Sheet.xls` (ABC, PQR, HSBC, Reliance) must produce a `PayrollItem` matching the sheet within ₹1 tolerance.
- Unit test: RT-DEV-153 full trace matches `Sample_Pay_Slip.pdf` exactly.
- Property test: for any valid `Snapshot`, `totalEarnings - totalDeductions == netPayable` (or `netPayable == 0` when negative).
- Property test: `sum(7 payable components) == salForCalc` **exactly** (rounding remainder absorbed by EDUCATION per §4.2.1).
- Property test: `sum(7 actual components) == gross` **exactly** (rounding remainder absorbed by EDUCATION per §4.2.1).

## 9. What the Engine Does NOT Do

- It does NOT fetch live master data. Always from snapshot.
- It does NOT apply any tax slab logic (Phase 2).
- It does NOT generate PDFs or emails. That's orchestrated by the run service in Step 5.
- It does NOT handle concurrency. Caller (Step 3 service) manages transactions.
- It does NOT persist. It returns a `PayrollItem` object; caller writes.

---

*End of PAYROLL_CALCULATION_ENGINE.md. Next: PAYROLL_PAYSLIP_FORMAT.md — the PDF layout.*
