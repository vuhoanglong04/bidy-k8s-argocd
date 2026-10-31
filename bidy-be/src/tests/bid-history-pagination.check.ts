/**
 * Guards the paginated bid history.
 *
 *   npx tsx src/tests/bid-history-pagination.check.ts
 *
 * This endpoint used to load a bidder's ENTIRE history in one response and count the
 * stats by filtering that array in JS. Two things had to change together, and either
 * one regressing is silent:
 *
 *  1. The page is a real page — skip/take reach the database, rather than every row
 *     coming back and being sliced afterwards.
 *  2. `stats` still describes the WHOLE history. Counting the loaded page instead
 *     would give numbers that change as the user pages, while still looking right on
 *     page 1 — which is exactly the kind of bug nobody reports.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AppDataSource } from '../database/data-source.js';
import { AuctionStatus } from '../modules/auction/enum/auction-status.enum.js';
import bidHistoryService from '../modules/auction/bid-history.service.js';

const PAGE_ROWS = [
  { id: '1', actionType: 'won', amount: '250000.00', auction: null },
  { id: '2', actionType: 'place_bid', amount: '100000.00', auction: null },
];

let captured: {
  skip?: number;
  take?: number;
  where: string[];
  orderBy?: [string, string];
  params: Record<string, any>;
} = { where: [], params: {} };

function listBuilder() {
  const builder: any = {
    innerJoinAndSelect: () => builder,
    leftJoinAndSelect: () => builder,
    where: (clause: string, params: any) => {
      captured.where.push(clause);
      Object.assign(captured.params, params ?? {});
      return builder;
    },
    andWhere: (clause: string, params: any) => {
      captured.where.push(clause);
      Object.assign(captured.params, params ?? {});
      return builder;
    },
    orderBy: (column: string, direction: string) => {
      captured.orderBy = [column, direction];
      return builder;
    },
    skip: (value: number) => {
      captured.skip = value;
      return builder;
    },
    take: (value: number) => {
      captured.take = value;
      return builder;
    },
    // 57 rows in total, but only this page comes back — the stats below must not be
    // derived from these two rows.
    getManyAndCount: async () => [PAGE_ROWS, 57],
  };
  return builder;
}

function statsBuilder(kind: 'group' | 'active') {
  const builder: any = {
    innerJoin: () => builder,
    select: () => builder,
    addSelect: () => builder,
    where: () => builder,
    andWhere: () => builder,
    groupBy: () => builder,
    getRawMany: async () => [
      { actionType: 'place_bid', count: '40' },
      { actionType: 'won', count: '9' },
      { actionType: 'lost', count: '6' },
      { actionType: 'buy_now', count: '2' },
    ],
    getRawOne: async () => ({ count: '4' }),
  };
  return kind === 'group' ? builder : builder;
}

let builderCalls = 0;
(AppDataSource as any).getRepository = () => ({
  createQueryBuilder: () => {
    builderCalls += 1;
    if (builderCalls === 1) return listBuilder();
    return statsBuilder(builderCalls === 2 ? 'group' : 'active');
  },
});

async function main() {
  const result = await bidHistoryService.getUserHistoryWithStats('30', {
    page: 3,
    limit: 20,
    actionType: 'won',
    auctionStatus: AuctionStatus.HAPPENING,
    sortBy: 'amount',
    sortOrder: 'asc',
  });

  // 1 — paging reaches the database.
  assert.equal(captured.skip, 40, 'page 3 at limit 20 must skip 40 rows in SQL');
  assert.equal(captured.take, 20, 'the page size must reach the query, not a JS slice');
  assert.equal(result.history.length, 2, 'only the page comes back');

  // Postgres returns decimals as strings; the rest of the API returns numbers, so a
  // client would have to special-case this one endpoint.
  assert.equal(result.history[0]!.amount, 250000);
  assert.equal(typeof result.history[0]!.amount, 'number', 'amount must not go out as a string');
  assert.equal(result.totalItems, 57);
  assert.equal(result.page, 3);
  assert.equal(result.limit, 20);

  // 2 — stats cover everything, not the two rows on this page.
  assert.deepEqual(result.stats, {
    total: 57,
    won: 9,
    lost: 6,
    active: 4,
    buy_now: 2,
    place_bid: 40,
    auto_bid: 0,
  });
  assert.notEqual(result.stats.total, result.history.length, 'stats must not describe the page');

  // 3 — the two filters land on their own columns.
  assert.ok(
    captured.where.some((clause) => clause.includes('history.action_type')),
    'actionType filters the bid row',
  );
  assert.ok(
    captured.where.some((clause) => clause.includes('auction.status')),
    'auctionStatus filters the auction, not the bid row',
  );

  // 4 — sorting is whitelisted, never a raw query value in the order clause.
  assert.deepEqual(captured.orderBy, ['history.amount', 'ASC']);

  // 5 — the two filters FE needs for search and date range reach SQL, and an
  // inclusive `dateTo` given as a bare date still covers that whole day. Comparing
  // `<= '2026-09-20'` would silently drop everything placed after midnight.
  captured = { where: [], params: {} };
  builderCalls = 0;
  await bidHistoryService.getUserHistoryWithStats('30', {
    search: 'tóc giả',
    dateFrom: '2026-09-01',
    dateTo: '2026-09-20',
  });
  assert.ok(
    captured.where.some((clause) => clause.includes('product.name ILIKE')),
    'search must filter in SQL, not on the loaded page',
  );
  assert.ok(
    captured.where.some((clause) => clause.includes('history.created_at >=')),
    'dateFrom filters the bid timestamp',
  );
  assert.ok(
    captured.where.some((clause) => clause.includes('history.created_at <')),
    'dateTo is applied as an exclusive upper bound',
  );
  assert.deepEqual(
    captured.params.dateTo,
    new Date('2026-09-21'),
    'a bare dateTo must cover the whole day, not stop at its midnight',
  );
  assert.deepEqual(captured.params.dateFrom, new Date('2026-09-01'));

  captured = { where: [], params: {} };
  builderCalls = 0;
  await bidHistoryService.getUserHistoryWithStats('30', { sortBy: 'position' as any });
  assert.deepEqual(
    captured.orderBy,
    ['history.created_at', 'DESC'],
    'an unsupported sort falls back to createdAt rather than reaching SQL',
  );

  console.log('bid-history-pagination.check OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
