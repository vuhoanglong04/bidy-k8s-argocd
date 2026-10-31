/**
 * Smallest runnable check for the admin overview counters.
 *
 *   npx tsx src/tests/admin-overview.check.ts
 *
 * Stubs the DataSource repositories with a fake query builder — no database required.
 * It fails if an overview stops using a single grouped-count query (one getRawMany per
 * endpoint), if the totals/buckets are mapped to the wrong status, or if a monthly
 * series stops padding every empty month to 0.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AppDataSource } from '../database/data-source.js';
import { AdminOverviewService } from '../modules/admin/admin-overview.service.js';

let queryCount = 0;
let monthlyRows: any[] = [];

function fakeRepository(rows: any[]) {
  const builder: any = {
    select: () => builder,
    addSelect: () => builder,
    groupBy: () => builder,
    where: () => builder,
    getRawMany: async () => {
      queryCount += 1;
      // The service caches its repositories in the constructor, so the rows have to be
      // chosen when the query runs, not when the stub is built.
      return monthlyRows.length ? monthlyRows : rows;
    },
  };
  return { createQueryBuilder: () => builder };
}

const rowsByEntity = new Map<string, any[]>([
  ['User', [{ status: 'active', count: '5' }, { status: 'suspended', count: '2' }, { status: 'banned', count: '1' }]],
  ['Auction', [{ status: 'happening', count: '3' }, { status: 'ended', count: '4' }, { status: 'pending', count: '1' }]],
  ['Category', [{ isActive: true, count: '6' }, { isActive: false, count: '2' }]],
]);

(AppDataSource as any).getRepository = (entity: any) =>
  fakeRepository(rowsByEntity.get(entity.name) ?? []);

async function main() {
  const service = new AdminOverviewService();

  assert.deepEqual(await service.getUserOverview(), {
    totalUser: 8,
    activeUser: 5,
    suspendedUser: 2,
  });

  assert.deepEqual(await service.getAuctionOverview(), {
    totalAuction: 8,
    happeningAuction: 3,
    endedAuction: 4,
  });

  assert.deepEqual(await service.getCategoryOverview(), {
    totalCategories: 8,
    activeCategories: 6,
    inactiveCategories: 2,
  });

  assert.equal(queryCount, 3, 'each overview must run exactly one aggregate query');

  // Monthly series: the chart needs a continuous axis, so a month the database never
  // returned has to read as 0 rather than going missing.
  monthlyRows = [
    { month: '1', count: '4' },
    { month: '3', count: '7' },
    { month: '12', count: '2' },
  ];

  const auctionsByMonth = await service.getAuctionsByMonth(2026);

  assert.equal(auctionsByMonth.length, 12, 'a monthly series always carries twelve entries');
  assert.deepEqual(
    auctionsByMonth.map((entry) => entry.month),
    ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
    'months are two-digit and in calendar order',
  );
  assert.deepEqual(auctionsByMonth[0], { month: '01', amount: 4 });
  assert.deepEqual(auctionsByMonth[2], { month: '03', amount: 7 });
  assert.deepEqual(auctionsByMonth[11], { month: '12', amount: 2 });
  assert.deepEqual(auctionsByMonth[1], { month: '02', amount: 0 }, 'an empty month reads as 0');

  // COUNT(*) comes back as a string from Postgres; amounts must leave the service as
  // numbers, because the client charts them directly.
  assert.ok(
    auctionsByMonth.every((entry) => typeof entry.amount === 'number'),
    'every amount is a number, never a string',
  );

  assert.deepEqual(await service.getUsersByMonth(2026), auctionsByMonth);

  console.log('admin-overview.check OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
