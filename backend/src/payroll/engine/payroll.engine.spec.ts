import { calculate } from './payroll.engine';
import {
  PayrollSnapshot,
  SnapshotComponent,
  SnapshotStatutory,
} from './payroll-engine.types';
import { validateComponents } from './payroll-engine.helpers';

/**
 * Engine verification tests.
 * Every case below traces to planning/PAYROLL_CALCULATION_ENGINE.md §6/§7.
 */

const DEFAULT_COMPONENTS: SnapshotComponent[] = [
  { code: 'BASIC', percentage: 50, is_pf_base: true, display_order: 1, payslip_label: 'BASIC' },
  { code: 'HRA', percentage: 20, is_pf_base: false, display_order: 2, payslip_label: 'HRA' },
  { code: 'SP_ALLOW', percentage: 15, is_pf_base: false, display_order: 3, payslip_label: 'SP. ALLOWANCES' },
  { code: 'CONVEYANCE', percentage: 7, is_pf_base: false, display_order: 4, payslip_label: 'CONVEYANCE' },
  { code: 'LTC', percentage: 5, is_pf_base: false, display_order: 5, payslip_label: 'LTC' },
  { code: 'RE_MEDICAL', percentage: 2, is_pf_base: false, display_order: 6, payslip_label: 'RE. MEDICAL' },
  { code: 'EDUCATION', percentage: 1, is_pf_base: false, display_order: 7, payslip_label: 'EDU. ALLOWANCES' },
];

const DEFAULT_STATUTORY: SnapshotStatutory = {
  pf_cap_amount: 15000,
  pf_fixed_at_cap: 1800,
  pf_rate_below_cap: 0.12,
  pf_employer_matches_employee: true,
  esic_active: false,
  esic_threshold_gross: 21000,
  esic_employer_rate: 0.0325,
  esic_employee_rate: 0.0075,
  pt_flat_amount: 200,
  ot_multiplier: 1.5,
  ot_divisor_day: 30,
  ot_divisor_hour: 9,
  payroll_cycle_days: 30,
};

function baseSnapshot(overrides: Partial<PayrollSnapshot> = {}): PayrollSnapshot {
  return {
    user_id: 'u1',
    gross: 38200,
    incentive: 5000,
    tds: 0,
    loan_emi: 0,
    sal_deduction: 0,
    security_return: 0,
    pf_applicable: true,
    lwp_days: 0,
    ot_hours: 0,
    components: DEFAULT_COMPONENTS,
    statutory: DEFAULT_STATUTORY,
    ...overrides,
  };
}

describe('payroll.engine — RT-DEV-153 verification matrix (§6)', () => {
  // Trace every row of PAYROLL_CALCULATION_ENGINE.md §6
  const result = calculate(baseSnapshot());

  it('Sal for Calc = 38200', () => {
    expect(result.sal_for_calc).toBe(38200);
    expect(result.lwp_deduction).toBe(0);
  });

  it('Basic = 19100 (actual + payable)', () => {
    expect(result.basic_actual).toBe(19100);
    expect(result.basic_payable).toBe(19100);
  });

  it('HRA = 7640', () => {
    expect(result.hra_actual).toBe(7640);
    expect(result.hra_payable).toBe(7640);
  });

  it('SP. Allowances = 5730', () => {
    expect(result.sp_allow_actual).toBe(5730);
    expect(result.sp_allow_payable).toBe(5730);
  });

  it('Conveyance = 2674', () => {
    expect(result.conveyance_actual).toBe(2674);
    expect(result.conveyance_payable).toBe(2674);
  });

  it('LTC = 1910', () => {
    expect(result.ltc_actual).toBe(1910);
    expect(result.ltc_payable).toBe(1910);
  });

  it('RE. Medical = 764', () => {
    expect(result.re_medical_actual).toBe(764);
    expect(result.re_medical_payable).toBe(764);
  });

  it('Education = 382', () => {
    expect(result.education_actual).toBe(382);
    expect(result.education_payable).toBe(382);
  });

  it('Fix Variable = 5000', () => {
    expect(result.fix_variable).toBe(5000);
  });

  it('OT = 0', () => {
    expect(result.ot_pay).toBe(0);
  });

  it('Total Earnings = 43200', () => {
    expect(result.total_earnings).toBe(43200);
  });

  it('Employee PF = 1800 (basic >= 15000)', () => {
    expect(result.employee_pf).toBe(1800);
  });

  it('ESIC = 0 (inactive)', () => {
    expect(result.employee_esic).toBe(286.5); // 38200 * 0.0075, stored but not applied
    expect(result.esic_applied).toBe(false);
  });

  it('PT = 200', () => {
    expect(result.professional_tax).toBe(200);
  });

  it('Total Deductions = 2000 (PF 1800 + PT 200; ESIC excluded)', () => {
    expect(result.total_deductions).toBe(2000);
  });

  it('Net Payable = 41200', () => {
    expect(result.net_payable).toBe(41200);
  });

  it('CTC = 45000 (gross + employer PF + incentive)', () => {
    expect(result.ctc).toBe(45000);
  });

  it('CTC As Per IT = 43200 (gross + incentive, excludes employer PF per D6)', () => {
    expect(result.ctc_as_per_it).toBe(43200);
  });

  it('Present Days = 30 (no LWP)', () => {
    expect(result.present_days).toBe(30);
  });
});

describe('payroll.engine — Sample Salary Sheet employees', () => {
  it('PQR: basic 33908 >= 15000 → PF 1800, CTC = 67815 + 1800 + 15000 = 84615', () => {
    // Reverse-engineer components from basic=33908 at 50% => gross = 67816 (but BRD says 67815; off by ₹1 rounding)
    // Use gross 67815 and verify basic ≈ 33907.50 → rounded 33908 by absorbing remainder
    const s = baseSnapshot({
      user_id: 'pqr',
      gross: 67815,
      incentive: 15000,
      pf_applicable: true,
    });
    const r = calculate(s);
    expect(r.basic_actual).toBeCloseTo(33907.5, 2);
    expect(r.employee_pf).toBe(1800); // basic_actual > cap → fixed 1800
    expect(r.ctc).toBe(67815 + 1800 + 15000);
  });

  it('HSBC: basic 12500 < 15000 → PF round(12500*0.12) = 1500; CTC 25000+1500+3500 = 30000', () => {
    // Gross 25000 with BASIC=50% → 12500
    const s = baseSnapshot({
      user_id: 'hsbc',
      gross: 25000,
      incentive: 3500,
      pf_applicable: true,
    });
    const r = calculate(s);
    expect(r.basic_actual).toBe(12500);
    expect(r.employee_pf).toBe(1500);
    expect(r.ctc).toBe(30000);
  });

  it('Reliance: basic 12000 < 15000 → PF round(12000*0.12) = 1440', () => {
    const s = baseSnapshot({
      user_id: 'rel',
      gross: 24000,
      incentive: 0,
      pf_applicable: true,
    });
    const r = calculate(s);
    expect(r.basic_actual).toBe(12000);
    expect(r.employee_pf).toBe(1440);
    expect(r.employer_pf).toBe(1440);
  });

  it('ABC (PF-exempt): both Employee PF and Employer PF = 0; CTC = gross + 0 + incentive', () => {
    const s = baseSnapshot({
      user_id: 'abc',
      gross: 50000,
      incentive: 10000,
      pf_applicable: false,
    });
    const r = calculate(s);
    expect(r.employee_pf).toBe(0);
    expect(r.employer_pf).toBe(0);
    expect(r.ctc).toBe(60000);
  });
});

describe('payroll.engine — LWP scenarios', () => {
  it('2 LWP days: SFC = 35653.33, payable components scale, actual stays', () => {
    const s = baseSnapshot({ lwp_days: 2, incentive: 0 });
    const r = calculate(s);
    expect(r.lwp_deduction).toBeCloseTo(2546.67, 2);
    expect(r.sal_for_calc).toBeCloseTo(35653.33, 2);
    expect(r.basic_actual).toBe(19100); // full-month
    expect(r.basic_payable).toBeCloseTo(17826.67, 2);
    expect(r.present_days).toBe(28);
  });

  it('LWP = 30 (full absence, D24): SFC = 0, all components payable = 0, PF still 1800, net = 0', () => {
    const s = baseSnapshot({ lwp_days: 30, incentive: 0 });
    const r = calculate(s);
    expect(r.sal_for_calc).toBe(0);
    expect(r.basic_payable).toBe(0);
    expect(r.hra_payable).toBe(0);
    expect(r.employee_pf).toBe(1800); // PF on actual basic, per EPFO
    expect(r.net_payable).toBe(0); // clamped, would be negative
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.present_days).toBe(0);
  });

  it('LWP > 30 caps at 30 with warning', () => {
    const s = baseSnapshot({ lwp_days: 35, incentive: 0 });
    const r = calculate(s);
    expect(r.present_days).toBe(0);
    expect(r.warnings.some((w) => w.includes('capped'))).toBe(true);
  });

  it('Incentive NOT prorated for LWP (D25): 5 LWP days + 5000 incentive → incentive stays 5000', () => {
    const s = baseSnapshot({ lwp_days: 5, incentive: 5000 });
    const r = calculate(s);
    expect(r.fix_variable).toBe(5000);
  });
});

describe('payroll.engine — Overtime', () => {
  it('5 OT hours on gross 38200: perHour ≈ 141.48, rate ≈ 212.22, pay ≈ 1061.11', () => {
    const s = baseSnapshot({ ot_hours: 5 });
    const r = calculate(s);
    expect(r.ot_per_hour).toBeCloseTo(141.48, 2);
    expect(r.ot_rate).toBeCloseTo(212.22, 2);
    expect(r.ot_pay).toBeCloseTo(1061.1, 1);
  });

  it('Fractional OT hours (4.5h) supported', () => {
    const s = baseSnapshot({ ot_hours: 4.5 });
    const r = calculate(s);
    expect(r.ot_pay).toBeGreaterThan(0);
  });
});

describe('payroll.engine — ESIC scaffolding', () => {
  it('When inactive + gross < 21000: ESIC stored but not applied', () => {
    const s = baseSnapshot({ gross: 18000, incentive: 0 });
    const r = calculate(s);
    expect(r.esic_applied).toBe(false);
    expect(r.employee_esic).toBeCloseTo(135, 2); // 18000 * 0.0075
    // Not included in deductions
    expect(r.total_deductions).toBe(r.employee_pf + r.professional_tax);
  });

  it('When active + gross < 21000: ESIC applied', () => {
    const s = baseSnapshot({
      gross: 18000,
      incentive: 0,
      statutory: { ...DEFAULT_STATUTORY, esic_active: true },
    });
    const r = calculate(s);
    expect(r.esic_applied).toBe(true);
    expect(r.total_deductions).toBe(
      r.employee_pf + r.professional_tax + r.employee_esic,
    );
  });

  it('When active + gross >= 21000: ESIC NOT applied (above threshold)', () => {
    const s = baseSnapshot({
      statutory: { ...DEFAULT_STATUTORY, esic_active: true },
    });
    const r = calculate(s);
    expect(r.esic_applied).toBe(false);
  });
});

describe('payroll.engine — Rounding invariants (D23)', () => {
  it('sum(7 payable) == sal_for_calc exactly (EDUCATION absorbs remainder)', () => {
    // Gross 38201 produces non-exact components when split by 50/20/15/7/5/2/1
    const s = baseSnapshot({ gross: 38201 });
    const r = calculate(s);
    const sum =
      r.basic_payable +
      r.hra_payable +
      r.sp_allow_payable +
      r.conveyance_payable +
      r.ltc_payable +
      r.re_medical_payable +
      r.education_payable;
    expect(Math.abs(sum - r.sal_for_calc)).toBeLessThanOrEqual(0.01);
  });

  it('sum(7 actual) == gross exactly (EDUCATION absorbs remainder)', () => {
    const s = baseSnapshot({ gross: 12345.67 });
    const r = calculate(s);
    const sum =
      r.basic_actual +
      r.hra_actual +
      r.sp_allow_actual +
      r.conveyance_actual +
      r.ltc_actual +
      r.re_medical_actual +
      r.education_actual;
    expect(Math.abs(sum - 12345.67)).toBeLessThanOrEqual(0.01);
  });
});

describe('payroll.engine — Invariants', () => {
  it('net_payable is never negative', () => {
    const s = baseSnapshot({
      lwp_days: 25,
      tds: 10000,
      loan_emi: 5000,
      incentive: 0,
    });
    const r = calculate(s);
    expect(r.net_payable).toBeGreaterThanOrEqual(0);
  });

  it('total_earnings - total_deductions == net_payable (unless clamped)', () => {
    const s = baseSnapshot();
    const r = calculate(s);
    expect(r.net_payable).toBe(
      Math.max(0, Math.round((r.total_earnings - r.total_deductions) * 100) / 100),
    );
  });
});

describe('validateComponents', () => {
  it('accepts the canonical 7-row seed', () => {
    expect(validateComponents(DEFAULT_COMPONENTS)).toEqual([]);
  });

  it('rejects when sum != 100', () => {
    const bad = DEFAULT_COMPONENTS.map((c) =>
      c.code === 'BASIC' ? { ...c, percentage: 60 } : c,
    );
    const errs = validateComponents(bad);
    expect(errs.some((e) => e.includes('sum'))).toBe(true);
  });

  it('rejects when no component is is_pf_base', () => {
    const bad = DEFAULT_COMPONENTS.map((c) => ({ ...c, is_pf_base: false }));
    expect(validateComponents(bad).some((e) => e.includes('is_pf_base'))).toBe(
      true,
    );
  });

  it('rejects when two components are is_pf_base', () => {
    const bad = DEFAULT_COMPONENTS.map((c) =>
      c.code === 'HRA' ? { ...c, is_pf_base: true } : c,
    );
    expect(validateComponents(bad).some((e) => e.includes('is_pf_base'))).toBe(
      true,
    );
  });

  it('rejects when BASIC is missing', () => {
    const bad = DEFAULT_COMPONENTS.filter((c) => c.code !== 'BASIC');
    expect(validateComponents(bad).some((e) => e.includes('BASIC'))).toBe(true);
  });
});
