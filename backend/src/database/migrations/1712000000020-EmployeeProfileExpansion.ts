import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expands the employee profile per client request:
 *   - master_marital_statuses — dynamic marital-status dropdown
 *   - master_document_types    — dynamic document-type dropdown (Aadhaar/PAN/…)
 *   - users: marital_status_id, current_address, permanent_address,
 *     emergency_phone, pf_uan_no, esic_no
 *   - user_family_members   (1:N) — name / relation / occupation / dob / contact
 *   - user_documents        (1:N) — typed S3-backed document uploads
 *   - master_file_types row for the new 'user_document' upload context
 */
export class EmployeeProfileExpansion1712000000020
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- master_marital_statuses ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "master_marital_statuses" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "label" TEXT NOT NULL UNIQUE,
        "sort_order" INT NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO "master_marital_statuses" (label, sort_order) VALUES
        ('Single', 1),
        ('Married', 2),
        ('Divorced', 3),
        ('Widowed', 4),
        ('Other', 5)
      ON CONFLICT (label) DO NOTHING
    `);

    // --- master_document_types ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "master_document_types" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "label" TEXT NOT NULL UNIQUE,
        "sort_order" INT NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO "master_document_types" (label, sort_order) VALUES
        ('Aadhaar', 1),
        ('PAN', 2),
        ('Other', 3)
      ON CONFLICT (label) DO NOTHING
    `);

    // --- users extension ---
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "marital_status_id" UUID
          REFERENCES "master_marital_statuses"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "current_address" TEXT,
        ADD COLUMN IF NOT EXISTS "permanent_address" TEXT,
        ADD COLUMN IF NOT EXISTS "emergency_phone" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "pf_uan_no" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "esic_no" VARCHAR(20)
    `);

    // --- user_family_members ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_family_members" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" VARCHAR(100) NOT NULL,
        "relation" VARCHAR(40) NOT NULL,
        "occupation" VARCHAR(100),
        "dob" DATE,
        "contact_no" VARCHAR(20),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ufm_user" ON "user_family_members" ("user_id")`,
    );

    // --- user_documents ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_documents" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "document_type_id" UUID NOT NULL REFERENCES "master_document_types"("id") ON DELETE RESTRICT,
        "label" VARCHAR(120),
        "s3_key" TEXT NOT NULL,
        "file_size_bytes" INT,
        "mime_type" VARCHAR(60),
        "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_udoc_user" ON "user_documents" ("user_id") WHERE "deleted_at" IS NULL`,
    );

    // --- master_file_types: allow uploads under a new 'user_document' context ---
    await queryRunner.query(`
      INSERT INTO "master_file_types" (mime_type, extension, max_size_mb, context) VALUES
        ('application/pdf', '.pdf', 10, 'user_document'),
        ('image/jpeg', '.jpg', 10, 'user_document'),
        ('image/jpeg', '.jpeg', 10, 'user_document'),
        ('image/png', '.png', 10, 'user_document')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "master_file_types" WHERE context = 'user_document'`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_family_members"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "esic_no",
        DROP COLUMN IF EXISTS "pf_uan_no",
        DROP COLUMN IF EXISTS "emergency_phone",
        DROP COLUMN IF EXISTS "permanent_address",
        DROP COLUMN IF EXISTS "current_address",
        DROP COLUMN IF EXISTS "marital_status_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "master_document_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "master_marital_statuses"`);
  }
}
