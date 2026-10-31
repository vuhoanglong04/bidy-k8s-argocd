/**
 * Smallest runnable check for auction-ended notification fan-out.
 *
 *   npx tsx src/tests/auction-ended-notifications.check.ts
 *
 * Stubs the DataSource repository and createNotification — no database required.
 * It fails if auctionEnded goes back to being a stub, stops notifying every
 * participant, or stops distinguishing the winner from the losers.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AppDataSource } from '../database/data-source.js';
import { NotificationType } from '../modules/notification/enum/notification-type.enum.js';
import { NotificationPriority } from '../modules/notification/enum/notification-priority.enum.js';
import { notificationService } from '../modules/notification/notification.service.js';

const auctionRow = {
  id: '1',
  currentPrice: 500,
  endDate: new Date('2026-08-13T00:00:00Z'),
  product: { name: 'E2E Widget', images: [{ imageUrl: 'https://cdn.test/img.png' }] },
};

const participants = [
  { userId: '9', amount: 500 },
  { userId: '11', amount: 400 },
  { userId: '12', amount: 300 },
];

async function runAuctionEnded(winnerId: string | null) {
  const created: any[] = [];

  const originalGetRepository = AppDataSource.getRepository;
  const originalCreateNotification = notificationService.createNotification;

  (AppDataSource as any).getRepository = () => ({
    findOne: async () => auctionRow,
  });
  (notificationService as any).createNotification = async (data: any) => {
    created.push(data);
    return data;
  };

  try {
    await notificationService
      .createAuctionNotifications()
      .auctionEnded(auctionRow.id, winnerId, participants);
  } finally {
    (AppDataSource as any).getRepository = originalGetRepository;
    (notificationService as any).createNotification = originalCreateNotification;
  }

  return created;
}

const cases = [
  {
    name: 'every participant is notified, winner gets auction_won',
    run: async () => {
      const created = await runAuctionEnded('9');

      assert.equal(created.length, 3, 'one notification per participant');

      const byRecipient = new Map(created.map((n) => [String(n.recipient), n]));

      assert.equal(byRecipient.get('9').type, NotificationType.AUCTION_WON);
      assert.equal(byRecipient.get('9').priority, NotificationPriority.HIGH);
      assert.equal(byRecipient.get('11').type, NotificationType.AUCTION_LOST);
      assert.equal(byRecipient.get('12').type, NotificationType.AUCTION_LOST);

      assert.equal(
        created.filter((n) => n.type === NotificationType.AUCTION_WON).length,
        1,
        'exactly one winner notification',
      );
    },
  },
  {
    name: 'each notification carries the recipient own bid',
    run: async () => {
      const created = await runAuctionEnded('9');
      const loser = created.find((n) => String(n.recipient) === '11');

      assert.equal(loser.relatedData.yourBid, 400, 'loser sees their own bid amount');
      assert.equal(loser.relatedData.auction.name, 'E2E Widget');
    },
  },
  {
    name: 'no winner means everyone is notified as a loser',
    run: async () => {
      const created = await runAuctionEnded(null);

      assert.equal(created.length, 3);
      assert.equal(
        created.filter((n) => n.type === NotificationType.AUCTION_WON).length,
        0,
        'a reserve-not-met auction must not invent a winner',
      );
    },
  },
  {
    name: 'no participants means no notifications and no auction lookup',
    run: async () => {
      const created: any[] = [];
      const originalGetRepository = AppDataSource.getRepository;
      const originalCreateNotification = notificationService.createNotification;

      let lookups = 0;
      (AppDataSource as any).getRepository = () => {
        lookups++;
        return { findOne: async () => auctionRow };
      };
      (notificationService as any).createNotification = async (data: any) => {
        created.push(data);
        return data;
      };

      try {
        await notificationService.createAuctionNotifications().auctionEnded('1', null, []);
      } finally {
        (AppDataSource as any).getRepository = originalGetRepository;
        (notificationService as any).createNotification = originalCreateNotification;
      }

      assert.equal(created.length, 0);
      assert.equal(lookups, 0, 'must short-circuit before querying the auction');
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
