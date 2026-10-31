/**
 * Smallest runnable check for the bid notification fan-out.
 *
 *   npx tsx src/tests/bid-notifications.check.ts
 *
 * Stubs the DataSource repository and createNotification — no database required.
 * It fails if bidOutbid or newBidReceived goes back to being a stub, if the outbid
 * notice reaches the wrong person, or if a bidder who is still leading gets told
 * they were outbid.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AppDataSource } from '../database/data-source.js';
import { NotificationType } from '../modules/notification/enum/notification-type.enum.js';
import { NotificationCategory } from '../modules/notification/enum/notification-category.enum.js';
import { NotificationPriority } from '../modules/notification/enum/notification-priority.enum.js';
import { notificationService } from '../modules/notification/notification.service.js';
import webSocketService from '../modules/common/websocket.service.js';
import { fileService } from '../modules/file/file.provider.js';

const auctionRow = {
  id: '1',
  currentPrice: 500,
  endDate: new Date('2026-08-20T00:00:00Z'),
  product: { name: 'E2E Widget', ownerId: '42', images: [{ fileId: '7' }] },
};

async function capture(run: () => Promise<unknown>) {
  const created: any[] = [];
  const originalGetRepository = AppDataSource.getRepository;
  const originalCreate = notificationService.createNotification;

  (AppDataSource as any).getRepository = () => ({ findOne: async () => auctionRow });
  (notificationService as any).createNotification = async (data: any) => {
    created.push(data);
    return data;
  };

  try {
    await run();
  } finally {
    (AppDataSource as any).getRepository = originalGetRepository;
    (notificationService as any).createNotification = originalCreate;
  }
  return created;
}

async function main() {
  const bids = notificationService.createBidNotifications();

  // The person who just lost the lead is told, and told who took it.
  const outbid = await capture(() => bids.bidOutbid('1', '9', 600, '11'));
  assert.equal(outbid.length, 1, 'the previous leader must be notified — this is the loop that brings bidders back');
  assert.equal(outbid[0].recipient, '9', 'the outbid notice must go to the previous leader, not the new one');
  assert.equal(outbid[0].actor, '11', 'the new leader must be recorded as the actor');
  assert.equal(outbid[0].type, NotificationType.BID_OUTBID);
  assert.equal(outbid[0].category, 'bid', 'category must be "bid" — the stats endpoint counts on it');

  // Raising your own bid must not notify you that you were outbid.
  const self = await capture(() => bids.bidOutbid('1', '9', 600, '9'));
  assert.equal(self.length, 0, 'a bidder who outbid themselves must not be told they were outbid');

  // The seller hears about the bid; the bidder does not hear about their own.
  const received = await capture(() => bids.newBidReceived('1', { amount: 600 }, '11'));
  assert.equal(received.length, 1);
  assert.equal(received[0].recipient, '42', 'new-bid notice must go to the auction owner');
  assert.equal(received[0].actor, '11');
  assert.equal(received[0].type, NotificationType.NEW_BID);

  // Auctions closing soon reach the seller and every bidder, once each.
  const closing = await capture(() =>
    notificationService.createAuctionNotifications().auctionEndingSoon('1', 15, ['9', '11', '42']),
  );
  assert.deepEqual(
    closing.map((n) => n.recipient).sort(),
    ['11', '42', '9'],
    'ending-soon must reach the owner and each bidder exactly once, and must not double-notify an owner who also bid',
  );

  // The realtime push and the list endpoint must hand out the same shape. The push
  // emits the row straight from the repository, so without an explicit signing step
  // a notification arrives with an image over REST and without one over the socket.
  const pushed: any[] = [];
  let selectedActorFields: string[] = [];
  const originalGetRepository = AppDataSource.getRepository;
  (AppDataSource as any).getRepository = () => ({
    create: (row: any) => ({ ...row, id: '77' }),
    save: async (row: any) => row,
    createQueryBuilder: () => {
      const row = {
        id: '77',
        recipientId: '9',
        relatedData: { auction: { id: '1', imageFileId: '7' } },
      };
      const builder: any = {
        leftJoin: () => builder,
        addSelect: (fields: string[]) => {
          selectedActorFields = fields;
          return builder;
        },
        where: () => builder,
        getOne: async () => row,
      };
      return builder;
    },
  });
  const originalUrlsByIds = fileService.urlsByIds;
  (fileService as any).urlsByIds = async () => new Map([['7', 'https://signed.example/7.png']]);

  const originalIo = (webSocketService as any).io;
  (webSocketService as any).io = {
    to: () => ({ emit: (_event: string, payload: any) => pushed.push(payload) }),
  };

  try {
    await notificationService.createNotification({ recipient: '9', type: NotificationType.BID_OUTBID });
  } finally {
    (webSocketService as any).io = originalIo;
    (fileService as any).urlsByIds = originalUrlsByIds;
    (AppDataSource as any).getRepository = originalGetRepository;
  }

  assert.equal(pushed.length, 1, 'creating a notification must push it in realtime');
  assert.ok(
    'image' in (pushed[0].relatedData.auction as any),
    'the pushed notification must carry a signed `image`, not just the imageFileId the row stores',
  );

  // The recipient of a bid notification is a stranger to the actor, so the reload
  // must never widen back to the whole User row (email, phone, statusReason).
  assert.deepEqual(
    selectedActorFields,
    ['actor.id', 'actor.username', 'actor.avatarFileId'],
    'the pushed actor must stay narrowed to public fields',
  );

  // getUserNotifications must apply priority, category, and isRead filters to the query builder
  const appliedClauses: Record<string, any> = {};
  (AppDataSource as any).getRepository = () => {
    const builder: any = {
      where: (clause: string, params: any) => {
        appliedClauses[clause] = params;
        return builder;
      },
      leftJoin: () => builder,
      addSelect: () => builder,
      andWhere: (clause: string, params: any) => {
        appliedClauses[clause] = params;
        return builder;
      },
      orderBy: () => builder,
      skip: () => builder,
      take: () => builder,
      getManyAndCount: async () => [[], 0],
    };
    return {
      createQueryBuilder: () => builder,
      count: async () => 0,
    };
  };

  try {
    await notificationService.getUserNotifications('9', {
      priority: NotificationPriority.URGENT,
      category: NotificationCategory.ORDER,
      isRead: false,
    });
  } finally {
    (AppDataSource as any).getRepository = originalGetRepository;
  }

  assert.deepEqual(
    appliedClauses['notification.priority = :priority'],
    { priority: NotificationPriority.URGENT },
    'priority filter must be applied to query builder',
  );
  assert.deepEqual(
    appliedClauses['notification.category = :category'],
    { category: NotificationCategory.ORDER },
    'category filter must be applied to query builder',
  );
  assert.deepEqual(
    appliedClauses['notification.is_read = :isRead'],
    { isRead: false },
    'isRead filter must be applied to query builder',
  );

  console.log('✓ bid notifications check passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
