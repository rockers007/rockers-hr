import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayrollSchema1712000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extend users table with payroll fields (PAYROLL_DATABASE_SCHEMA.md §1)
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "gross" NUMERIC(10,2) DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS "incentive" NUMERIC(10,2) DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS "tds" NUMERIC(10,2) DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS "loan_emi" NUMERIC(10,2) DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS "sal_deduction" NUMERIC(10,2) DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS "security_return" NUMERIC(10,2) DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS "pf_applicable" BOOLEAN DEFAULT TRUE NOT NULL,
        ADD COLUMN IF NOT EXISTS "bank_name" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "bank_account_no" VARCHAR(40),
        ADD COLUMN IF NOT EXISTS "bank_ifsc" VARCHAR(15),
        ADD COLUMN IF NOT EXISTS "dob" DATE,
        ADD COLUMN IF NOT EXISTS "emp_number" VARCHAR(30),
        ADD COLUMN IF NOT EXISTS "designation" VARCHAR(100)
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_emp_number" ON "users" ("emp_number") WHERE "emp_number" IS NOT NULL`,
    );

    // 2. Enums (PAYROLL_DATABASE_SCHEMA.md §2, §5, §6, §8)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payroll_run_state" AS ENUM (
          'DRAFT','IN_PROGRESS','REVIEW','LOCKED','RELEASED',
          'BANK_FILE_APPROVED','BANK_FILE_GENERATED','CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payslip_delivery_status" AS ENUM ('PENDING','GENERATED','EMAILED','FAILED','BOUNCED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "bank_change_status" AS ENUM ('PENDING','APPROVED','REJECTED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "bank_file_type" AS ENUM ('NEFT','RTGS','MIXED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // 3. payroll_salary_components (PAYROLL_MASTER_DATA.md §3)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_salary_components" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" VARCHAR(20) NOT NULL UNIQUE,
        "display_name" VARCHAR(60) NOT NULL,
        "payslip_label" VARCHAR(30) NOT NULL,
        "percentage" NUMERIC(5,2) NOT NULL,
        "display_order" SMALLINT NOT NULL,
        "is_pf_base" BOOLEAN NOT NULL DEFAULT FALSE,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "notes" TEXT,
        "created_by" UUID REFERENCES "users"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_by" UUID REFERENCES "users"("id"),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // 4. payroll_statutory_config (PAYROLL_MASTER_DATA.md §4)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_statutory_config" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "profile_name" VARCHAR(50) NOT NULL DEFAULT 'DEFAULT',
        "pf_cap_amount" NUMERIC(10,2) NOT NULL DEFAULT 15000.00,
        "pf_fixed_at_cap" NUMERIC(8,2) NOT NULL DEFAULT 1800.00,
        "pf_rate_below_cap" NUMERIC(5,4) NOT NULL DEFAULT 0.1200,
        "pf_employer_matches_employee" BOOLEAN NOT NULL DEFAULT TRUE,
        "esic_active" BOOLEAN NOT NULL DEFAULT FALSE,
        "esic_threshold_gross" NUMERIC(10,2) NOT NULL DEFAULT 21000.00,
        "esic_employer_rate" NUMERIC(5,4) NOT NULL DEFAULT 0.0325,
        "esic_employee_rate" NUMERIC(5,4) NOT NULL DEFAULT 0.0075,
        "pt_flat_amount" NUMERIC(8,2) NOT NULL DEFAULT 200.00,
        "ot_multiplier" NUMERIC(4,2) NOT NULL DEFAULT 1.50,
        "ot_divisor_day" NUMERIC(4,0) NOT NULL DEFAULT 30,
        "ot_divisor_hour" NUMERIC(4,0) NOT NULL DEFAULT 9,
        "payroll_cycle_days" SMALLINT NOT NULL DEFAULT 30,
        "financial_year_start_month" SMALLINT NOT NULL DEFAULT 4,
        "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
        "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "updated_by" UUID REFERENCES "users"("id"),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_psc_active" ON "payroll_statutory_config" ("is_active") WHERE "is_active" = TRUE`,
    );

    // 5. payroll_earning_types (PAYROLL_MASTER_DATA.md §6)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_earning_types" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" VARCHAR(30) NOT NULL UNIQUE,
        "display_name" VARCHAR(60) NOT NULL,
        "payslip_label" VARCHAR(30) NOT NULL,
        "is_manual" BOOLEAN NOT NULL DEFAULT TRUE,
        "is_auto_from_leave" BOOLEAN NOT NULL DEFAULT FALSE,
        "display_order" SMALLINT NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    // 6. payroll_deduction_types (PAYROLL_MASTER_DATA.md §7)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_deduction_types" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" VARCHAR(30) NOT NULL UNIQUE,
        "display_name" VARCHAR(60) NOT NULL,
        "payslip_label" VARCHAR(30) NOT NULL,
        "is_statutory" BOOLEAN NOT NULL DEFAULT FALSE,
        "is_auto_calculated" BOOLEAN NOT NULL DEFAULT FALSE,
        "is_manual" BOOLEAN NOT NULL DEFAULT FALSE,
        "is_active_by_default" BOOLEAN NOT NULL DEFAULT TRUE,
        "display_order" SMALLINT NOT NULL,
        "notes" TEXT
      )
    `);

    // 7. payroll_bank_file_formats (PAYROLL_MASTER_DATA.md §8)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_bank_file_formats" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" VARCHAR(30) NOT NULL UNIQUE,
        "display_name" VARCHAR(80) NOT NULL,
        "file_extension" VARCHAR(10) NOT NULL DEFAULT 'txt',
        "delimiter" VARCHAR(5) NOT NULL DEFAULT '|',
        "has_header_row" BOOLEAN NOT NULL DEFAULT TRUE,
        "column_order" JSONB NOT NULL,
        "date_format" VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
        "amount_format" VARCHAR(20) NOT NULL DEFAULT 'INR_2DEC',
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "template_notes" TEXT
      )
    `);

    // 8. company_profile (PAYROLL_MASTER_DATA.md §9)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_profile" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_name" VARCHAR(120) NOT NULL,
        "address_line_1" VARCHAR(120),
        "address_line_2" VARCHAR(120),
        "city" VARCHAR(60),
        "state" VARCHAR(60),
        "pincode" VARCHAR(10),
        "logo_s3_key" TEXT,
        "payslip_footer_text" TEXT NOT NULL DEFAULT 'This is a system generated pay slip and does not require signature',
        "pf_establishment_code" VARCHAR(30),
        "esic_code" VARCHAR(30),
        "pan_number" VARCHAR(10),
        "updated_by" UUID REFERENCES "users"("id"),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // 9. payroll_runs (PAYROLL_DATABASE_SCHEMA.md §2)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_runs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "month" SMALLINT NOT NULL CHECK ("month" BETWEEN 1 AND 12),
        "year" SMALLINT NOT NULL CHECK ("year" BETWEEN 2024 AND 2100),
        "payroll_cycle_days" SMALLINT NOT NULL DEFAULT 30,
        "state" "payroll_run_state" NOT NULL DEFAULT 'DRAFT',
        "total_employees" INT NOT NULL DEFAULT 0,
        "total_net_payable" NUMERIC(14,2) DEFAULT 0,
        "total_employer_pf" NUMERIC(12,2) DEFAULT 0,
        "total_employee_pf" NUMERIC(12,2) DEFAULT 0,
        "total_pt" NUMERIC(10,2) DEFAULT 0,
        "total_tds" NUMERIC(12,2) DEFAULT 0,
        "total_incentive" NUMERIC(12,2) DEFAULT 0,
        "total_ot_pay" NUMERIC(12,2) DEFAULT 0,
        "release_date" DATE,
        "imported_at" TIMESTAMPTZ,
        "calculated_at" TIMESTAMPTZ,
        "locked_at" TIMESTAMPTZ,
        "released_at" TIMESTAMPTZ,
        "bank_file_approved_at" TIMESTAMPTZ,
        "bank_file_generated_at" TIMESTAMPTZ,
        "cancelled_at" TIMESTAMPTZ,
        "created_by" UUID NOT NULL REFERENCES "users"("id"),
        "locked_by" UUID REFERENCES "users"("id"),
        "released_by" UUID REFERENCES "users"("id"),
        "bank_file_approved_by" UUID REFERENCES "users"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_payroll_runs_active" ON "payroll_runs" ("month","year") WHERE "state" <> 'CANCELLED'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payroll_runs_state" ON "payroll_runs" ("state")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payroll_runs_year_month" ON "payroll_runs" ("year" DESC, "month" DESC)`,
    );

    // 10. payroll_run_employees (PAYROLL_DATABASE_SCHEMA.md §3)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_run_employees" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "run_id" UUID NOT NULL REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "snapshot_gross" NUMERIC(10,2) NOT NULL,
        "snapshot_incentive" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "snapshot_tds" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "snapshot_loan_emi" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "snapshot_sal_deduction" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "snapshot_security_return" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "snapshot_pf_applicable" BOOLEAN NOT NULL,
        "snapshot_components" JSONB NOT NULL,
        "snapshot_statutory" JSONB NOT NULL,
        "lwp_days" NUMERIC(5,2) NOT NULL DEFAULT 0,
        "cl_days" NUMERIC(5,2) NOT NULL DEFAULT 0,
        "sl_days" NUMERIC(5,2) NOT NULL DEFAULT 0,
        "pl_days" NUMERIC(5,2) NOT NULL DEFAULT 0,
        "wfh_days" NUMERIC(5,2) NOT NULL DEFAULT 0,
        "comp_off_days" NUMERIC(5,2) NOT NULL DEFAULT 0,
        "el_hours" NUMERIC(6,2) NOT NULL DEFAULT 0,
        "ot_hours" NUMERIC(6,2) NOT NULL DEFAULT 0,
        "present_days" NUMERIC(5,2) NOT NULL DEFAULT 30,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("run_id","user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pre_run" ON "payroll_run_employees" ("run_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pre_user" ON "payroll_run_employees" ("user_id")`,
    );

    // 11. payroll_items (PAYROLL_DATABASE_SCHEMA.md §4)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "run_id" UUID NOT NULL REFERENCES "payroll_runs"("id") ON DELETE RESTRICT,
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "run_employee_id" UUID NOT NULL REFERENCES "payroll_run_employees"("id"),
        "lwp_deduction" NUMERIC(10,2) NOT NULL,
        "sal_for_calc" NUMERIC(10,2) NOT NULL,
        "basic_actual" NUMERIC(10,2) NOT NULL,
        "basic_payable" NUMERIC(10,2) NOT NULL,
        "hra_actual" NUMERIC(10,2) NOT NULL,
        "hra_payable" NUMERIC(10,2) NOT NULL,
        "sp_allow_actual" NUMERIC(10,2) NOT NULL,
        "sp_allow_payable" NUMERIC(10,2) NOT NULL,
        "conveyance_actual" NUMERIC(10,2) NOT NULL,
        "conveyance_payable" NUMERIC(10,2) NOT NULL,
        "ltc_actual" NUMERIC(10,2) NOT NULL,
        "ltc_payable" NUMERIC(10,2) NOT NULL,
        "re_medical_actual" NUMERIC(10,2) NOT NULL,
        "re_medical_payable" NUMERIC(10,2) NOT NULL,
        "education_actual" NUMERIC(10,2) NOT NULL,
        "education_payable" NUMERIC(10,2) NOT NULL,
        "fix_variable" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "ot_per_hour" NUMERIC(8,2) NOT NULL DEFAULT 0,
        "ot_rate" NUMERIC(8,2) NOT NULL DEFAULT 0,
        "ot_pay" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "security_return" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "employee_pf" NUMERIC(8,2) NOT NULL DEFAULT 0,
        "employer_pf" NUMERIC(8,2) NOT NULL DEFAULT 0,
        "employee_esic" NUMERIC(8,2) NOT NULL DEFAULT 0,
        "employer_esic" NUMERIC(8,2) NOT NULL DEFAULT 0,
        "esic_applied" BOOLEAN NOT NULL DEFAULT FALSE,
        "professional_tax" NUMERIC(8,2) NOT NULL DEFAULT 0,
        "tds" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "loan_emi" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "sal_deduction" NUMERIC(10,2) NOT NULL DEFAULT 0,
        "total_earnings" NUMERIC(12,2) NOT NULL,
        "total_deductions" NUMERIC(12,2) NOT NULL,
        "net_payable" NUMERIC(12,2) NOT NULL,
        "ctc" NUMERIC(12,2) NOT NULL,
        "ctc_as_per_it" NUMERIC(12,2) NOT NULL,
        "is_current" BOOLEAN NOT NULL DEFAULT TRUE,
        "superseded_at" TIMESTAMPTZ,
        "superseded_by" UUID REFERENCES "payroll_items"("id"),
        "calculation_version" SMALLINT NOT NULL DEFAULT 1,
        "computed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK ("net_payable" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_payroll_items_current" ON "payroll_items" ("run_id","user_id") WHERE "is_current" = TRUE`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payroll_items_run" ON "payroll_items" ("run_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payroll_items_user" ON "payroll_items" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payroll_items_user_ytd" ON "payroll_items" ("user_id") WHERE "is_current" = TRUE`,
    );

    // 12. payslip_deliveries (PAYROLL_DATABASE_SCHEMA.md §5)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payslip_deliveries" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "run_id" UUID NOT NULL REFERENCES "payroll_runs"("id") ON DELETE RESTRICT,
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "payroll_item_id" UUID NOT NULL REFERENCES "payroll_items"("id"),
        "s3_key" TEXT,
        "s3_url_signed" TEXT,
        "pdf_size_bytes" INT,
        "pdf_password_hint" VARCHAR(20) NOT NULL DEFAULT 'DOB in DDMM',
        "status" "payslip_delivery_status" NOT NULL DEFAULT 'PENDING',
        "sent_at" TIMESTAMPTZ,
        "bounced_at" TIMESTAMPTZ,
        "failure_reason" TEXT,
        "retry_count" SMALLINT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("run_id","user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_psd_status" ON "payslip_deliveries" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_psd_run" ON "payslip_deliveries" ("run_id")`,
    );

    // 13. bank_change_requests (PAYROLL_DATABASE_SCHEMA.md §6)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_change_requests" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "current_bank_name" VARCHAR(100),
        "current_account_no" VARCHAR(40),
        "current_ifsc" VARCHAR(15),
        "new_bank_name" VARCHAR(100) NOT NULL,
        "new_account_no" VARCHAR(40) NOT NULL,
        "new_ifsc" VARCHAR(15) NOT NULL,
        "proof_s3_key" TEXT,
        "status" "bank_change_status" NOT NULL DEFAULT 'PENDING',
        "reviewed_by" UUID REFERENCES "users"("id"),
        "reviewed_at" TIMESTAMPTZ,
        "rejection_reason" TEXT,
        "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "effective_from_run_id" UUID REFERENCES "payroll_runs"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_bcr_user" ON "bank_change_requests" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_bcr_status" ON "bank_change_requests" ("status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_bcr_pending_per_user" ON "bank_change_requests" ("user_id") WHERE "status" = 'PENDING'`,
    );

    // 14. investment_proofs (PAYROLL_DATABASE_SCHEMA.md §7)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investment_proofs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "financial_year" VARCHAR(9) NOT NULL,
        "category" VARCHAR(50) NOT NULL,
        "description" TEXT,
        "amount" NUMERIC(10,2),
        "s3_key" TEXT NOT NULL,
        "file_size_bytes" INT,
        "mime_type" VARCHAR(50),
        "deleted_at" TIMESTAMPTZ,
        "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("user_id","financial_year","s3_key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ip_user_fy" ON "investment_proofs" ("user_id","financial_year")`,
    );

    // 15. bank_transfer_files (PAYROLL_DATABASE_SCHEMA.md §8)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_transfer_files" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "run_id" UUID NOT NULL REFERENCES "payroll_runs"("id") ON DELETE RESTRICT,
        "file_type" "bank_file_type" NOT NULL DEFAULT 'NEFT',
        "employee_count" INT NOT NULL,
        "total_amount" NUMERIC(14,2) NOT NULL,
        "s3_key" TEXT NOT NULL,
        "file_format" VARCHAR(30) NOT NULL DEFAULT 'BANK_CUSTOM',
        "is_latest" BOOLEAN NOT NULL DEFAULT TRUE,
        "approved_by" UUID NOT NULL REFERENCES "users"("id"),
        "approved_at" TIMESTAMPTZ NOT NULL,
        "generated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_btf_latest_per_run" ON "bank_transfer_files" ("run_id") WHERE "is_latest" = TRUE`,
    );

    // 16. idempotency_keys (PAYROLL_API_CONTRACTS.md §13)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "idempotency_keys" (
        "key" VARCHAR(64) PRIMARY KEY,
        "response" JSONB NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ik_created" ON "idempotency_keys" ("created_at")`,
    );

    // 17. YTD view (PAYROLL_DATABASE_SCHEMA.md §9)
    await queryRunner.query(`
      CREATE OR REPLACE VIEW "v_employee_ytd" AS
      SELECT
        pi.user_id,
        CASE
          WHEN pr.month >= 4 THEN pr.year || '-' || (pr.year + 1)
          ELSE (pr.year - 1) || '-' || pr.year
        END AS financial_year,
        SUM(pi.sal_for_calc) AS ytd_sal_for_calc,
        SUM(pi.total_earnings) AS ytd_earnings,
        SUM(pi.employee_pf) AS ytd_employee_pf,
        SUM(pi.employer_pf) AS ytd_employer_pf,
        SUM(pi.professional_tax) AS ytd_pt,
        SUM(pi.tds) AS ytd_tds,
        SUM(pi.net_payable) AS ytd_net_payable,
        COUNT(*) AS months_processed
      FROM payroll_items pi
      JOIN payroll_runs pr ON pr.id = pi.run_id
      WHERE pi.is_current = TRUE
        AND pr.state IN ('RELEASED','BANK_FILE_APPROVED','BANK_FILE_GENERATED')
      GROUP BY pi.user_id, financial_year
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "v_employee_ytd"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_transfer_files"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "investment_proofs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_change_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payslip_deliveries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_run_employees"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company_profile"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_bank_file_formats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_deduction_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_earning_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_statutory_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_salary_components"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "bank_file_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bank_change_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payslip_delivery_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payroll_run_state"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_emp_number"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "designation",
        DROP COLUMN IF EXISTS "emp_number",
        DROP COLUMN IF EXISTS "dob",
        DROP COLUMN IF EXISTS "bank_ifsc",
        DROP COLUMN IF EXISTS "bank_account_no",
        DROP COLUMN IF EXISTS "bank_name",
        DROP COLUMN IF EXISTS "pf_applicable",
        DROP COLUMN IF EXISTS "security_return",
        DROP COLUMN IF EXISTS "sal_deduction",
        DROP COLUMN IF EXISTS "loan_emi",
        DROP COLUMN IF EXISTS "tds",
        DROP COLUMN IF EXISTS "incentive",
        DROP COLUMN IF EXISTS "gross"
    `);
  }
}
