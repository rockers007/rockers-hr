import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PayrollRun } from '../entities/payroll-run.entity';

export interface SalaryRegisterRow {
  emp_number: string | null;
  name: string;
  department: string | null;
  designation: string | null;
  gross: string;
  sal_for_calc: string;
  basic: string;
  hra: string;
  sp_allowances: string;
  conveyance: string;
  ltc: string;
  re_medical: string;
  education: string;
  fix_variable: string;
  ot_pay: string;
  security_return: string;
  employee_pf: string;
  employer_pf: string;
  professional_tax: string;
  tds: string;
  loan_emi: string;
  sal_deduction: string;
  total_earnings: string;
  total_deductions: string;
  net_payable: string;
  ctc: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
    private readonly dataSource: DataSource,
  ) {}

  async salaryRegister(
    year: number,
    month: number,
  ): Promise<{
    run: { id: string; month: number; year: number; state: string };
    rows: SalaryRegisterRow[];
    totals: SalaryRegisterRow;
  }> {
    const run = await this.findReleasedOrLatest(year, month);
    const rows: SalaryRegisterRow[] = await this.dataSource.query(
      `SELECT
         u.emp_number,
         u.name,
         md.label AS department,
         u.designation,
         pi.sal_for_calc + pi.lwp_deduction AS gross,
         pi.sal_for_calc,
         pi.basic_payable AS basic,
         pi.hra_payable AS hra,
         pi.sp_allow_payable AS sp_allowances,
         pi.conveyance_payable AS conveyance,
         pi.ltc_payable AS ltc,
         pi.re_medical_payable AS re_medical,
         pi.education_payable AS education,
         pi.fix_variable,
         pi.ot_pay,
         pi.security_return,
         pi.employee_pf,
         pi.employer_pf,
         pi.professional_tax,
         pi.tds,
         pi.loan_emi,
         pi.sal_deduction,
         pi.total_earnings,
         pi.total_deductions,
         pi.net_payable,
         pi.ctc
       FROM payroll_items pi
       JOIN users u ON u.id = pi.user_id
       LEFT JOIN master_departments md ON md.id = u.department_id
       WHERE pi.run_id = $1 AND pi.is_current = TRUE
       ORDER BY u.name ASC`,
      [run.id],
    );

    return {
      run: { id: run.id, month: run.month, year: run.year, state: run.state },
      rows,
      totals: this.sumRows(rows),
    };
  }

  async departmentCost(
    year: number,
    month: number,
    departmentId?: string,
  ): Promise<Array<{
    department_id: string | null;
    department: string | null;
    headcount: number;
    total_gross: string;
    total_ctc: string;
    total_net_payable: string;
    total_deductions: string;
  }>> {
    const run = await this.findReleasedOrLatest(year, month);
    const params: Array<string | null> = [run.id];
    let where = 'pi.run_id = $1 AND pi.is_current = TRUE';
    if (departmentId) {
      params.push(departmentId);
      where += ' AND u.department_id = $2';
    }
    return this.dataSource.query(
      `SELECT
         u.department_id,
         md.label AS department,
         COUNT(*)::int AS headcount,
         COALESCE(SUM(pi.sal_for_calc + pi.lwp_deduction), 0) AS total_gross,
         COALESCE(SUM(pi.ctc), 0) AS total_ctc,
         COALESCE(SUM(pi.net_payable), 0) AS total_net_payable,
         COALESCE(SUM(pi.total_deductions), 0) AS total_deductions
       FROM payroll_items pi
       JOIN users u ON u.id = pi.user_id
       LEFT JOIN master_departments md ON md.id = u.department_id
       WHERE ${where}
       GROUP BY u.department_id, md.label
       ORDER BY md.label ASC NULLS LAST`,
      params,
    );
  }

  async payrollSummary(
    year: number,
    period: 'monthly' | 'quarterly' | 'yearly',
  ) {
    const grouping =
      period === 'yearly'
        ? `'${year}'`
        : period === 'quarterly'
        ? `'Q' || ((pr.month - 1) / 3 + 1)`
        : `LPAD(pr.month::text, 2, '0')`;

    return this.dataSource.query(
      `SELECT
         ${grouping} AS period,
         COUNT(DISTINCT pr.id)::int AS runs,
         SUM(pr.total_employees)::int AS employees,
         COALESCE(SUM(pr.total_net_payable), 0) AS total_net_payable,
         COALESCE(SUM(pr.total_employer_pf), 0) AS total_employer_pf,
         COALESCE(SUM(pr.total_employee_pf), 0) AS total_employee_pf,
         COALESCE(SUM(pr.total_pt), 0) AS total_pt,
         COALESCE(SUM(pr.total_tds), 0) AS total_tds,
         COALESCE(SUM(pr.total_incentive), 0) AS total_incentive,
         COALESCE(SUM(pr.total_ot_pay), 0) AS total_ot_pay
       FROM payroll_runs pr
       WHERE pr.year = $1
         AND pr.state IN ('RELEASED','BANK_FILE_APPROVED','BANK_FILE_GENERATED')
       GROUP BY period
       ORDER BY period ASC`,
      [year],
    );
  }

  async compliance(year: number, month: number) {
    const run = await this.findReleasedOrLatest(year, month);
    const [totals] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(employer_pf), 0) AS total_employer_pf,
         COALESCE(SUM(employee_pf), 0) AS total_employee_pf,
         COALESCE(SUM(CASE WHEN esic_applied THEN employer_esic ELSE 0 END), 0) AS total_employer_esic,
         COALESCE(SUM(CASE WHEN esic_applied THEN employee_esic ELSE 0 END), 0) AS total_employee_esic,
         COALESCE(SUM(professional_tax), 0) AS total_pt,
         COALESCE(SUM(tds), 0) AS total_tds,
         COUNT(*)::int AS employee_count
       FROM payroll_items
       WHERE run_id = $1 AND is_current = TRUE`,
      [run.id],
    );
    return {
      run: { id: run.id, month: run.month, year: run.year, state: run.state },
      ...totals,
    };
  }

  async renderCsv(headers: string[], rows: Record<string, unknown>[]): Promise<string> {
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const out: string[] = [headers.join(',')];
    for (const row of rows) {
      out.push(headers.map((h) => escape(row[h])).join(','));
    }
    return out.join('\n');
  }

  private async findReleasedOrLatest(
    year: number,
    month: number,
  ): Promise<PayrollRun> {
    const run = await this.runRepo
      .createQueryBuilder('r')
      .where('r.year = :y AND r.month = :m', { y: year, m: month })
      .andWhere(`r.state IN ('REVIEW','LOCKED','RELEASED','BANK_FILE_APPROVED','BANK_FILE_GENERATED')`)
      .orderBy(`CASE r.state
        WHEN 'BANK_FILE_GENERATED' THEN 1
        WHEN 'BANK_FILE_APPROVED' THEN 2
        WHEN 'RELEASED' THEN 3
        WHEN 'LOCKED' THEN 4
        WHEN 'REVIEW' THEN 5 END`)
      .getOne();
    if (!run) {
      throw new NotFoundException(
        `No report-ready payroll run for ${month}/${year}`,
      );
    }
    return run;
  }

  private sumRows(rows: SalaryRegisterRow[]): SalaryRegisterRow {
    const add = (key: keyof SalaryRegisterRow) =>
      rows
        .reduce((acc, r) => acc + Number((r as unknown as Record<string, string>)[key as string] ?? 0), 0)
        .toFixed(2);
    return {
      emp_number: null,
      name: 'TOTAL',
      department: null,
      designation: null,
      gross: add('gross'),
      sal_for_calc: add('sal_for_calc'),
      basic: add('basic'),
      hra: add('hra'),
      sp_allowances: add('sp_allowances'),
      conveyance: add('conveyance'),
      ltc: add('ltc'),
      re_medical: add('re_medical'),
      education: add('education'),
      fix_variable: add('fix_variable'),
      ot_pay: add('ot_pay'),
      security_return: add('security_return'),
      employee_pf: add('employee_pf'),
      employer_pf: add('employer_pf'),
      professional_tax: add('professional_tax'),
      tds: add('tds'),
      loan_emi: add('loan_emi'),
      sal_deduction: add('sal_deduction'),
      total_earnings: add('total_earnings'),
      total_deductions: add('total_deductions'),
      net_payable: add('net_payable'),
      ctc: add('ctc'),
    };
  }
}
