import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PayrollRun, PayrollRunState } from '../entities/payroll-run.entity';
import {
  PayrollRunEmployee,
  SnapshotComponent,
  SnapshotStatutory,
} from '../entities/payroll-run-employee.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollSalaryComponent } from '../entities/payroll-salary-component.entity';
import { PayrollStatutoryConfig } from '../entities/payroll-statutory-config.entity';
import { User } from '../../users/entities/user.entity';
import { calculate } from '../engine/payroll.engine';
import {
  buildSnapshot,
  num,
} from '../engine/payroll-engine.helpers';
import { PayrollAuditService } from '../common/payroll-audit.service';

type CountRow = { count: string };

const EDITABLE_FIELDS_IN_REVIEW = [
  'snapshot_incentive',
  'snapshot_tds',
  'snapshot_loan_emi',
  'snapshot_sal_deduction',
  'snapshot_security_return',
] as const;

const EDITABLE_SNAPSHOT_COUNTERS = [
  'lwp_days',
  'ot_hours',
  'cl_days',
  'sl_days',
  'pl_days',
  'wfh_days',
  'comp_off_days',
] as const;

@Injectable()
export class RunsService {
  constructor(
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
    @InjectRepository(PayrollRunEmployee)
    private readonly preRepo: Repository<PayrollRunEmployee>,
    @InjectRepository(PayrollItem)
    private readonly itemRepo: Repository<PayrollItem>,
    @InjectRepository(PayrollSalaryComponent)
    private readonly componentRepo: Repository<PayrollSalaryComponent>,
    @InjectRepository(PayrollStatutoryConfig)
    private readonly statutoryRepo: Repository<PayrollStatutoryConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly audit: PayrollAuditService,
  ) {}

  // ==========================================================================
  // Step 1 — Select Month (create run)
  // ==========================================================================
  async create(month: number, year: number, actorId: string): Promise<PayrollRun> {
    if (month < 1 || month > 12) {
      throw new BadRequestException('month must be 1..12');
    }
    if (year < 2024 || year > 2100) {
      throw new BadRequestException('year out of range');
    }

    // Uniqueness: one non-cancelled run per (month, year)
    const existing = await this.runRepo
      .createQueryBuilder('r')
      .where('r.month = :m AND r.year = :y', { m: month, y: year })
      .andWhere(`r.state <> 'CANCELLED'`)
      .getOne();
    if (existing) {
      throw new ConflictException({
        code: 'PR_RUN_ALREADY_EXISTS',
        message: `A payroll run for ${month}/${year} already exists (${existing.state})`,
      });
    }

    const activeEmployees = await this.userRepo.count({
      where: { is_active: true },
    });
    if (activeEmployees === 0) {
      throw new UnprocessableEntityException({
        code: 'PR_NO_ACTIVE_EMPLOYEES',
        message: 'No active employees to snapshot',
      });
    }

    const run = this.runRepo.create({
      month,
      year,
      state: 'DRAFT' as PayrollRunState,
      total_employees: activeEmployees,
      created_by: actorId,
      payroll_cycle_days: 30,
    });
    const saved = await this.runRepo.save(run);

    await this.audit.log({
      actorId,
      action: 'payroll.run.created',
      entityType: 'payroll_runs',
      entityId: saved.id,
      after: { month, year, employee_count: activeEmployees },
    });

    return saved;
  }

  // ==========================================================================
  // Step 2 — Import attendance & leaves + snapshot salary structure
  // ==========================================================================
  async importRun(runId: string, actorId: string): Promise<PayrollRun> {
    const run = await this.mustGetRun(runId);
    if (run.state !== 'DRAFT' && run.state !== 'IN_PROGRESS') {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Cannot import in state ${run.state}`,
      });
    }

    const components = await this.componentRepo.find({
      where: { is_active: true },
      order: { display_order: 'ASC' },
    });
    const statutory = await this.statutoryRepo.findOne({
      where: { is_active: true },
    });
    if (!statutory) {
      throw new UnprocessableEntityException({
        code: 'PR_STATUTORY_MISSING',
        message: 'No active statutory config — run seed first',
      });
    }

    const snapshotComponents: SnapshotComponent[] = components.map((c) => ({
      code: c.code as SnapshotComponent['code'],
      percentage: Number(c.percentage),
      is_pf_base: c.is_pf_base,
      display_order: c.display_order,
      payslip_label: c.payslip_label,
    }));

    const snapshotStatutory: SnapshotStatutory = {
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
    };

    const monthStart = `${run.year}-${String(run.month).padStart(2, '0')}-01`;
    const monthEnd = this.monthEndStr(run.year, run.month);

    await this.dataSource.transaction(async (m) => {
      // Reset existing snapshot rows (re-import semantics)
      await m.query(
        `DELETE FROM payroll_run_employees WHERE run_id = $1`,
        [runId],
      );

      // Iterate over active employees. Do one INSERT per employee so leave
      // aggregates stay readable; count is modest (<500 for a typical org).
      const employees = await m.query(
        `SELECT id, gross, incentive, tds, loan_emi, sal_deduction,
                security_return, pf_applicable
         FROM users WHERE is_active = TRUE`,
      );

      const leaveAggQuery = `
        SELECT
          COALESCE(SUM(CASE WHEN mlt.system_key = 'LWP'      THEN lr.working_days END), 0) AS lwp_days,
          COALESCE(SUM(CASE WHEN mlt.system_key = 'CL'       THEN lr.working_days END), 0) AS cl_days,
          COALESCE(SUM(CASE WHEN mlt.system_key = 'SL'       THEN lr.working_days END), 0) AS sl_days,
          COALESCE(SUM(CASE WHEN mlt.system_key = 'PL'       THEN lr.working_days END), 0) AS pl_days,
          COALESCE(SUM(CASE WHEN mlt.system_key = 'WFH'      THEN lr.working_days END), 0) AS wfh_days,
          COALESCE(SUM(CASE WHEN mlt.system_key = 'COMP_OFF' THEN lr.working_days END), 0) AS comp_off_days,
          COALESCE(SUM(CASE WHEN mlt.system_key = 'EARLY'    THEN lr.early_leave_hours END), 0) AS el_hours
        FROM leave_requests lr
        JOIN master_leave_types mlt ON mlt.id = lr.leave_type_id
        WHERE lr.user_id = $1
          AND lr.status = 'APPROVED'
          AND (
            (lr.start_date BETWEEN $2 AND $3) OR
            (lr.early_leave_date BETWEEN $2 AND $3)
          )
      `;

      const otAggQuery = `
        SELECT COALESCE(SUM(hours), 0) AS ot_hours
        FROM overtime_requests
        WHERE user_id = $1 AND status = 'approved'
          AND date BETWEEN $2 AND $3
      `;

      for (const emp of employees) {
        let leaveAgg: Record<string, string> = {
          lwp_days: '0',
          cl_days: '0',
          sl_days: '0',
          pl_days: '0',
          wfh_days: '0',
          comp_off_days: '0',
          el_hours: '0',
        };
        try {
          const [res] = await m.query(leaveAggQuery, [emp.id, monthStart, monthEnd]);
          if (res) leaveAgg = res;
        } catch {
          // Leave module schema differences — default to zero; D24 / Q15 graceful
        }

        let otHours = '0';
        try {
          const [otRes] = await m.query(otAggQuery, [emp.id, monthStart, monthEnd]);
          if (otRes?.ot_hours) otHours = otRes.ot_hours;
        } catch {
          // overtime_requests absent — default 0
        }

        const cappedLwp = Math.min(
          num(leaveAgg.lwp_days),
          snapshotStatutory.payroll_cycle_days,
        );
        const presentDays = snapshotStatutory.payroll_cycle_days - cappedLwp;

        await m.query(
          `INSERT INTO payroll_run_employees (
            run_id, user_id,
            snapshot_gross, snapshot_incentive, snapshot_tds,
            snapshot_loan_emi, snapshot_sal_deduction, snapshot_security_return,
            snapshot_pf_applicable, snapshot_components, snapshot_statutory,
            lwp_days, cl_days, sl_days, pl_days, wfh_days, comp_off_days,
            el_hours, ot_hours, present_days
          ) VALUES (
            $1, $2,
            $3, $4, $5,
            $6, $7, $8,
            $9, $10::jsonb, $11::jsonb,
            $12, $13, $14, $15, $16, $17,
            $18, $19, $20
          )`,
          [
            runId,
            emp.id,
            emp.gross,
            emp.incentive,
            emp.tds,
            emp.loan_emi,
            emp.sal_deduction,
            emp.security_return,
            emp.pf_applicable,
            JSON.stringify(snapshotComponents),
            JSON.stringify(snapshotStatutory),
            cappedLwp,
            leaveAgg.cl_days,
            leaveAgg.sl_days,
            leaveAgg.pl_days,
            leaveAgg.wfh_days,
            leaveAgg.comp_off_days,
            leaveAgg.el_hours,
            otHours,
            presentDays,
          ],
        );
      }

      await m.query(
        `UPDATE payroll_runs
          SET state = 'IN_PROGRESS', imported_at = now(), total_employees = (
            SELECT COUNT(*) FROM payroll_run_employees WHERE run_id = $1
          )
          WHERE id = $1`,
        [runId],
      );
    });

    const updated = await this.mustGetRun(runId);
    await this.audit.log({
      actorId,
      action: 'payroll.run.imported',
      entityType: 'payroll_runs',
      entityId: runId,
      after: { employees: updated.total_employees },
    });
    return updated;
  }

  // ==========================================================================
  // Step 3 — Calculate salaries for all employees in the run
  // ==========================================================================
  async calculate(runId: string, actorId: string): Promise<PayrollRun> {
    const run = await this.mustGetRun(runId);
    if (run.state !== 'IN_PROGRESS' && run.state !== 'REVIEW') {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Cannot calculate in state ${run.state}`,
      });
    }

    const snapshots = await this.preRepo.find({ where: { run_id: runId } });
    if (snapshots.length === 0) {
      throw new UnprocessableEntityException({
        code: 'PR_NO_SNAPSHOTS',
        message: 'Run has no employee snapshots — import first',
      });
    }

    await this.dataSource.transaction(async (m) => {
      // Wipe existing items for this run
      await m.query(`DELETE FROM payroll_items WHERE run_id = $1`, [runId]);

      for (const snap of snapshots) {
        const input = buildSnapshot({
          user_id: snap.user_id,
          gross: snap.snapshot_gross,
          incentive: snap.snapshot_incentive,
          tds: snap.snapshot_tds,
          loan_emi: snap.snapshot_loan_emi,
          sal_deduction: snap.snapshot_sal_deduction,
          security_return: snap.snapshot_security_return,
          pf_applicable: snap.snapshot_pf_applicable,
          lwp_days: snap.lwp_days,
          ot_hours: snap.ot_hours,
          components: snap.snapshot_components,
          statutory: snap.snapshot_statutory,
        });
        const out = calculate(input);

        await m.query(
          `INSERT INTO payroll_items (
            run_id, user_id, run_employee_id,
            lwp_deduction, sal_for_calc,
            basic_actual, basic_payable,
            hra_actual, hra_payable,
            sp_allow_actual, sp_allow_payable,
            conveyance_actual, conveyance_payable,
            ltc_actual, ltc_payable,
            re_medical_actual, re_medical_payable,
            education_actual, education_payable,
            fix_variable, ot_per_hour, ot_rate, ot_pay, security_return,
            employee_pf, employer_pf, employee_esic, employer_esic, esic_applied,
            professional_tax, tds, loan_emi, sal_deduction,
            total_earnings, total_deductions, net_payable, ctc, ctc_as_per_it,
            is_current, calculation_version
          ) VALUES (
            $1,$2,$3,
            $4,$5,
            $6,$7, $8,$9, $10,$11, $12,$13, $14,$15, $16,$17, $18,$19,
            $20,$21,$22,$23,$24,
            $25,$26,$27,$28,$29,
            $30,$31,$32,$33,
            $34,$35,$36,$37,$38,
            TRUE, 1
          )`,
          [
            runId, snap.user_id, snap.id,
            out.lwp_deduction, out.sal_for_calc,
            out.basic_actual, out.basic_payable,
            out.hra_actual, out.hra_payable,
            out.sp_allow_actual, out.sp_allow_payable,
            out.conveyance_actual, out.conveyance_payable,
            out.ltc_actual, out.ltc_payable,
            out.re_medical_actual, out.re_medical_payable,
            out.education_actual, out.education_payable,
            out.fix_variable, out.ot_per_hour, out.ot_rate, out.ot_pay, out.security_return,
            out.employee_pf, out.employer_pf, out.employee_esic, out.employer_esic, out.esic_applied,
            out.professional_tax, out.tds, out.loan_emi, out.sal_deduction,
            out.total_earnings, out.total_deductions, out.net_payable, out.ctc, out.ctc_as_per_it,
          ],
        );
      }

      await this.recomputeTotals(runId, m);
      await m.query(
        `UPDATE payroll_runs SET state = 'REVIEW', calculated_at = now() WHERE id = $1`,
        [runId],
      );
    });

    const updated = await this.mustGetRun(runId);
    await this.audit.log({
      actorId,
      action: 'payroll.run.calculated',
      entityType: 'payroll_runs',
      entityId: runId,
      after: {
        total_net_payable: updated.total_net_payable,
        total_employer_pf: updated.total_employer_pf,
        total_employee_pf: updated.total_employee_pf,
        employees: updated.total_employees,
      },
    });
    return updated;
  }

  // ==========================================================================
  // Step 2b — Override a single employee's imported snapshot (A1)
  // ==========================================================================
  async overrideSnapshot(
    runId: string,
    userId: string,
    patch: Partial<
      Record<(typeof EDITABLE_SNAPSHOT_COUNTERS)[number], number>
    >,
    actorId: string,
  ): Promise<void> {
    const run = await this.mustGetRun(runId);
    if (run.state !== 'IN_PROGRESS' && run.state !== 'REVIEW') {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Cannot override snapshot in state ${run.state}`,
      });
    }

    const allowed: Record<string, number> = {};
    for (const field of EDITABLE_SNAPSHOT_COUNTERS) {
      if (patch[field] !== undefined) {
        allowed[field] = Number(patch[field]);
      }
    }
    if (Object.keys(allowed).length === 0) {
      throw new BadRequestException('No editable fields in payload');
    }

    if (
      allowed.lwp_days !== undefined &&
      (allowed.lwp_days < 0 || allowed.lwp_days > 30)
    ) {
      throw new UnprocessableEntityException({
        code: 'PR_FORBIDDEN_FIELD',
        message: 'lwp_days must be 0..30',
      });
    }
    if (allowed.ot_hours !== undefined && allowed.ot_hours < 0) {
      throw new UnprocessableEntityException({
        code: 'PR_FORBIDDEN_FIELD',
        message: 'ot_hours must be >= 0',
      });
    }

    const snap = await this.preRepo.findOne({
      where: { run_id: runId, user_id: userId },
    });
    if (!snap) throw new NotFoundException('Snapshot row not found');
    const before = { ...snap };

    Object.assign(snap, allowed);
    if (allowed.lwp_days !== undefined) {
      snap.present_days = String(
        snap.snapshot_statutory.payroll_cycle_days - allowed.lwp_days,
      ) as unknown as string;
    }
    await this.preRepo.save(snap);

    await this.audit.log({
      actorId,
      action: 'payroll.run.snapshot_overridden',
      entityType: 'payroll_run_employees',
      entityId: snap.id,
      before,
      after: snap,
    });

    // If already in REVIEW, re-run engine for just this employee
    if (run.state === 'REVIEW') {
      await this.recalculateOne(runId, userId);
    }
  }

  // ==========================================================================
  // Step 4 — Edit a single payroll item's editable fields
  // ==========================================================================
  async editItem(
    runId: string,
    userId: string,
    patch: {
      incentive?: number;
      tds?: number;
      loan_emi?: number;
      sal_deduction?: number;
      security_return?: number;
    },
    actorId: string,
  ): Promise<PayrollItem> {
    const run = await this.mustGetRun(runId);
    if (run.state !== 'REVIEW') {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Edits only allowed in REVIEW; current state ${run.state}`,
      });
    }

    const snap = await this.preRepo.findOne({
      where: { run_id: runId, user_id: userId },
    });
    if (!snap) throw new NotFoundException('Snapshot not found');

    const before: Record<string, string> = {};
    if (patch.incentive !== undefined) {
      before.incentive = snap.snapshot_incentive;
      snap.snapshot_incentive = String(patch.incentive);
    }
    if (patch.tds !== undefined) {
      before.tds = snap.snapshot_tds;
      snap.snapshot_tds = String(patch.tds);
    }
    if (patch.loan_emi !== undefined) {
      before.loan_emi = snap.snapshot_loan_emi;
      snap.snapshot_loan_emi = String(patch.loan_emi);
    }
    if (patch.sal_deduction !== undefined) {
      before.sal_deduction = snap.snapshot_sal_deduction;
      snap.snapshot_sal_deduction = String(patch.sal_deduction);
    }
    if (patch.security_return !== undefined) {
      before.security_return = snap.snapshot_security_return;
      snap.snapshot_security_return = String(patch.security_return);
    }
    if (Object.keys(before).length === 0) {
      throw new BadRequestException('No editable fields in payload');
    }
    await this.preRepo.save(snap);

    const newItem = await this.recalculateOne(runId, userId);

    await this.audit.log({
      actorId,
      action: 'payroll.run.item_edited',
      entityType: 'payroll_items',
      entityId: newItem.id,
      before,
      after: patch,
    });

    return newItem;
  }

  private async recalculateOne(
    runId: string,
    userId: string,
  ): Promise<PayrollItem> {
    const snap = await this.preRepo.findOne({
      where: { run_id: runId, user_id: userId },
    });
    if (!snap) throw new NotFoundException('Snapshot not found');

    const input = buildSnapshot({
      user_id: snap.user_id,
      gross: snap.snapshot_gross,
      incentive: snap.snapshot_incentive,
      tds: snap.snapshot_tds,
      loan_emi: snap.snapshot_loan_emi,
      sal_deduction: snap.snapshot_sal_deduction,
      security_return: snap.snapshot_security_return,
      pf_applicable: snap.snapshot_pf_applicable,
      lwp_days: snap.lwp_days,
      ot_hours: snap.ot_hours,
      components: snap.snapshot_components,
      statutory: snap.snapshot_statutory,
    });
    const out = calculate(input);

    return this.dataSource.transaction(async (m) => {
      // Supersede any current row
      const current = await m.query(
        `SELECT id, calculation_version FROM payroll_items WHERE run_id = $1 AND user_id = $2 AND is_current = TRUE LIMIT 1`,
        [runId, userId],
      );

      let nextVersion = 1;
      let supersededBy: string | null = null;
      if (current.length > 0) {
        nextVersion = Number(current[0].calculation_version) + 1;
        supersededBy = current[0].id;
      }

      const insertRes = await m.query(
        `INSERT INTO payroll_items (
          run_id, user_id, run_employee_id,
          lwp_deduction, sal_for_calc,
          basic_actual, basic_payable,
          hra_actual, hra_payable,
          sp_allow_actual, sp_allow_payable,
          conveyance_actual, conveyance_payable,
          ltc_actual, ltc_payable,
          re_medical_actual, re_medical_payable,
          education_actual, education_payable,
          fix_variable, ot_per_hour, ot_rate, ot_pay, security_return,
          employee_pf, employer_pf, employee_esic, employer_esic, esic_applied,
          professional_tax, tds, loan_emi, sal_deduction,
          total_earnings, total_deductions, net_payable, ctc, ctc_as_per_it,
          is_current, calculation_version
        ) VALUES (
          $1,$2,$3,
          $4,$5,
          $6,$7, $8,$9, $10,$11, $12,$13, $14,$15, $16,$17, $18,$19,
          $20,$21,$22,$23,$24,
          $25,$26,$27,$28,$29,
          $30,$31,$32,$33,
          $34,$35,$36,$37,$38,
          TRUE, $39
        ) RETURNING id`,
        [
          runId, userId, snap.id,
          out.lwp_deduction, out.sal_for_calc,
          out.basic_actual, out.basic_payable,
          out.hra_actual, out.hra_payable,
          out.sp_allow_actual, out.sp_allow_payable,
          out.conveyance_actual, out.conveyance_payable,
          out.ltc_actual, out.ltc_payable,
          out.re_medical_actual, out.re_medical_payable,
          out.education_actual, out.education_payable,
          out.fix_variable, out.ot_per_hour, out.ot_rate, out.ot_pay, out.security_return,
          out.employee_pf, out.employer_pf, out.employee_esic, out.employer_esic, out.esic_applied,
          out.professional_tax, out.tds, out.loan_emi, out.sal_deduction,
          out.total_earnings, out.total_deductions, out.net_payable, out.ctc, out.ctc_as_per_it,
          nextVersion,
        ],
      );

      if (supersededBy) {
        await m.query(
          `UPDATE payroll_items
           SET is_current = FALSE, superseded_at = now(), superseded_by = $1
           WHERE id = $2`,
          [insertRes[0].id, supersededBy],
        );
      }

      await this.recomputeTotals(runId, m);

      const fresh = await m.query(
        `SELECT * FROM payroll_items WHERE id = $1 LIMIT 1`,
        [insertRes[0].id],
      );
      return fresh[0] as PayrollItem;
    });
  }

  // ==========================================================================
  // Step 5a — Lock
  // ==========================================================================
  async lock(
    runId: string,
    confirmationPhrase: string,
    actorId: string,
  ): Promise<PayrollRun> {
    const run = await this.mustGetRun(runId);
    if (run.state !== 'REVIEW') {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Cannot lock in state ${run.state}`,
      });
    }

    const expectedPhrase = `LOCK ${this.monthName(run.month).toUpperCase()} ${run.year}`;
    if (confirmationPhrase !== expectedPhrase) {
      throw new BadRequestException({
        code: 'PR_RUN_VALIDATION_FAILED',
        message: `Confirmation phrase required: "${expectedPhrase}"`,
      });
    }

    // Sanity: every snapshot employee has a current payroll_items row
    const [{ count }] = (await this.dataSource.query(
      `SELECT COUNT(*) FROM payroll_run_employees WHERE run_id = $1`,
      [runId],
    )) as CountRow[];
    const [{ count: itemCount }] = (await this.dataSource.query(
      `SELECT COUNT(*) FROM payroll_items WHERE run_id = $1 AND is_current = TRUE`,
      [runId],
    )) as CountRow[];
    if (count !== itemCount) {
      throw new UnprocessableEntityException({
        code: 'PR_RUN_VALIDATION_FAILED',
        message: `Calculation incomplete (${itemCount}/${count}) — recalculate before locking`,
      });
    }

    run.state = 'LOCKED';
    run.locked_at = new Date();
    run.locked_by = actorId;
    const saved = await this.runRepo.save(run);

    await this.audit.log({
      actorId,
      action: 'payroll.run.locked',
      entityType: 'payroll_runs',
      entityId: runId,
      after: { total_net_payable: saved.total_net_payable },
    });
    return saved;
  }

  // ==========================================================================
  // Step 5b — Release (returns a job stub; Phase F does PDF + email)
  // ==========================================================================
  async release(
    runId: string,
    releaseDate: string,
    actorId: string,
  ): Promise<PayrollRun> {
    const run = await this.mustGetRun(runId);
    if (run.state !== 'LOCKED') {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Cannot release in state ${run.state}`,
      });
    }

    run.state = 'RELEASED';
    run.released_at = new Date();
    run.released_by = actorId;
    run.release_date = releaseDate;
    const saved = await this.runRepo.save(run);

    await this.audit.log({
      actorId,
      action: 'payroll.run.released',
      entityType: 'payroll_runs',
      entityId: runId,
      after: { release_date: releaseDate },
    });
    return saved;
  }

  // ==========================================================================
  // Cancel (pre-lock only)
  // ==========================================================================
  async cancel(runId: string, actorId: string): Promise<PayrollRun> {
    const run = await this.mustGetRun(runId);
    if (!['DRAFT', 'IN_PROGRESS', 'REVIEW'].includes(run.state)) {
      throw new ConflictException({
        code: 'PR_RUN_INVALID_STATE',
        message: `Cannot cancel in state ${run.state}`,
      });
    }

    run.state = 'CANCELLED';
    run.cancelled_at = new Date();
    const saved = await this.runRepo.save(run);

    await this.audit.log({
      actorId,
      action: 'payroll.run.cancelled',
      entityType: 'payroll_runs',
      entityId: runId,
    });
    return saved;
  }

  // ==========================================================================
  // Queries
  // ==========================================================================
  async list(filters: {
    year?: number;
    state?: PayrollRunState;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: PayrollRun[]; total: number; page: number; pageSize: number }> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 200);

    const qb = this.runRepo
      .createQueryBuilder('r')
      .orderBy('r.year', 'DESC')
      .addOrderBy('r.month', 'DESC')
      .take(pageSize)
      .skip((page - 1) * pageSize);

    if (filters.year) qb.andWhere('r.year = :y', { y: filters.year });
    if (filters.state) qb.andWhere('r.state = :s', { s: filters.state });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getRun(runId: string): Promise<PayrollRun> {
    return this.mustGetRun(runId);
  }

  async listItems(
    runId: string,
    filters: { page?: number; pageSize?: number; search?: string },
  ): Promise<{
    items: Array<PayrollItem & { user_name?: string; emp_number?: string | null }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 50, 200);

    const qb = this.itemRepo
      .createQueryBuilder('pi')
      .leftJoin(User, 'u', 'u.id = pi.user_id')
      .addSelect([
        'u.name AS user_name',
        'u.emp_number AS emp_number',
        'u.designation AS designation',
      ])
      .where('pi.run_id = :rid', { rid: runId })
      .andWhere('pi.is_current = TRUE')
      .orderBy('u.name', 'ASC')
      .take(pageSize)
      .skip((page - 1) * pageSize);

    if (filters.search) {
      qb.andWhere('(u.name ILIKE :q OR u.emp_number ILIKE :q)', {
        q: `%${filters.search}%`,
      });
    }

    const raw = await qb.getRawAndEntities();
    const items = raw.entities.map((e, i) => ({
      ...e,
      user_name: raw.raw[i].user_name,
      emp_number: raw.raw[i].emp_number,
      designation: raw.raw[i].designation,
    }));
    const total = await qb.getCount();
    return { items, total, page, pageSize };
  }

  // ==========================================================================
  // Internals
  // ==========================================================================
  private async mustGetRun(runId: string): Promise<PayrollRun> {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  private async recomputeTotals(
    runId: string,
    m: EntityManager,
  ): Promise<void> {
    await m.query(
      `UPDATE payroll_runs r SET
          total_net_payable = COALESCE((SELECT SUM(net_payable)      FROM payroll_items WHERE run_id = r.id AND is_current = TRUE), 0),
          total_employer_pf = COALESCE((SELECT SUM(employer_pf)      FROM payroll_items WHERE run_id = r.id AND is_current = TRUE), 0),
          total_employee_pf = COALESCE((SELECT SUM(employee_pf)      FROM payroll_items WHERE run_id = r.id AND is_current = TRUE), 0),
          total_pt          = COALESCE((SELECT SUM(professional_tax) FROM payroll_items WHERE run_id = r.id AND is_current = TRUE), 0),
          total_tds         = COALESCE((SELECT SUM(tds)              FROM payroll_items WHERE run_id = r.id AND is_current = TRUE), 0),
          total_incentive   = COALESCE((SELECT SUM(fix_variable)     FROM payroll_items WHERE run_id = r.id AND is_current = TRUE), 0),
          total_ot_pay      = COALESCE((SELECT SUM(ot_pay)           FROM payroll_items WHERE run_id = r.id AND is_current = TRUE), 0),
          updated_at = now()
       WHERE r.id = $1`,
      [runId],
    );
  }

  private monthEndStr(year: number, month: number): string {
    // last day of the month
    const last = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }

  private monthName(month: number): string {
    return [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December',
    ][month - 1];
  }
}
