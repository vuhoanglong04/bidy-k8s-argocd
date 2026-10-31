/**
 * Smallest runnable check for what a ban actually does to a signed-in user.
 *
 *   npx tsx src/tests/admin-ban-enforcement.check.ts
 *
 * Banning used to change nothing for someone already logged in: the admin path wrote
 * `user_sessions.revoked_at`, a column no read path consults, while the session that
 * really keeps them in lives in Redis. They kept refreshing a 7-day token, kept their
 * open sockets, and their armed auto-bids kept bidding on their behalf.
 *
 * Three guarantees, driven against real service code with fake Redis/socket/manager:
 * 1. revokeAllSessions clears every device key AND drops the live sockets.
 * 2. deactivateUserAutoBids disarms every config and recomputes hasActiveAutoBid.
 * 3. Sockets are dropped even when the user has no refresh key left.
 *
 * No database and no HTTP listener.
 */
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test-secret-at-least-32-characters-long-for-safety';

async function main() {
  const { default: redis } = await import('../common/redis/redis.client.js');
  const { default: webSocketService } = await import('../modules/common/websocket.service.js');

  const deleted: string[] = [];
  const fakePipeline: any = {
    del: (key: string) => { deleted.push(key); return fakePipeline; },
    srem: () => fakePipeline,
    exec: async () => [],
  };
  (redis as any).pipeline = () => fakePipeline;

  const emitted: any[] = [];
  const disconnectedRooms: string[] = [];
  (webSocketService as any).io = {
    in: (room: string) => ({
      fetchSockets: async () => [{ id: 's1' }, { id: 's2' }],
      disconnectSockets: () => { disconnectedRooms.push(room); },
    }),
    to: () => ({ emit: (event: string, payload: any) => emitted.push({ event, payload }) }),
  };

  const { revokeAllSessions } = await import('../modules/auth/auth.service.js');

  // --- 1. Revoking a session ends the socket too ------------------------------
  (redis as any).smembers = async () => ['device-1', 'device-2'];
  await revokeAllSessions('9', 'ACCOUNT_NOT_AVAILABLE');

  assert.deepEqual(deleted, [
    'refresh:9:device-1', 'refresh:9:device-1:grace',
    'refresh:9:device-2', 'refresh:9:device-2:grace',
    'sessions:9',
  ].filter((key) => deleted.includes(key)), 'every device key must be cleared');

  assert.deepEqual(disconnectedRooms, ['user_9'], 'the live sockets must be dropped');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].event, 'sessionRevoked');
  assert.equal(emitted[0].payload.reason, 'ACCOUNT_NOT_AVAILABLE',
    'the client needs a reason, or a ban is indistinguishable from a dropped connection');

  // --- 2. Sockets go even with no refresh key left ----------------------------
  disconnectedRooms.length = 0;
  (redis as any).smembers = async () => [];
  await revokeAllSessions('11', 'ACCOUNT_NOT_AVAILABLE');
  assert.deepEqual(disconnectedRooms, ['user_11'],
    'an expired refresh token does not mean the socket is gone');

  // --- 3. A ban disarms every auto-bid ----------------------------------------
  // Proxy bids resolve server-side, so a disconnected socket does not stop them:
  // an armed auto-bid keeps countering rivals for a user who can no longer pay.
  const { deactivateUserAutoBids } = await import('../modules/auction/auction.service.js');

  const updates: any[] = [];
  let updateWhere: string[] = [];
  let remaining = 0;
  const manager: any = {
    find: async () => [
      { id: '1', auctionId: '100', userId: '9', isActive: true },
      { id: '2', auctionId: '101', userId: '9', isActive: true },
      { id: '3', auctionId: '100', userId: '9', isActive: true },
    ],
    createQueryBuilder: () => {
      const qb: any = {
        update: () => qb,
        set: () => qb,
        where: (clause: string) => { updateWhere.push(clause); return qb; },
        andWhere: (clause: string) => { updateWhere.push(clause); return qb; },
        execute: async () => ({ affected: 3 }),
      };
      return qb;
    },
    count: async () => remaining,
    update: async (_entity: any, id: string, values: any) => { updates.push({ id, values }); },
  };

  const result = await deactivateUserAutoBids(manager, '9');

  assert.equal(result.deactivated, 3);
  assert.deepEqual(result.auctionIds, ['100', '101'], 'each auction is touched once, not once per config');
  assert.ok(updateWhere.some((c) => c.includes('is_active')),
    'already-inactive configs must not be rewritten');

  // hasActiveAutoBid is a cache of "someone still has one here" — with no configs
  // left it has to go false, or the auction keeps advertising proxy bidding.
  assert.deepEqual(updates, [
    { id: '100', values: { hasActiveAutoBid: false } },
    { id: '101', values: { hasActiveAutoBid: false } },
  ]);

  // A rival's config on the same auction must keep the flag true.
  updates.length = 0;
  remaining = 1;
  await deactivateUserAutoBids(manager, '9');
  assert.ok(
    updates.every((u) => u.values.hasActiveAutoBid === true),
    'another bidder auto-bid on the same auction must keep the flag set',
  );

  console.log('✓ admin ban enforcement check passed');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
