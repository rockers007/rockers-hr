import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollSalaryComponent } from '../entities/payroll-salary-component.entity';
import { PayrollStatutoryConfig } from '../entities/payroll-statutory-config.entity';
import { calculate } from '../engine/payroll.engine';
import { buildSnapshot } from '../engine/payroll-engine.helpers';
import { PayrollAuditService } from '../common/payroll-audit.service';

export interface SalaryPatch {
  gross?: number;
  incentive?: number;
  tds?: number;
  loan_emi?: number;
  sal_deduction?: number;
  security_return?: number;
  pf_applicable?: boolean;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  dob?: string;
  emp_number?: string;
  designation?: string;
}

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
    @InjectRepository(PayrollSalaryComponent)
    private readonly componentRepo: Repository<PayrollSalaryComponent>,
    @InjectRepository(PayrollStatutoryConfig)
    private readonly statutoryRepo: Repository<PayrollStatutoryConfig>,
    private readonly audit: PayrollAuditService,
  ) {}

  async getSalary(userId: string, includePreview = true) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const base = {
      user_id: user.id,
      emp_number: user.emp_number,
      name: user.name,
      designation: user.designation,
      gross: user.gross,
      incentive: user.incentive,
      tds: user.tds,
      loan_emi: user.loan_emi,
      sal_deduction: user.sal_deduction,
      security_return: user.security_return,
      pf_applicable: user.pf_applicable,
      bank_name: user.bank_name,
      bank_account_no: user.bank_account_no,
      bank_ifsc: user.bank_ifsc,
      dob: user.dob,
    };

    if (!includePreview) return base;

    const preview = await this.previewComputation(user);
    return { ...base, computed_preview: preview };
  }

  async patchSalary(
    userId: string,
    patch: SalaryPatch,
    actorId: string,
  ): Promise<void> {
    // Guard: cannot edit while an active run exists for current month
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const blocking = await this.runRepo
      .createQueryBuilder('r')
      .where('r.month = :m AND r.year = :y', { m: month, y: year })
      .andWhere(`r.state IN ('IN_PROGRESS','REVIEW')`)
      .getOne();
    if (blocking) {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Cannot edit salary while run ${month}/${year} is ${blocking.state}`,
      });
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const before: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      before[k] = (user as unknown as Record<string, unknown>)[k];
      (user as unknown as Record<string, unknown>)[k] = v;
    }
    await this.userRepo.save(user);

    await this.audit.log({
      actorId,
      action: 'payroll.salary.config_updated',
      entityType: 'users',
      entityId: userId,
      before,
      after: patch,
    });
  }

  /**
   * Runs the engine with lwp=0 and ot=0 to show a what-if preview —
   * used on the employee portal (§10.1b) and admin salary edit screen (§2.1).
   *
   * The output mirrors the per-component shape that payroll runs show
   * in their tabular detail view, so the same row layout can be reused
   * on the admin salary-config page (right panel) and the employee
   * salary-breakdown page. `earnings` and `deductions` are arrays of
   * { code, label, amount } so the frontend can render the table
   * generically; `totals` carries the grand totals.
   */
  async previewComputation(user: User): Promise<{
    gross: string;
    sal_for_calc: string;
    total_earnings: string;
    total_deductions: string;
    estimated_net_payable: string;
    ctc: string;
    ctc_as_per_it: string;
    employee_pf: string;
    professional_tax: string;
    earnings: Array<{ code: string; label: string; amount: string; is_pf_base: boolean }>;
    deductions: Array<{ code: string; label: string; amount: string }>;
  }> {
    const components = await this.componentRepo.find({
      where: { is_active: true },
      order: { display_order: 'ASC' },
    });
    const statutory = await this.statutoryRepo.findOne({
      where: { is_active: true },
    });

    // Preview requires (a) active statutory row, (b) at least the 7 canonical
    // codes, and (c) percentages that sum to 100 with one pf_base. If any
    // invariant is broken, return zeros (engine would produce nonsense).
    const REQUIRED = [
      'BASIC', 'HRA', 'SP_ALLOW', 'CONVEYANCE', 'LTC', 'RE_MEDICAL', 'EDUCATION',
    ];
    const haveAll = REQUIRED.every((code) =>
      components.some((c) => c.code === code),
    );
    const pctSum = components.reduce((acc, c) => acc + Number(c.percentage), 0);
    const pfBases = components.filter((c) => c.is_pf_base).length;
    const invariantsOk =
      !!statutory &&
      haveAll &&
      Math.abs(pctSum - 100) < 0.01 &&
      pfBases === 1;

    if (!statutory || !invariantsOk) {
      return {
        gross: user.gross,
        sal_for_calc: user.gross,
        total_earnings: '0',
        total_deductions: '0',
        estimated_net_payable: '0',
        ctc: '0',
        ctc_as_per_it: '0',
        employee_pf: '0',
        professional_tax: '0',
        earnings: [],
        deductions: [],
      };
    }

    const snap = buildSnapshot({
      user_id: user.id,
      gross: user.gross,
      incentive: user.incentive,
      tds: user.tds,
      loan_emi: user.loan_emi,
      sal_deduction: user.sal_deduction,
      security_return: user.security_return,
      pf_applicable: user.pf_applicable,
      lwp_days: 0,
      ot_hours: 0,
      components: components.map((c) => ({
        code: c.code as 'BASIC',
        percentage: Number(c.percentage),
        is_pf_base: c.is_pf_base,
        display_order: c.display_order,
        payslip_label: c.payslip_label,
      })),
      statutory: {
        pf_cap_amount: Number(statutory.pf_cap_amount),
        pf_fixed_at_cap: Number(statutory.pf_fixed_at_cap),
        pf_rate_below_cap: Number(statutory.pf_rate_below_cap),
        pf_employer_matches_employee: statutory.pf_employer_matches_employee,
        esic_active: statutory.esic_active,
        esic_threshold_gross: Number(statutory.esic_threshold_gross),
        esic_employer_rate: Number(statutory.esic_employer_rate),
        esic_employee_rate: Number(statutory.esic_employee_rate),
        pt_flat_amount: Number(statutory.pt_flat_amount),
        ot_multiplier: Number(statutory.ot_multiplier),
        ot_divisor_day: Number(statutory.ot_divisor_day),
        ot_divisor_hour: Number(statutory.ot_divisor_hour),
        payroll_cycle_days: statutory.payroll_cycle_days,
      },
    });
    const out = calculate(snap);

    // Build the per-component earnings array using the engine output
    // and the master payslip labels. Using the master `components`
    // sort order keeps payslip and breakdown views identical.
    const componentMap: Record<
      string,
      { code: string; payable: number; isPfBase: boolean }
    > = {
      BASIC: { code: 'BASIC', payable: out.basic_payable, isPfBase: false },
      HRA: { code: 'HRA', payable: out.hra_payable, isPfBase: false },
      SP_ALLOW: { code: 'SP_ALLOW', payable: out.sp_allow_payable, isPfBase: false },
      CONVEYANCE: { code: 'CONVEYANCE', payable: out.conveyance_payable, isPfBase: false },
      LTC: { code: 'LTC', payable: out.ltc_payable, isPfBase: false },
      RE_MEDICAL: { code: 'RE_MEDICAL', payable: out.re_medical_payable, isPfBase: false },
      EDUCATION: { code: 'EDUCATION', payable: out.education_payable, isPfBase: false },
    };
    // Fold in the master `is_pf_base` flag so the UI can mark which
    // component PF is computed off.
    for (const c of components) {
      if (componentMap[c.code]) componentMap[c.code].isPfBase = !!c.is_pf_base;
    }

    const earnings: Array<{
      code: string;
      label: string;
      amount: string;
      is_pf_base: boolean;
    }> = components
      .filter((c) => !!componentMap[c.code])
      .map((c) => ({
        code: c.code,
        label: c.payslip_label || c.code,
        amount: componentMap[c.code].payable.toFixed(2),
        is_pf_base: !!c.is_pf_base,
      }));

    // Incentive / fix-variable is paid alongside structured components
    // — surface it on the same table so the row order matches the
    // payslip.
    if (Number(user.incentive) > 0) {
      earnings.push({
        code: 'INCENTIVE',
        label: 'Incentive / Fix Variable',
        amount: Number(user.incentive).toFixed(2),
        is_pf_base: false,
      });
    }

    // Deductions, in the canonical payslip order.
    const deductions: Array<{ code: string; label: string; amount: string }> = [];
    if (out.employee_pf > 0)
      deductions.push({
        code: 'EMPLOYEE_PF',
        label: 'Employee PF',
        amount: out.employee_pf.toFixed(2),
      });
    if (out.employee_esic > 0)
      deductions.push({
        code: 'EMPLOYEE_ESIC',
        label: 'Employee ESIC',
        amount: out.employee_esic.toFixed(2),
      });
    if (out.professional_tax > 0)
      deductions.push({
        code: 'PT',
        label: 'Professional Tax',
        amount: out.professional_tax.toFixed(2),
      });
    if (Number(user.tds) > 0)
      deductions.push({
        code: 'TDS',
        label: 'TDS',
        amount: Number(user.tds).toFixed(2),
      });
    if (Number(user.loan_emi) > 0)
      deductions.push({
        code: 'LOAN_EMI',
        label: 'Loan EMI',
        amount: Number(user.loan_emi).toFixed(2),
      });
    if (Number(user.sal_deduction) > 0)
      deductions.push({
        code: 'SAL_DEDUCTION',
        label: 'Salary Deduction',
        amount: Number(user.sal_deduction).toFixed(2),
      });

    return {
      gross: String(snap.gross.toFixed(2)),
      sal_for_calc: String(out.sal_for_calc.toFixed(2)),
      total_earnings: String(out.total_earnings.toFixed(2)),
      total_deductions: String(out.total_deductions.toFixed(2)),
      estimated_net_payable: String(out.net_payable.toFixed(2)),
      ctc: String(out.ctc.toFixed(2)),
      ctc_as_per_it: String(out.ctc_as_per_it.toFixed(2)),
      employee_pf: String(out.employee_pf.toFixed(2)),
      professional_tax: String(out.professional_tax.toFixed(2)),
      earnings,
      deductions,
    };
  }
}
