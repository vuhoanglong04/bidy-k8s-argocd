import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from '../data-source.js';
import { seedAdmin } from './admin.seed.js';
import { seedCategories } from './category.seed.js';
import { seedAuctions } from './auction.seed.js';
import { seedWallet } from './wallet.seed.js';

/**
 * Development seed for the landing page: an admin account, a two-level category
 * tree, and auctions whose start/end times are derived from the moment this
 * runs, so there is always something live, something upcoming and something
 * finished.
 *
 *   npm run seed
 *
 * Idempotent — admin upserts by email, categories by slug, products by slug,
 * auctions by product.
 */
async function run() {
  try {
    await AppDataSource.initialize();
    console.log('✅ DataSource initialized');

    await seedAdmin(AppDataSource);
    const categoryIds = await seedCategories(AppDataSource);
    await seedAuctions(AppDataSource, categoryIds);
    await seedWallet(AppDataSource);

    await AppDataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

run();
