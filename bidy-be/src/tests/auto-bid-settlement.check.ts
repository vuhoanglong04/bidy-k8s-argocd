/**
 * Smallest runnable check for proxy-bid settlement.
 *
 * The project has no TS test transform configured for jest, so this runs standalone:
 *   npx tsx src/tests/auto-bid-settlement.check.ts
 *
 * It drives AuctionService.resolveAutoBids against an in-memory EntityManager stub —
 * no database required. It fails if the "highest ceiling wins at one increment over
 * the runner-up, ties to the older config" rule ever regresses.
 */
import assert from 'node:assert/strict';
import { AuctionService } from '../modules/auction/auction.service.js';
import { AutoBidConfig } from '../modules/auction/entity/auto-bid-config.entity.js';

const INCREMENT = 10;

function makeConfig(userId: string, limitBid: number): AutoBidConfig {
  return { id: `cfg-${userId}`, userId, limitBid, isActive: true } as AutoBidConfig;
}

/** Minimal EntityManager surface that resolveAutoBids actually touches. */
function makeManager(rival: AutoBidConfig | null) {
  const saved: unknown[] = [];

  const chain: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'getOne') return async () => rival;
      if (prop === 'execute') return async () => ({ affected: 0 });
      return () => chain;
    },
  });

  return {
    saved,
    manager: {
      getRepository: () => ({ createQueryBuilder: () => chain }),
      create: (_entity: unknown, data: any) => data,
      save: async (_entity: unknown, data: any) => {
        saved.push(data);
        return data;
      },
    } as any,
  };
}

async function settle(opts: {
  rival: AutoBidConfig | null;
  own: AutoBidConfig | null;
  amount: number;
}) {
  const service = new AuctionService(null as any, null as any, null as any, null as any, null as any, null as any, null as any);
  const { manager } = makeManager(opts.rival);
  const auction = { id: 'auction-1', bidIncrement: INCREMENT } as any;

  return await (service as any).resolveAutoBids(manager, auction, 'challenger', opts.amount, opts.own);
}

const cases: { name: string; run: () => Promise<void> }[] = [
  {
    name: 'no rival proxy — challenger keeps their own bid',
    run: async () => {
      const r = await settle({ rival: null, own: null, amount: 30 });
      assert.equal(r.price, 30);
      assert.equal(r.leaderId, 'challenger');
      assert.equal(r.autoBid, null);
    },
  },
  {
    name: 'rival ceiling below the bid cannot counter',
    run: async () => {
      const r = await settle({ rival: makeConfig('rival', 25), own: null, amount: 30 });
      assert.equal(r.price, 30);
      assert.equal(r.leaderId, 'challenger');
    },
  },
  {
    name: 'rival proxy counters one increment above an unarmed challenger',
    run: async () => {
      const r = await settle({ rival: makeConfig('rival', 50), own: null, amount: 30 });
      assert.equal(r.price, 40); // min(50, 30 + 10)
      assert.equal(r.leaderId, 'rival');
      assert.equal(r.autoBid.actionType, 'auto_bid');
    },
  },
  {
    name: 'rival proxy is capped by its own ceiling',
    run: async () => {
      const r = await settle({ rival: makeConfig('rival', 35), own: null, amount: 30 });
      assert.equal(r.price, 35); // min(35, 40)
      assert.equal(r.leaderId, 'rival');
    },
  },
  {
    name: 'challenger proxy with the higher ceiling defends and leads',
    run: async () => {
      const r = await settle({ rival: makeConfig('rival', 50), own: makeConfig('challenger', 100), amount: 30 });
      assert.equal(r.price, 60); // min(100, 50 + 10)
      assert.equal(r.leaderId, 'challenger');
    },
  },
  {
    name: 'equal ceilings go to the older (rival) config',
    run: async () => {
      const r = await settle({ rival: makeConfig('rival', 100), own: makeConfig('challenger', 100), amount: 30 });
      assert.equal(r.price, 100); // min(100, 100 + 10)
      assert.equal(r.leaderId, 'rival');
    },
  },
];

async function main() {
  let failed = 0;
  for (const c of cases) {
    try {
      await c.run();
      console.log(`  ok   ${c.name}`);
    } catch (error: any) {
      failed++;
      console.error(`  FAIL ${c.name}\n       ${error.message}`);
    }
  }

  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
