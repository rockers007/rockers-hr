import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `master_relations` — admin-managed list of family-member relation
 * labels. Seeded with the common cases; HR admins can add/edit/disable
 * via the existing /master/:table CRUD UI.
 *
 * The `user_family_members.relation` column stays VARCHAR(40) — values
 * are still stored as text. The frontend simply picks the label from
 * this master table for the dropdown, so existing rows continue to
 * work unchanged.
 */
export class MasterRelations1712000000080 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "master_relations" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "label"       TEXT NOT NULL UNIQUE,
        "sort_order"  INT  NOT NULL DEFAULT 0,
        "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
        "created_by"  UUID,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'fk_master_relations_created_by'
        ) THEN
          ALTER TABLE "master_relations"
            ADD CONSTRAINT "fk_master_relations_created_by"
            FOREIGN KEY ("created_by")
            REFERENCES admin_users(id)
            ON DELETE RESTRICT;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      INSERT INTO "master_relations" (label, sort_order) VALUES
        ('Father', 1),
        ('Mother', 2),
        ('Spouse', 3),
        ('Son', 4),
        ('Daughter', 5),
        ('Brother', 6),
        ('Sister', 7),
        ('Guardian', 8),
        ('Other', 99)
      ON CONFLICT (label) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "master_relations" DROP CONSTRAINT IF EXISTS "fk_master_relations_created_by"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "master_relations"`);
  }
}
