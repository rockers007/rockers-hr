import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { seedMasterData } from './seed-master-data';
import { seedPayrollMasterData } from './seed-payroll-master-data';

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

  await seedMasterData(dataSource);
  await seedPayrollMasterData(dataSource);

  await dataSource.destroy();
  console.log('Seed complete. Connection closed.');
}

runSeed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
