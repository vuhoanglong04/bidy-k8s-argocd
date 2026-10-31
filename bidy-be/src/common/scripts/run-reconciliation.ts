import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from '../../database/data-source.js';
import { WalletCronService } from '../../modules/wallet/wallet-cron.service.js';

async function run() {
  try {
    console.log('🔄 Initializing DataSource...');
    await AppDataSource.initialize();
    console.log('✅ DataSource initialized');

    const walletCronService = new WalletCronService(AppDataSource);
    console.log('🔍 Running nightly reconciliation...');
    const result = await walletCronService.runNightlyReconciliation();

    console.log('\n📊 Reconciliation Results:');
    console.log(JSON.stringify(result, null, 2));

    await AppDataSource.destroy();

    if (!result.invariants.allPassed) {
      console.error('\n❌ Invariant check failed!');
      process.exit(1);
    }

    console.log('\n✅ Reconciliation completed successfully with all invariants passed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error running reconciliation:', err);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
}

run();
