import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceLeaveSystem1711900000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add system_key & new config fields to master_leave_types
    await queryRunner.query(`
      ALTER TABLE "master_leave_types"
        ADD COLUMN IF NOT EXISTS "system_key" text UNIQUE,
        ADD COLUMN IF NOT EXISTS "unit" text NOT NULL DEFAULT 'days',
        ADD COLUMN IF NOT EXISTS "accrual_type" text NOT NULL DEFAULT 'fixed',
        ADD COLUMN IF NOT EXISTS "accrual_rate_per_month" decimal(4,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "min_tenure_months" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "max_days_per_request" int DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "min_advance_days" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "requires_doc_for_future" boolean NOT NULL DEFAULT false
    `);

    // 2. Add early leave time fields to leave_requests
    await queryRunner.query(`
      ALTER TABLE "leave_requests"
        ADD COLUMN IF NOT EXISTS "early_leave_date" date,
        ADD COLUMN IF NOT EXISTS "early_leave_start_time" time,
        ADD COLUMN IF NOT EXISTS "early_leave_end_time" time,
        ADD COLUMN IF NOT EXISTS "early_leave_hours" decimal(4,2)
    `);

    // 3. Add "Early Leave" duration type
    await queryRunner.query(`
      INSERT INTO "master_leave_durations" (id, label, day_value, sort_order, is_active)
      VALUES (gen_random_uuid(), 'Early Leave (Hours)', 0, 4, true)
      ON CONFLICT DO NOTHING
    `);

    // 4. Update CL
    await queryRunner.query(`
      UPDATE "master_leave_types" SET
        system_key = 'CL',
        annual_days = 6,
        probation_allowed = false,
        accrual_type = 'monthly',
        accrual_rate_per_month = 0.50,
        doc_required = false,
        doc_threshold_days = NULL
      WHERE label = 'Casual Leave'
    `);

    // 5. Update SL
    await queryRunner.query(`
      UPDATE "master_leave_types" SET
        system_key = 'SL',
        annual_days = 6,
        probation_allowed = false,
        accrual_type = 'monthly',
        accrual_rate_per_month = 0.50,
        doc_required = true,
        doc_threshold_days = NULL,
        requires_doc_for_future = true
      WHERE label = 'Sick Leave'
    `);

    // 6. Update PL
    await queryRunner.query(`
      UPDATE "master_leave_types" SET
        system_key = 'PL',
        annual_days = 13,
        probation_allowed = false,
        min_tenure_months = 12,
        max_days_per_request = 5,
        min_advance_days = 15,
        doc_required = false
      WHERE label = 'Paid Leave'
    `);

    // 7. Insert LWP
    await queryRunner.query(`
      INSERT INTO "master_leave_types" (
        id, label, system_key, annual_days, probation_allowed, doc_required,
        carry_over, color, sort_order, is_active, unit, accrual_type
      ) VALUES (
        gen_random_uuid(), 'Leave Without Pay', 'LWP', 30, true, false,
        0, '#94a3b8', 7, true, 'days', 'fixed'
      )
      ON CONFLICT DO NOTHING
    `);

    // 8. Insert Early Leave
    await queryRunner.query(`
      INSERT INTO "master_leave_types" (
        id, label, system_key, annual_days, probation_allowed, doc_required,
        carry_over, color, sort_order, is_active, unit, accrual_type
      ) VALUES (
        gen_random_uuid(), 'Early Leave', 'EARLY', 6, true, false,
        0, '#f97316', 8, true, 'hours', 'fixed'
      )
      ON CONFLICT DO NOTHING
    `);

    // 9. Set system keys for remaining types
    await queryRunner.query(`UPDATE "master_leave_types" SET system_key = 'ML' WHERE label = 'Medical Leave' AND system_key IS NULL`);
    await queryRunner.query(`UPDATE "master_leave_types" SET system_key = 'EL' WHERE label = 'Emergency Leave' AND system_key IS NULL`);
    await queryRunner.query(`UPDATE "master_leave_types" SET system_key = 'MPL' WHERE label LIKE 'Maternity%' AND system_key IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leave_requests"
        DROP COLUMN IF EXISTS "early_leave_date",
        DROP COLUMN IF EXISTS "early_leave_start_time",
        DROP COLUMN IF EXISTS "early_leave_end_time",
        DROP COLUMN IF EXISTS "early_leave_hours"
    `);

    await queryRunner.query(`
      ALTER TABLE "master_leave_types"
        DROP COLUMN IF EXISTS "system_key",
        DROP COLUMN IF EXISTS "unit",
        DROP COLUMN IF EXISTS "accrual_type",
        DROP COLUMN IF EXISTS "accrual_rate_per_month",
        DROP COLUMN IF EXISTS "min_tenure_months",
        DROP COLUMN IF EXISTS "max_days_per_request",
        DROP COLUMN IF EXISTS "min_advance_days",
        DROP COLUMN IF EXISTS "requires_doc_for_future"
    `);

    await queryRunner.query(`DELETE FROM "master_leave_types" WHERE system_key IN ('LWP', 'EARLY')`);
    await queryRunner.query(`DELETE FROM "master_leave_durations" WHERE label = 'Early Leave (Hours)'`);
  }
}
