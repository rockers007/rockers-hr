import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { seedMasterData, seedDefaultSuperAdmin } from './seed-master-data';
import { seedPayrollMasterData } from './seed-payroll-master-data';
import { seedFromSnapshot } from './seed-from-snapshot';

config();

async function runSeed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Database connected. Running seeds...');

  // Prefer the latest snapshot of master data (produced by `npm run seed:dump`).
  // If the snapshot file is missing, fall back to the original hardcoded seed
  // so fresh clones without a dump still bootstrap correctly.
  const snapshotApplied = await seedFromSnapshot(dataSource);
  if (!snapshotApplied) {
    console.log('[seed] No snapshot found — applying hardcoded defaults.');
    await seedMasterData(dataSource);
  } else {
    // Snapshot handled all 11 master tables idempotently; still ensure the
    // default Super Admin (admin@rockers.com) exists.
    await seedDefaultSuperAdmin(dataSource);
  }

  await seedPayrollMasterData(dataSource);

  await dataSource.destroy();
  console.log('Seed complete. Connection closed.');
}

runSeed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
