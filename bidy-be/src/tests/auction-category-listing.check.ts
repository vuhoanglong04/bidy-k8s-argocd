/**
 * Smallest runnable check that the category listing filters by auction status and
 * orders by endDate — the homepage category page must not mix ended auctions into
 * live ones, and must rank live/upcoming ones closing-soonest-first.
 *
 *   npx tsx src/tests/auction-category-listing.check.ts
 *
 * No database: a stub repository captures the FindManyOptions the service builds,
 * which is exactly the behaviour that would regress if the where/order drifted.
 */
import assert from 'node:assert/strict';
import { AuctionService } from '../modules/auction/auction.service.js';
import { AuctionStatus } from '../modules/auction/enum/auction-status.enum.js';

const calls: any[] = [];
const auctionRepo = {
  findAndCount: async (options: any) => {
    calls.push(options);
    return [[], 0];
  },
} as any;

// The category and its descendants: a parent listing must cover the whole subtree.
const categoryService = {
  findDescendantIds: async (id: string) => (id === '7' ? ['7', '71', '72'] : []),
} as any;

const service = new AuctionService({} as any, auctionRepo, {} as any, {} as any, {} as any, categoryService, {} as any);

async function main() {
  // Live auctions: filtered to 'happening', closing soonest first, and scoped to
  // the whole subtree rather than the clicked node alone.
  await service.getProductByCategory('7', { status: AuctionStatus.HAPPENING });
  assert.equal(calls[0].where.status, AuctionStatus.HAPPENING);
  assert.deepEqual(calls[0].where.product.categoryId._value, ['7', '71', '72']);
  assert.deepEqual(calls[0].order, { endDate: 'ASC' });

  // Ended auctions: newest-first, matching getAuctions.
  await service.getProductByCategory('7', { status: AuctionStatus.ENDED });
  assert.deepEqual(calls[1].order, { endDate: 'DESC' });

  // No status: category is still scoped, nothing is filtered out.
  await service.getProductByCategory('7');
  assert.equal(calls[2].where.status, undefined);
  assert.deepEqual(calls[2].where.product.categoryId._value, ['7', '71', '72']);

  // An explicit sortBy overrides the status-aware default, and is whitelisted by
  // AUCTION_SORT_FIELDS before it ever reaches the order clause.
  await service.getProductByCategory('7', { status: AuctionStatus.HAPPENING, sortBy: 'bidderCount' });
  assert.deepEqual(calls[3].order, { bidderCount: 'DESC' });

  await service.getAuctions({ sortBy: 'createdAt', sortOrder: 'asc' });
  assert.deepEqual(calls[4].order, { createdAt: 'ASC' });

  // An unknown category yields no query at all rather than an unscoped listing.
  const empty = await service.getProductByCategory('nope');
  assert.deepEqual(empty, { items: [], total: 0 });

  console.log('auction-category-listing.check: OK');
}

main();
