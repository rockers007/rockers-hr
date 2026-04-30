import {
  PayrollSnapshot,
  SnapshotComponent,
  SnapshotStatutory,
} from './payroll-engine.types';

/**
 * Helpers for constructing and validating engine inputs from DB rows.
 */

export function num(s: string | number | null | undefined): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return s;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function validateComponents(components: SnapshotComponent[]): string[] {
  const errors: string[] = [];
  const required: SnapshotComponent['code'][] = [
    'BASIC',
    'HRA',
    'SP_ALLOW',
    'CONVEYANCE',
    'LTC',
    'RE_MEDICAL',
    'EDUCATION',
  ];
  for (const code of required) {
    if (!components.some((c) => c.code === code)) {
      errors.push(`Missing component ${code}`);
    }
  }

  const sum = components.reduce((acc, c) => acc + c.percentage, 0);
  if (Math.abs(sum - 100) > 0.01) {
    errors.push(`Components sum to ${sum.toFixed(2)}, must be 100.00`);
  }

  const pfBase = components.filter((c) => c.is_pf_base);
  if (pfBase.length !== 1) {
    errors.push(
      `Exactly one component must be is_pf_base, found ${pfBase.length}`,
    );
  }

  return errors;
}

export function buildSnapshot(params: {
  user_id: string;
  gross: number | string;
  incentive: number | string;
  tds: number | string;
  loan_emi: number | string;
  sal_deduction: number | string;
  security_return: number | string;
  pf_applicable: boolean;
  // Optional for back-compat with existing callers/tests that pre-date
  // the per-employee ESIC gate. Defaults to TRUE so older code keeps
  // its previous behavior — ESIC then turns purely on
  // statutory.esic_active + gross threshold, exactly as before.
  esic_applicable?: boolean;
  lwp_days: number | string;
  ot_hours: number | string;
  components: SnapshotComponent[];
  statutory: SnapshotStatutory;
}): PayrollSnapshot {
  return {
    user_id: params.user_id,
    gross: num(params.gross),
    incentive: num(params.incentive),
    tds: num(params.tds),
    loan_emi: num(params.loan_emi),
    sal_deduction: num(params.sal_deduction),
    security_return: num(params.security_return),
    pf_applicable: params.pf_applicable,
    esic_applicable: params.esic_applicable ?? true,
    lwp_days: num(params.lwp_days),
    ot_hours: num(params.ot_hours),
    components: params.components,
    statutory: params.statutory,
  };
}
