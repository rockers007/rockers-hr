import {
  ComponentAmount,
  ComponentCode,
  PayrollComputation,
  PayrollSnapshot,
} from './payroll-engine.types';

/**
 * Deterministic payroll calculation engine.
 * Pure function — same input → same output, no side effects, no I/O.
 *
 * Canonical spec: planning/PAYROLL_CALCULATION_ENGINE.md
 */

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

const REQUIRED_COMPONENTS: ComponentCode[] = [
  'BASIC',
  'HRA',
  'SP_ALLOW',
  'CONVEYANCE',
  'LTC',
  'RE_MEDICAL',
  'EDUCATION',
];

export function calculate(snapshot: PayrollSnapshot): PayrollComputation {
  const {
    user_id,
    gross,
    incentive,
    tds,
    loan_emi,
    sal_deduction,
    security_return,
    pf_applicable,
    // Default true preserves pre-flag behavior: existing payroll runs
    // and unit tests construct snapshots without this field, and
    // expect ESIC to track only statutory.esic_active + gross
    // threshold (the original two-gate semantics).
    esic_applicable = true,
    lwp_days,
    ot_hours,
    components,
    statutory,
  } = snapshot;

  const warnings: string[] = [];

  // 1. Sal for Calc (§4.1)
  const cappedLwp = Math.min(lwp_days, statutory.payroll_cycle_days);
  if (lwp_days > statutory.payroll_cycle_days) {
    warnings.push(
      `LWP days ${lwp_days} exceeded cycle ${statutory.payroll_cycle_days}; capped.`,
    );
  }
  const lwpDeduction = round2(
    (gross / statutory.payroll_cycle_days) * cappedLwp,
  );
  const salForCalc = round2(gross - lwpDeduction);

  // 2. Components — actual (gross-based) and payable (SFC-based) (§4.2)
  const compAmounts: Record<ComponentCode, ComponentAmount> = {
    BASIC: { actual: 0, payable: 0 },
    HRA: { actual: 0, payable: 0 },
    SP_ALLOW: { actual: 0, payable: 0 },
    CONVEYANCE: { actual: 0, payable: 0 },
    LTC: { actual: 0, payable: 0 },
    RE_MEDICAL: { actual: 0, payable: 0 },
    EDUCATION: { actual: 0, payable: 0 },
  };

  let sumActual = 0;
  let sumPayable = 0;
  for (const c of components) {
    const actual = round2((gross * c.percentage) / 100);
    const payable = round2((salForCalc * c.percentage) / 100);
    compAmounts[c.code] = { actual, payable };
    sumActual += actual;
    sumPayable += payable;
  }

  // 2b. Rounding remainder absorption by EDUCATION (§4.2.1, D23)
  const remainderActual = round2(gross - sumActual);
  if (Math.abs(remainderActual) <= 0.1) {
    compAmounts.EDUCATION.actual = round2(
      compAmounts.EDUCATION.actual + remainderActual,
    );
    sumActual = gross;
  }
  const remainderPayable = round2(salForCalc - sumPayable);
  if (Math.abs(remainderPayable) <= 0.1) {
    compAmounts.EDUCATION.payable = round2(
      compAmounts.EDUCATION.payable + remainderPayable,
    );
    sumPayable = salForCalc;
  }

  const basicActual = compAmounts.BASIC.actual;

  // 3. PF — conditional (§4.3, D4)
  const pfCalc = (basic: number): number =>
    basic >= statutory.pf_cap_amount
      ? statutory.pf_fixed_at_cap
      : Math.round(basic * statutory.pf_rate_below_cap);

  const employeePF = pf_applicable ? pfCalc(basicActual) : 0;
  const employerPF =
    statutory.pf_employer_matches_employee && pf_applicable
      ? pfCalc(basicActual)
      : 0;

  // 4. ESIC — scaffold (§4.4)
  // Two AND-gates plus the gross threshold: the system-wide
  // statutory.esic_active master switch, AND the per-employee
  // esic_applicable flag (added with EsicApplicableFlag1712000000090).
  // HR can disable ESIC for an individual without flipping the
  // company-wide setting.
  const esicApplied =
    statutory.esic_active &&
    esic_applicable &&
    gross < statutory.esic_threshold_gross;
  const employeeESIC = round2(gross * statutory.esic_employee_rate);
  const employerESIC = round2(gross * statutory.esic_employer_rate);

  // 5. PT (§4.5, D8)
  const pt = statutory.pt_flat_amount;

  // 6. OT (§4.6, D7)
  const otPerHour = round2(
    gross / statutory.payroll_cycle_days / statutory.ot_divisor_hour,
  );
  const otRate = round2(otPerHour * statutory.ot_multiplier);
  const otPay = round2(otRate * ot_hours);

  // 7. CTC (§4.7, D5/D6)
  const ctc = round2(gross + employerPF + incentive);
  const ctcAsPerIT = round2(gross + incentive);

  // 8. Totals (§4.8 — incentive NOT prorated per D25)
  const totalEarnings = round2(
    sumPayable + incentive + otPay + security_return,
  );
  const totalDeductions = round2(
    employeePF +
      (esicApplied ? employeeESIC : 0) +
      pt +
      tds +
      loan_emi +
      sal_deduction,
  );

  const rawNet = round2(totalEarnings - totalDeductions);
  const netPayable = Math.max(0, rawNet);
  if (rawNet < 0) {
    warnings.push(
      `Deductions exceed earnings (net would be ${rawNet}); clamped to 0.`,
    );
  }

  // 9. Present days (§4.9, D10)
  const presentDays = statutory.payroll_cycle_days - cappedLwp;

  // 10. Safety: verify all required components present
  const missing = REQUIRED_COMPONENTS.filter(
    (code) => !components.some((c) => c.code === code),
  );
  if (missing.length > 0) {
    warnings.push(`Missing components: ${missing.join(', ')}`);
  }

  return {
    user_id,
    lwp_deduction: lwpDeduction,
    sal_for_calc: salForCalc,

    basic_actual: compAmounts.BASIC.actual,
    basic_payable: compAmounts.BASIC.payable,
    hra_actual: compAmounts.HRA.actual,
    hra_payable: compAmounts.HRA.payable,
    sp_allow_actual: compAmounts.SP_ALLOW.actual,
    sp_allow_payable: compAmounts.SP_ALLOW.payable,
    conveyance_actual: compAmounts.CONVEYANCE.actual,
    conveyance_payable: compAmounts.CONVEYANCE.payable,
    ltc_actual: compAmounts.LTC.actual,
    ltc_payable: compAmounts.LTC.payable,
    re_medical_actual: compAmounts.RE_MEDICAL.actual,
    re_medical_payable: compAmounts.RE_MEDICAL.payable,
    education_actual: compAmounts.EDUCATION.actual,
    education_payable: compAmounts.EDUCATION.payable,

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
    tds,
    loan_emi,
    sal_deduction,

    total_earnings: totalEarnings,
    total_deductions: totalDeductions,
    net_payable: netPayable,
    ctc,
    ctc_as_per_it: ctcAsPerIT,

    present_days: presentDays,
    warnings,
  };
}
