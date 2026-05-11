import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Seeds master data from `master-data.generated.ts` (produced by
 * `npm run seed:dump`). Idempotent: re-running won't duplicate rows.
 *
 * For each table we INSERT row-by-row and skip when a matching natural
 * key already exists — so running this against a DB that already has the
 * target rows is a no-op. Safe to run on every deploy / migration.
 *
 * If the generated file is missing we silently no-op and let the caller
 * fall back to the legacy hardcoded seed.
 */
export async function seedFromSnapshot(ds: DataSource): Promise<boolean> {
  const generatedPath = path.join(__dirname, 'master-data.generated.ts');
  if (!fs.existsSync(generatedPath)) {
    console.log(
      '[seed] master-data.generated.ts not found — skipping snapshot seed.',
    );
    return false;
  }

  // Dynamic import so we don't crash at bundle time if the file isn't there.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const snap = require('./master-data.generated') as SnapshotData;

  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    await insertIfMissing(
      qr,
      'master_admin_roles',
      snap.masterAdminRoles,
      ['name'],
    );
    await insertIfMissing(
      qr,
      'master_genders',
      snap.masterGenders,
      ['label'],
    );
    await insertIfMissing(
      qr,
      'master_qualifications',
      snap.masterQualifications,
      ['label'],
    );
    await insertIfMissing(
      qr,
      'master_role_types',
      snap.masterRoleTypes,
      ['system_key'],
    );
    await insertIfMissing(
      qr,
      'master_leave_types',
      snap.masterLeaveTypes,
      // system_key is unique when non-null; fall back to label if null.
      ['system_key', 'label'],
    );
    await insertIfMissing(
      qr,
      'master_leave_durations',
      snap.masterLeaveDurations,
      ['label'],
    );
    await insertIfMissing(
      qr,
      'master_file_types',
      snap.masterFileTypes,
      ['mime_type', 'context'],
    );
    await insertIfMissing(
      qr,
      'master_sla_config',
      snap.masterSlaConfig,
      ['config_key'],
    );
    await insertIfMissing(
      qr,
      'master_notification_templates',
      snap.masterNotificationTemplates,
      ['event_key'],
    );
    await insertIfMissing(
      qr,
      'master_public_holidays',
      snap.masterPublicHolidays,
      ['date', 'label'],
    );
    await insertIfMissing(
      qr,
      'master_departments',
      snap.masterDepartments,
      // Departments have UNIQUE on `code`, with `label` as a friendly
      // display name. Prefer code for the natural-key probe.
      ['code', 'label'],
    );

    // Tables added after the original snapshot contract — fall back
    // to empty arrays so older snapshots (that pre-date these tables)
    // still apply cleanly without throwing on missing properties.
    await insertIfMissing(
      qr,
      'master_marital_statuses',
      snap.masterMaritalStatuses ?? [],
      ['label'],
    );
    await insertIfMissing(
      qr,
      'master_document_types',
      snap.masterDocumentTypes ?? [],
      ['label'],
    );
    await insertIfMissing(
      qr,
      'master_relations',
      snap.masterRelations ?? [],
      ['label'],
    );
    // Designations are department-scoped via FK. The snapshot's
    // department_id UUID won't match the target DB, so we remap by
    // looking up the destination's department by label using the
    // department label embedded in the dumped row (added in
    // dump-master-data.ts after this table joined the list).
    await insertDesignationsFromSnapshot(qr, snap.masterDesignations ?? []);

    await qr.commitTransaction();
    console.log('[seed] Snapshot applied (idempotent).');
    return true;
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}

/**
 * Insert each row if no existing row matches the given natural-key columns.
 * Skips NULL-keyed rows when appropriate — e.g. master_leave_types.system_key
 * is the preferred match, but if the snapshot row has system_key=null we
 * fall through to label.
 */
async function insertIfMissing(
  qr: ReturnType<DataSource['createQueryRunner']>,
  table: string,
  rows: Array<Record<string, unknown>> | undefined,
  keyCandidates: string[],
): Promise<void> {
  if (!rows || rows.length === 0) return;

  // We deliberately drop id/created_at/updated_at so the DB regenerates them.
  // Including serial/uuid PKs from a dump would risk collisions across envs.
  const EXCLUDE = new Set(['id', 'created_at', 'updated_at']);

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const key = pickKey(row, keyCandidates);
    if (key) {
      const existsCheck = await qr.query(
        `SELECT 1 FROM ${table} WHERE ${key.col} = $1 LIMIT 1`,
        [key.val],
      );
      if (existsCheck.length > 0) {
        skipped++;
        continue;
      }
    }

    const cols = Object.keys(row).filter((k) => !EXCLUDE.has(k));
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const values = cols.map((c) => castJsonbIfObject(row[c]));

    // Cast jsonb columns explicitly — row objects come back from the
    // snapshot as JS objects/arrays and need to be JSON-stringified with
    // ::jsonb so Postgres accepts them.
    const placeholdersCast = cols.map((c, i) => {
      const v = row[c];
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        return `$${i + 1}::jsonb`;
      }
      return `$${i + 1}`;
    });

    try {
      await qr.query(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholdersCast.join(', ')})`,
        values,
      );
      inserted++;
    } catch (e) {
      // Fall back to ON CONFLICT DO NOTHING so a unique-constraint race
      // doesn't kill the whole transaction. This also handles the case where
      // our natural-key probe missed a distinct unique index (e.g. composite).
      const msg = (e as Error).message;
      if (/duplicate key|unique constraint/i.test(msg)) {
        skipped++;
        continue;
      }
      throw e;
    }
  }

  console.log(`[seed] ${table}: inserted ${inserted}, skipped ${skipped}`);
}

function pickKey(
  row: Record<string, unknown>,
  candidates: string[],
): { col: string; val: unknown } | null {
  for (const c of candidates) {
    if (c in row && row[c] !== null && row[c] !== undefined && row[c] !== '') {
      return { col: c, val: row[c] };
    }
  }
  return null;
}

function castJsonbIfObject(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Date) return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

type SnapshotData = {
  masterAdminRoles?: Array<Record<string, unknown>>;
  masterGenders?: Array<Record<string, unknown>>;
  masterQualifications?: Array<Record<string, unknown>>;
  masterRoleTypes?: Array<Record<string, unknown>>;
  masterLeaveTypes?: Array<Record<string, unknown>>;
  masterLeaveDurations?: Array<Record<string, unknown>>;
  masterFileTypes?: Array<Record<string, unknown>>;
  masterSlaConfig?: Array<Record<string, unknown>>;
  masterNotificationTemplates?: Array<Record<string, unknown>>;
  masterPublicHolidays?: Array<Record<string, unknown>>;
  masterDepartments?: Array<Record<string, unknown>>;
  // Added later in the project lifecycle — old snapshots that
  // pre-date these tables won't have the keys, so they're all
  // optional.
  masterMaritalStatuses?: Array<Record<string, unknown>>;
  masterDocumentTypes?: Array<Record<string, unknown>>;
  masterRelations?: Array<Record<string, unknown>>;
  masterDesignations?: Array<Record<string, unknown>>;
};

/**
 * Designation rows carry a `department_id` UUID. When seeding into a
 * different database (fresh install, staging clone, …) the source
 * UUID won't exist in the target's master_departments. We resolve
 * the FK at insert time by looking up the department in the target
 * DB using whichever stable key the snapshot provides — preferring
 * `department_code` and falling back to `department_label` (added
 * to the dump row in dump-master-data.ts). If neither matches, the
 * row is skipped with a warning so the rest of the seed can proceed.
 */
async function insertDesignationsFromSnapshot(
  qr: ReturnType<DataSource['createQueryRunner']>,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (!rows || rows.length === 0) return;
  let inserted = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const row of rows) {
    const label = (row.label as string | undefined) ?? '';
    if (!label) {
      unresolved++;
      continue;
    }

    // Try to resolve the destination department_id.
    let destDeptId: string | null = null;
    const deptCode = row.department_code as string | undefined;
    const deptLabel = row.department_label as string | undefined;
    if (deptCode) {
      const r = await qr.query(
        `SELECT id FROM master_departments WHERE code = $1 LIMIT 1`,
        [deptCode],
      );
      if (r.length) destDeptId = r[0].id;
    }
    if (!destDeptId && deptLabel) {
      const r = await qr.query(
        `SELECT id FROM master_departments WHERE label = $1 LIMIT 1`,
        [deptLabel],
      );
      if (r.length) destDeptId = r[0].id;
    }
    if (!destDeptId) {
      unresolved++;
      continue;
    }

    // Skip if (dept, label) already exists in the target.
    const exists = await qr.query(
      `SELECT 1 FROM master_designations WHERE department_id = $1 AND label = $2 LIMIT 1`,
      [destDeptId, label],
    );
    if (exists.length) {
      skipped++;
      continue;
    }

    try {
      await qr.query(
        `INSERT INTO master_designations (department_id, label, sort_order, is_active)
         VALUES ($1, $2, $3, $4)`,
        [
          destDeptId,
          label,
          (row.sort_order as number | undefined) ?? 0,
          (row.is_active as boolean | undefined) ?? true,
        ],
      );
      inserted++;
    } catch (e) {
      if (/duplicate key|unique constraint/i.test((e as Error).message)) {
        skipped++;
        continue;
      }
      throw e;
    }
  }
  console.log(
    `[seed] master_designations: inserted ${inserted}, skipped ${skipped}, unresolved ${unresolved}`,
  );
}
