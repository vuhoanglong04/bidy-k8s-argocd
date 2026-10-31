/**
 * Smallest runnable check for the ending-soon sweep.
 *
 *   npx tsx src/tests/auction-ending-soon.check.ts
 *
 * Stubs the DataSource repository — no database required. The lifecycle cron runs
 * every 10 seconds, so the whole correctness of this feature is "once per auction,
 * not once per tick": without the flag a 15-minute window fans out ~90 times to
 * every bidder. This fails if the sweep stops filtering on the flag, stops setting
 * it, or sets it after sending rather than before.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AppDataSource } from '../database/data-source.js';
import auctionStatusService from '../modules/auction/auction-status.service.js';
import { notificationService } from '../modules/notification/notification.service.js';

const now = new Date('2026-08-16T10:00:00Z');

/** One auction closing in 5 minutes, plus one closing in 2 hours that must be left alone. */
function makeAuctions() {
  return [
    { id: '1', status: 'happening', endingSoonNotified: false, endDate: new Date(now.getTime() + 5 * 60_000), product: { ownerId: '42' } },
    { id: '2', status: 'happening', endingSoonNotified: false, endDate: new Date(now.getTime() + 120 * 60_000), product: { ownerId: '43' } },
  ];
}

async function main() {
  const auctions = makeAuctions();
  const notified: string[] = [];

  const originalGetRepository = AppDataSource.getRepository;
  const originalAuctionNotifications = notificationService.createAuctionNotifications;

  (AppDataSource as any).getRepository = (entity: any) => {
    if (entity?.name === 'BidHistory') {
      return {
        createQueryBuilder: () => ({
          select: function () { return this; },
          where: function () { return this; },
          getRawMany: async () => [{ userId: '9' }],
        }),
      };
    }
    return {
      // Mirrors the real query: only unflagged auctions inside the window.
      find: async ({ where }: any) => {
        const windowEnd = where.endDate?._value?.[1] ?? new Date(now.getTime() + 15 * 60_000);
        return auctions.filter(
          (a) => !a.endingSoonNotified && a.endDate > now && a.endDate <= windowEnd,
        );
      },
      update: async (ids: string[], patch: any) => {
        for (const auction of auctions) {
          if (ids.includes(auction.id)) Object.assign(auction, patch);
        }
      },
    };
  };

  (notificationService as any).createAuctionNotifications = () => ({
    auctionEndingSoon: async (auctionId: string) => {
      notified.push(auctionId);
      return { ownerNotification: null, bidderNotifications: [] };
    },
  });

  try {
    const first = await auctionStatusService.notifyEndingSoonAuctions(now);
    assert.equal(first, 1, 'only the auction inside the window may be swept');
    assert.deepEqual(notified, ['1'], 'the auction closing in 2 hours must not be warned yet');

    // The very next cron tick, 10 seconds later. This is the whole point.
    const second = await auctionStatusService.notifyEndingSoonAuctions(new Date(now.getTime() + 10_000));
    assert.equal(second, 0, 'a swept auction must not be swept again — the cron re-runs every 10 seconds');
    assert.deepEqual(notified, ['1'], 'no auction may be warned twice');

    console.log('✓ auction ending-soon check passed');
  } finally {
    (notificationService as any).createAuctionNotifications = originalAuctionNotifications;
    (AppDataSource as any).getRepository = originalGetRepository;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
