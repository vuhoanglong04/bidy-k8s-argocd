/**
 * Smallest runnable check for the bidding row lock and the shared minimum-bid rule.
 *
 *   npx tsx src/tests/auction-bid-locking.check.ts
 *
 * Drives AuctionService against stubs — no database required.
 *
 * The regression it guards: locking the auction with `relations` loaded made TypeORM
 * emit `FOR UPDATE` against a LEFT JOIN, which Postgres rejects outright with
 * "FOR UPDATE cannot be applied to the nullable side of an outer join" — every bid
 * and every buy-now failed. The lock must be taken on the bare auction row, with
 * relations loaded by a separate query inside the same transaction.
 */
import assert from 'node:assert/strict';
import { AuctionService } from '../modules/auction/auction.service.js';
import { computeMinNextBid } from '../modules/auction/auction-pricing.js';
import auctionWebSocketService from '../modules/auction/auction-websocket.service.js';
import bidHistoryService from '../modules/auction/bid-history.service.js';
import auctionStatusService from '../modules/auction/auction-status.service.js';

// lockAuction and the pricing rule touch none of the injected repositories, so the
// service is built without them rather than wiring a DataSource for this check.
const service = new (AuctionService as any)();

// Wrapped rather than top-level await: the checks transpile to CJS.
async function main() {

// --- the lock statement itself -----------------------------------------------
{
  const queries: string[] = [];
  let findOneOptions: any = null;

  const manager = {
    query: async (sql: string, params: unknown[]) => {
      queries.push(sql);
      assert.deepEqual(params, ['7'], 'the auction id must be bound, never interpolated');
      return [{ id: '7' }];
    },
    findOne: async (_entity: unknown, options: any) => {
      findOneOptions = options;
      return { id: '7', product: { ownerId: '1' } };
    },
  } as any;

  const auction = await service.lockAuction(manager, '7');

  assert.equal(queries.length, 1, 'exactly one locking statement');
  const sql = queries[0]!.toUpperCase();

  assert.ok(sql.includes('FOR UPDATE'), 'the row must actually be locked');
  assert.ok(!sql.includes('JOIN'), 'FOR UPDATE must not be applied over a join — this is the bug');
  assert.ok(!sql.includes('PRODUCT'), 'only the auction row is locked; products stay free for seller edits');

  // Relations still arrive, just from a second statement in the same transaction.
  assert.deepEqual(findOneOptions.relations, { product: true });
  assert.equal(auction.product.ownerId, '1');
}

// --- a missing auction locks nothing and reports absence ----------------------
{
  const manager = {
    query: async () => [],
    findOne: async () => assert.fail('must not load relations when no row was locked'),
  } as any;

  assert.equal(await service.lockAuction(manager, '404'), null);
}

// --- the minimum-bid rule is one rule ----------------------------------------
{
  // decimal columns arrive from the driver as strings; arithmetic must not concatenate
  assert.equal(computeMinNextBid({ currentPrice: '100.00', startingPrice: '50.00', bidIncrement: '10.00' }), 110);

  // before the first bid there is no current price, so the starting price stands in
  assert.equal(computeMinNextBid({ currentPrice: null, startingPrice: '50', bidIncrement: '10' }), 60);
}

// --- watchers are people, not sockets ----------------------------------------
{
  const ws = auctionWebSocketService as any;
  ws.auctionRooms.set('7', new Set(['s1', 's2', 's3']));
  ws.socketUsers.set('s1', 'u1');
  ws.socketUsers.set('s2', 'u1'); // same person, second tab
  // s3 stays anonymous

  assert.equal(ws.getWatcherCount('7'), 2, 'one logged-in user with two tabs plus one guest');
  assert.equal(ws.getWatcherCount('nobody-here'), 0);
}

// --- buy-now is recorded in the bid history, after the transaction commits ----
{
  const events: string[] = [];
  let logged: unknown[] = [];

  (service as any).dataSource = {
    transaction: async (run: (m: any) => Promise<unknown>) => {
      const manager = {
        findOne: async (_entity: unknown, options: any) => {
          // Entity property names, not column names: `user_id`/`is_default` made
          // TypeORM reject the query and broke buy-now for every user.
          assert.deepEqual(Object.keys(options.where).sort(), ['isDefault', 'userId']);
          return { id: 'addr-1' };
        },
        save: async () => undefined,
        create: (_entity: unknown, data: any) => data,
      };
      const order = await run(manager as any);
      events.push('commit');
      return order;
    },
  };
  (service as any).lockAuction = async () => ({
    id: '7', buyNowPrice: '250.00', status: 'happening', product: { ownerId: 'seller' },
  });

  const original = bidHistoryService.logBuyNow;
  (bidHistoryService as any).logBuyNow = async (...args: unknown[]) => {
    events.push('log');
    logged = args;
    return null;
  };

  const originalFinalize = auctionStatusService.finalizeEndedAuction;
  let finalized: unknown[] = [];
  (auctionStatusService as any).finalizeEndedAuction = async (...args: unknown[]) => {
    events.push('finalize');
    finalized = args;
  };

  try {
    await service.buyNow('7', 'buyer');
  } finally {
    (bidHistoryService as any).logBuyNow = original;
    (auctionStatusService as any).finalizeEndedAuction = originalFinalize;
  }

  // The buyer must already own a bid_history row when finalize ranks the participants,
  // otherwise logAuctionEnded would write them a 'lost' row for the auction they bought.
  assert.deepEqual(finalized, ['7', 'buyer'], 'the buy-now buyer is the winner passed to finalize');

  assert.deepEqual(
    events,
    ['commit', 'log', 'finalize'],
    'logging and finalizing must not run inside the locking transaction, and the buy-now row must precede finalize',
  );
  assert.deepEqual(logged, ['buyer', '7', 250], 'buy-now price is logged as a number, not a decimal string');
}

// --- buy-now never sells below what the auction was already bid to ------------
{
  (service as any).lockAuction = async () => ({
    id: '7', buyNowPrice: '250.00', currentPrice: '300.00', status: 'happening',
    product: { ownerId: 'seller' },
  });

  await assert.rejects(
    () => service.buyNow('7', 'buyer'),
    /BUY_NOW_PRICE_EXCEEDED/,
    'bidding past the buy-now price makes the offer stale',
  );
}

console.log('✅ auction bid locking, minimum-bid rule, watcher counting and buy-now logging hold');

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
