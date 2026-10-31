import 'reflect-metadata';
import { AppDataSource } from '../../database/data-source.js';

async function run() {
  try {
    await AppDataSource.initialize();
    console.log('✅ DataSource initialized');

    await AppDataSource.runMigrations();
    console.log('✅ Migrations executed successfully');

    await AppDataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

run();
