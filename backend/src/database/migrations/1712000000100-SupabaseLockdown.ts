import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Supabase exposes auto-generated APIs (PostgREST, Realtime, GraphQL)
 * on every project by default. Those APIs use two synthetic roles:
 *
 *   - `anon`           — anyone with the (public) anon API key
 *   - `authenticated`  — users with a Supabase Auth JWT
 *
 * This project does NOT use any of those surfaces; the NestJS backend
 * is the only thing that talks to the database, and it connects as
 * `postgres` (which bypasses RLS). But because `anon` and
 * `authenticated` have USAGE on the `public` schema and SELECT on
 * every table out of the box, anyone with the (publicly known) anon
 * key can dump our users, admin password hashes, payroll items, bank
 * change requests, audit log, and so on via a single curl against
 * https://<project>.supabase.co/rest/v1/<table>. Supabase's Database
 * Linter flags this as rls_disabled_in_public on every public table —
 * 40 findings on this project.
 *
 * The cleanest mitigation given that the auto-APIs are unused is to
 * revoke all access from those two roles at the schema level. They
 * keep existing (Supabase's internal tooling still needs them to be
 * present) but they can't read or write anything. The same migration
 * also flips the lone SECURITY DEFINER view (`v_employee_ytd`) to
 * SECURITY INVOKER so it can't be used as a bypass channel later.
 *
 * If we ever do want to expose PostgREST for a specific use case the
 * right move is to:
 *   1. Grant SELECT on the specific tables to `anon`/`authenticated`
 *   2. Enable RLS on those tables (ALTER TABLE … ENABLE ROW LEVEL
 *      SECURITY) and add policies that scope rows by auth.uid()
 *
 * Until then, the deny-by-default posture below is the safe choice.
 */
export class SupabaseLockdown1712000000100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // 1. Revoke schema-level access from anon + authenticated.
    //
    // `anon` / `authenticated` are Supabase-managed roles created by
    // the platform. They may not exist on a self-hosted Postgres or a
    // non-Supabase managed database — guard each REVOKE so the
    // migration is portable.
    // ------------------------------------------------------------------
    for (const role of ['anon', 'authenticated']) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
            -- Schema-level USAGE: without this, the role can't even
            -- name objects in the schema, so PostgREST returns 404
            -- for every table.
            REVOKE USAGE ON SCHEMA public FROM ${role};

            -- Belt-and-suspenders for any existing objects (Supabase
            -- grants tend to be re-applied by their tooling). Future
            -- objects are handled by the ALTER DEFAULT PRIVILEGES
            -- block below.
            REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM ${role};
            REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${role};
            REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${role};

            -- Default privileges — strips access from objects created
            -- AFTER this migration runs, so future TypeORM migrations
            -- don't accidentally hand the schema back to anon. Scope
            -- to the role(s) that typically create objects: the
            -- connection user the app/migrations run as, plus
            -- postgres for completeness.
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              REVOKE ALL ON TABLES FROM ${role};
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              REVOKE ALL ON SEQUENCES FROM ${role};
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              REVOKE ALL ON FUNCTIONS FROM ${role};
          END IF;
        END$$;
      `);
    }

    // ------------------------------------------------------------------
    // 2. Switch v_employee_ytd from SECURITY DEFINER to SECURITY INVOKER.
    //
    // The base view in CreatePayrollSchema1712000000000 was created
    // without an explicit security clause, so it inherits SECURITY
    // DEFINER from the owning role. The Supabase linter flags this
    // because queries via PostgREST then run with the owner's
    // privileges (bypassing RLS) rather than the caller's. Even
    // though we just revoked PostgREST access entirely above, flipping
    // the view to SECURITY INVOKER is a defense-in-depth move — if
    // someone re-grants schema USAGE later for a specific use case,
    // the view won't silently leak YTD salary aggregates.
    //
    // The `security_invoker = true` reloption was added in Postgres
    // 15. Supabase runs 15+. Guarded with IF EXISTS so the migration
    // is a no-op if the view was dropped.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_views
          WHERE schemaname = 'public' AND viewname = 'v_employee_ytd'
        ) THEN
          ALTER VIEW public.v_employee_ytd SET (security_invoker = true);
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-grant the Supabase defaults if the project decides to start
    // using PostgREST. Matches the privileges Supabase ships with on
    // a freshly-created project.
    for (const role of ['anon', 'authenticated']) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
            GRANT USAGE ON SCHEMA public TO ${role};
            GRANT SELECT, INSERT, UPDATE, DELETE
              ON ALL TABLES IN SCHEMA public TO ${role};
            GRANT USAGE, SELECT, UPDATE
              ON ALL SEQUENCES IN SCHEMA public TO ${role};
            GRANT EXECUTE
              ON ALL FUNCTIONS IN SCHEMA public TO ${role};
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role};
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${role};
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              GRANT EXECUTE ON FUNCTIONS TO ${role};
          END IF;
        END$$;
      `);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_views
          WHERE schemaname = 'public' AND viewname = 'v_employee_ytd'
        ) THEN
          ALTER VIEW public.v_employee_ytd RESET (security_invoker);
        END IF;
      END$$;
    `);
  }
}
