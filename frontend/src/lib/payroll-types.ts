export type PayrollRunState =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'LOCKED'
  | 'RELEASED'
  | 'BANK_FILE_APPROVED'
  | 'BANK_FILE_GENERATED'
  | 'CANCELLED';

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  payroll_cycle_days: number;
  state: PayrollRunState;
  total_employees: number;
  total_net_payable: string;
  total_employer_pf: string;
  total_employee_pf: string;
  total_pt: string;
  total_tds: string;
  total_incentive: string;
  total_ot_pay: string;
  release_date: string | null;
  imported_at: string | null;
  calculated_at: string | null;
  locked_at: string | null;
  released_at: string | null;
  created_by: string;
  created_at: string;
}

export interface PayrollSalaryComponent {
  id: string;
  code: string;
  display_name: string;
  payslip_label: string;
  percentage: string;
  display_order: number;
  is_pf_base: boolean;
  is_active: boolean;
}

export interface PayrollStatutoryConfig {
  id: string;
  profile_name: string;
  pf_cap_amount: string;
  pf_fixed_at_cap: string;
  pf_rate_below_cap: string;
  pf_employer_matches_employee: boolean;
  esic_active: boolean;
  esic_threshold_gross: string;
  esic_employer_rate: string;
  esic_employee_rate: string;
  pt_flat_amount: string;
  ot_multiplier: string;
  ot_divisor_day: string;
  ot_divisor_hour: string;
  payroll_cycle_days: number;
  financial_year_start_month: number;
  currency: string;
  effective_from: string;
  is_active: boolean;
}

export interface PayrollItem {
  id: string;
  run_id: string;
  user_id: string;
  user_name?: string;
  emp_number?: string | null;
  designation?: string | null;
  lwp_deduction: string;
  sal_for_calc: string;
  basic_actual: string;
  basic_payable: string;
  hra_actual: string;
  hra_payable: string;
  sp_allow_actual: string;
  sp_allow_payable: string;
  conveyance_actual: string;
  conveyance_payable: string;
  ltc_actual: string;
  ltc_payable: string;
  re_medical_actual: string;
  re_medical_payable: string;
  education_actual: string;
  education_payable: string;
  fix_variable: string;
  ot_per_hour: string;
  ot_rate: string;
  ot_pay: string;
  security_return: string;
  employee_pf: string;
  employer_pf: string;
  employee_esic: string;
  employer_esic: string;
  esic_applied: boolean;
  professional_tax: string;
  tds: string;
  loan_emi: string;
  sal_deduction: string;
  total_earnings: string;
  total_deductions: string;
  net_payable: string;
  ctc: string;
  ctc_as_per_it: string;
  is_current: boolean;
  calculation_version: number;
  computed_at: string;
}

export interface PayrollSalary {
  user_id: string;
  emp_number?: string | null;
  name?: string;
  designation?: string | null;
  gross: string;
  incentive: string;
  tds: string;
  loan_emi: string;
  sal_deduction: string;
  security_return: string;
  pf_applicable: boolean;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  dob: string | null;
  computed_preview?: {
    gross: string;
    sal_for_calc: string;
    total_earnings: string;
    total_deductions: string;
    estimated_net_payable: string;
    ctc: string;
    ctc_as_per_it: string;
    employee_pf: string;
    professional_tax: string;
  };
}

export interface BankChangeRequest {
  id: string;
  user_id: string;
  current_bank_name: string | null;
  current_account_no: string | null;
  current_ifsc: string | null;
  new_bank_name: string;
  new_account_no: string;
  new_ifsc: string;
  proof_s3_key: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatINR(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(n);
}

export function stateLabel(s: PayrollRunState): { label: string; color: string } {
  switch (s) {
    case 'DRAFT': return { label: 'Draft', color: 'bg-gray-100 text-gray-700' };
    case 'IN_PROGRESS': return { label: 'In Progress', color: 'bg-blue-100 text-blue-700' };
    case 'REVIEW': return { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800' };
    case 'LOCKED': return { label: 'Locked', color: 'bg-orange-100 text-orange-800' };
    case 'RELEASED': return { label: 'Released', color: 'bg-green-100 text-green-700' };
    case 'BANK_FILE_APPROVED': return { label: 'Bank File Approved', color: 'bg-teal-100 text-teal-700' };
    case 'BANK_FILE_GENERATED': return { label: 'Bank File Ready', color: 'bg-purple-100 text-purple-700' };
    case 'CANCELLED': return { label: 'Cancelled', color: 'bg-red-100 text-red-700' };
  }
}
