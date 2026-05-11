/**
 * Types for the payroll calculation engine.
 * See planning/PAYROLL_CALCULATION_ENGINE.md for the canonical spec.
 */

export interface SnapshotStatutory {
  pf_cap_amount: number;
  pf_fixed_at_cap: number;
  pf_rate_below_cap: number;
  pf_employer_matches_employee: boolean;
  esic_active: boolean;
  esic_threshold_gross: number;
  esic_employer_rate: number;
  esic_employee_rate: number;
  pt_flat_amount: number;
  ot_multiplier: number;
  ot_divisor_day: number;
  ot_divisor_hour: number;
  payroll_cycle_days: number;
}

export type ComponentCode =
  | 'BASIC'
  | 'HRA'
  | 'SP_ALLOW'
  | 'CONVEYANCE'
  | 'LTC'
  | 'RE_MEDICAL'
  | 'EDUCATION';

export interface SnapshotComponent {
  code: ComponentCode;
  percentage: number;
  is_pf_base: boolean;
  display_order: number;
  payslip_label: string;
}

export interface PayrollSnapshot {
  user_id: string;
  gross: number;
  incentive: number;
  tds: number;
  loan_emi: number;
  sal_deduction: number;
  security_return: number;
  pf_applicable: boolean;
  // Per-employee ESIC gate. Engine applies ESIC only when this AND
  // statutory.esic_active are both true (and gross is below the
  // threshold). Optional for back-compat — engine defaults missing
  // values to true so older snapshots and tests behave as they did
  // before this flag existed.
  esic_applicable?: boolean;

  lwp_days: number;
  ot_hours: number;

  components: SnapshotComponent[];
  statutory: SnapshotStatutory;
}

export interface ComponentAmount {
  actual: number;
  payable: number;
}

export interface PayrollComputation {
  user_id: string;
  lwp_deduction: number;
  sal_for_calc: number;

  basic_actual: number;
  basic_payable: number;
  hra_actual: number;
  hra_payable: number;
  sp_allow_actual: number;
  sp_allow_payable: number;
  conveyance_actual: number;
  conveyance_payable: number;
  ltc_actual: number;
  ltc_payable: number;
  re_medical_actual: number;
  re_medical_payable: number;
  education_actual: number;
  education_payable: number;

  fix_variable: number;
  ot_per_hour: number;
  ot_rate: number;
  ot_pay: number;
  security_return: number;

  employee_pf: number;
  employer_pf: number;
  employee_esic: number;
  employer_esic: number;
  esic_applied: boolean;

  professional_tax: number;
  tds: number;
  loan_emi: number;
  sal_deduction: number;

  total_earnings: number;
  total_deductions: number;
  net_payable: number;
  ctc: number;
  ctc_as_per_it: number;

  present_days: number;
  warnings: string[];
}
