/**
 * Guards the seller's own "withdraw auction" rule.
 *
 *   npx tsx src/tests/auction-seller-cancel.check.ts
 *
 * The rule exists because bidders commit against the closing time a listing
 * advertised: letting a seller cut a contested auction short would hand them the
 * choice of when to stop the price. So the moment any bid exists, withdrawal stops
 * being available — and the bid ROWS decide that, not the denormalised totalBids
 * counter, because cancelling a contested auction on a drifted counter cannot be
 * undone.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AuctionService } from '../modules/auction/auction.service.js';
import { AuctionStatus } from '../modules/auction/enum/auction-status.enum.js';

const OWNER = '30';
const STRANGER = '31';

function makeService({
  status = AuctionStatus.HAPPENING,
  bidRows = 0,
  totalBids = 0,
  ownerId = OWNER,
}: { status?: AuctionStatus; bidRows?: number; totalBids?: number; ownerId?: string } = {}) {
  const saved: any[] = [];
  const auctionRepo: any = {
    findOne: async () => ({
      id: '7',
      status,
      totalBids,
      product: { id: '3', ownerId },
    }),
    save: async (row: any) => {
      saved.push(row);
      return row;
    },
  };
  const bidHistoryRepo: any = { count: async () => bidRows };

  const service = new AuctionService(
    {} as any, auctionRepo, bidHistoryRepo, {} as any, {} as any, {} as any, {} as any,
  );
  return { service, saved };
}

async function rejects(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (err: Error) => {
    assert.equal(err.message, code);
    return true;
  });
}

async function main() {
  // A pristine auction can be withdrawn.
  const clean = makeService({ bidRows: 0 });
  assert.deepEqual(await clean.service.cancelMyAuction('7', OWNER), {
    id: '7',
    status: AuctionStatus.CANCELLED,
  });
  assert.equal(clean.saved.length, 1, 'the cancel must be persisted');

  // One bid is enough to take the action away.
  await rejects(() => makeService({ bidRows: 1 }).service.cancelMyAuction('7', OWNER), 'AUCTION_HAS_BIDS');

  // The counter must not be trusted over the rows. Here totalBids says 0 while real
  // bids exist — reading the counter would cancel a contested auction.
  await rejects(
    () => makeService({ bidRows: 4, totalBids: 0 }).service.cancelMyAuction('7', OWNER),
    'AUCTION_HAS_BIDS',
  );

  // A stranger gets 'not found' rather than a permissions hint.
  await rejects(() => makeService().service.cancelMyAuction('7', STRANGER), 'AUCTION_NOT_FOUND');

  // Finished auctions are not withdrawable, bids or no bids.
  for (const status of [AuctionStatus.ENDED, AuctionStatus.CANCELLED]) {
    await rejects(
      () => makeService({ status, bidRows: 0 }).service.cancelMyAuction('7', OWNER),
      'AUCTION_NOT_CANCELLABLE',
    );
  }

  // A pending auction that never opened is withdrawable too.
  const pending = makeService({ status: AuctionStatus.PENDING, bidRows: 0 });
  assert.equal((await pending.service.cancelMyAuction('7', OWNER)).status, AuctionStatus.CANCELLED);

  console.log('auction-seller-cancel.check OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
