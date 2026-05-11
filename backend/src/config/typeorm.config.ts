import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

config();

/**
 * SSL handling for cloud-hosted Postgres (Supabase, RDS, OCI, etc.).
 *
 * Driven by env so local Docker Postgres (no SSL) keeps working with
 * zero config changes:
 *   PGSSL=require  → enable TLS, skip CA-chain validation. Use this
 *                    for Supabase / RDS / OCI where the provider's
 *                    root CA isn't in Node's default bundle.
 *   PGSSL=strict   → enable TLS, validate the CA chain. Use this if
 *                    you've imported the provider's root CA into the
 *                    Node trust store.
 *   (anything else / unset) → no SSL — local dev against plain
 *                    Postgres on localhost.
 *
 * The `?sslmode=require` query param on DATABASE_URL alone isn't
 * always honoured: some pg / typeorm combinations only read it when
 * `ssl` is also set on the DataSource options object. Setting both
 * makes the behavior deterministic.
 *
 * As a safety net we auto-enable TLS when DATABASE_URL points at a
 * known managed-Postgres host, so a fresh Supabase URL "just works"
 * without anyone needing to remember to set PGSSL.
 */
function buildSsl():
  | boolean
  | { rejectUnauthorized: boolean }
  | undefined {
  const mode = (process.env.PGSSL ?? '').toLowerCase();
  if (mode === 'require') return { rejectUnauthorized: false };
  if (mode === 'strict') return { rejectUnauthorized: true };
  const url = process.env.DATABASE_URL ?? '';
  if (/supabase\.(co|com)|amazonaws\.com|oraclecloud\.com/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: buildSsl(),
  entities: [path.join(__dirname, '..', '**', 'entities', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

// Used by TypeORM CLI for migrations
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
