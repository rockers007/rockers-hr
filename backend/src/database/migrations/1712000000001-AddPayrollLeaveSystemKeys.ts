import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds COMP_OFF and WFH as first-class leave types in master_leave_types.
 * Payroll import (Step 2) aggregates from leave_requests by system_key —
 * no separate wfh_entries / complimentary_off tables.
 *
 * Resolves PAYROLL_PLAN.md §6.1 dependency warning Q15.
 */
export class AddPayrollLeaveSystemKeys1712000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // annual_days is CHECK (> 0) in the existing schema. Comp-Off and WFH are
    // earned/approval-based rather than pre-allocated, so we set a high cap (30)
    // which effectively means "not quota-constrained". Admin can tune per-policy
    // later. Payroll's import query aggregates from leave_requests by
    // system_key — it does not read annual_days.
    await queryRunner.query(`
      INSERT INTO "master_leave_types" (
        id, label, system_key, annual_days, probation_allowed, doc_required,
        carry_over, color, sort_order, is_active, unit, accrual_type
      ) VALUES (
        gen_random_uuid(), 'Compensatory Off', 'COMP_OFF', 30, false, false,
        0, '#10b981', 9, true, 'days', 'fixed'
      )
      ON CONFLICT (system_key) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "master_leave_types" (
        id, label, system_key, annual_days, probation_allowed, doc_required,
        carry_over, color, sort_order, is_active, unit, accrual_type
      ) VALUES (
        gen_random_uuid(), 'Work From Home', 'WFH', 30, true, false,
        0, '#6366f1', 10, true, 'days', 'fixed'
      )
      ON CONFLICT (system_key) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "master_leave_types" WHERE system_key IN ('COMP_OFF','WFH')`,
    );
  }
}
