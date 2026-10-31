/**
 * Smallest runnable check for the two shared utils under src/common/util.
 *
 *   npx tsx src/tests/common-util.check.ts
 *
 * Drives webSocketHelper against a stub Socket.IO server and VNTimeUtils against
 * fixed dates — no database, no real sockets. It fails if broadcast deduplication
 * stops suppressing repeats, if the emit payload loses its enriched fields, or if
 * the Vietnam-timezone maths drifts.
 */
import assert from 'node:assert/strict';
import helper from '../common/util/webSocketHelper.js';
import VNTimeUtils from '../common/util/vnTimezone.js';
import { validationMiddlewares } from '../middlewares/validation.middleware.js';

interface Emit {
  room: string;
  event: string;
  data: any;
}

function makeIo() {
  const emits: Emit[] = [];
  const joined: string[] = [];
  const left: string[] = [];

  const socket = {
    join: (room: string) => joined.push(room),
    leave: (room: string) => left.push(room),
  };

  const io = {
    to: (room: string) => ({ emit: (event: string, data: any) => emits.push({ room, event, data }) }),
    emit: (event: string, data: any) => emits.push({ room: '<global>', event, data }),
    sockets: { sockets: new Map([['sock1', socket]]) },
  } as any;

  return { io, emits, joined, left };
}

const cases = [
  {
    name: 'safeJoinRoom / safeLeaveRoom act on the real socket',
    run: async () => {
      const { io, joined, left } = makeIo();

      assert.equal(helper.safeJoinRoom(io, 'sock1', 'room_a', 'u1', 'Test'), true);
      assert.deepEqual(joined, ['room_a']);

      assert.equal(helper.safeLeaveRoom(io, 'sock1', 'room_a', 'u1', 'Test'), true);
      assert.deepEqual(left, ['room_a']);

      assert.equal(
        helper.safeJoinRoom(io, 'unknown-socket', 'room_a', null, 'Test'),
        false,
        'an unknown socket id must not be treated as a successful join',
      );
    },
  },
  {
    name: 'broadcast payload keeps ids and gains server metadata',
    run: async () => {
      const { io, emits } = makeIo();

      const sent = helper.safeBroadcastToRoom(io, 'room_a', 'evt', {
        messageId: 'm1',
        chatId: 'c1',
        senderId: 'u1',
        message: 'hello',
      });

      assert.equal(sent, true);
      assert.equal(emits.length, 1);
      assert.equal(emits[0].room, 'room_a');
      assert.equal(emits[0].event, 'evt');
      assert.equal(emits[0].data.messageId, 'm1');
      assert.equal(emits[0].data.senderType, 'user', 'senderType defaults to user');
      assert.equal(typeof emits[0].data.serverTime, 'number');
      assert.equal(typeof emits[0].data.timestamp, 'string');
    },
  },
  {
    name: 'the same message is not broadcast twice',
    run: async () => {
      const { io, emits } = makeIo();

      // serverTime is part of the dedup key, so pin the clock to make the second
      // call a genuine repeat rather than a new message.
      const realNow = Date.now;
      const frozen = realNow();
      Date.now = () => frozen;

      try {
        assert.equal(helper.safeBroadcastToRoom(io, 'room_a', 'dup_evt', { messageId: 'dup1' }), true);
        assert.equal(
          helper.safeBroadcastToRoom(io, 'room_a', 'dup_evt', { messageId: 'dup1' }),
          false,
          'a repeat inside the TTL must be suppressed',
        );
        assert.equal(emits.length, 1, 'only one emit may reach Socket.IO');

        assert.equal(
          helper.safeBroadcastToRoom(io, 'room_a', 'dup_evt', { messageId: 'dup2' }),
          true,
          'a different message must still go out',
        );
      } finally {
        Date.now = realNow;
      }
    },
  },
  {
    name: 'named wrappers target the right rooms',
    run: async () => {
      const chat = makeIo();
      helper.broadcastChatMessage(chat.io, 'conv1', { messageId: 'c-1' });
      assert.equal(chat.emits[0].room, 'conversation_conv1');
      assert.equal(chat.emits[0].event, 'getMessage');

      const support = makeIo();
      assert.equal(
        helper.broadcastSupportMessage(support.io, { messageId: 's-1', chatId: 'c9', receiverId: 'u2' }),
        true,
      );
      assert.ok(support.emits.some((e) => e.room === 'support_chat_c9' && e.event === 'new_support_message'));
      assert.ok(support.emits.some((e) => e.room === 'user_u2_support'));

      assert.equal(
        helper.broadcastSupportMessage(support.io, { messageId: 'x' }),
        false,
        'a support message without a chatId has no room to go to',
      );

      const admin = makeIo();
      helper.notifyAdmins(admin.io, { hello: 'admins' });
      assert.ok(admin.emits.some((e) => e.room === 'admin_room'));
      assert.ok(admin.emits.some((e) => e.room === 'admin_notifications'));
    },
  },
  {
    name: 'validateSocketParams rejects missing ids',
    run: async () => {
      assert.throws(() => helper.validateSocketParams('', 'u1', 'test op'), /Socket ID required/);
      assert.throws(() => helper.validateSocketParams('s1', '', 'test op'), /User ID required/);
      assert.equal(helper.validateSocketParams('s1', 'u1'), true);
    },
  },
  {
    name: 'VNTimeUtils reports Vietnam time and remaining milliseconds',
    run: async () => {
      assert.equal(VNTimeUtils.getVNTimezoneOffset(), '+07:00');
      assert.equal(VNTimeUtils.getCurrentVNTime().utcOffset(), 7 * 60);

      const inOneHour = new Date(Date.now() + 3600_000);
      const remaining = VNTimeUtils.calculateTimeRemaining(inOneHour);
      assert.equal(typeof remaining, 'number', 'must return milliseconds, not an object');
      assert.ok(remaining > 3590_000 && remaining <= 3600_000, `unexpected remaining: ${remaining}`);

      const past = new Date(Date.now() - 60_000);
      assert.ok(VNTimeUtils.calculateTimeRemaining(past) < 0, 'a past date is negative');
    },
  },
  {
    name: 'VNTimeUtils formats countdowns and derives end dates',
    run: async () => {
      assert.equal(VNTimeUtils.formatTimeRemaining(0), '00:00:00');
      assert.equal(VNTimeUtils.formatTimeRemaining(-5000), '00:00:00');
      assert.equal(VNTimeUtils.formatTimeRemaining(3_661_000), '01:01:01');
      assert.equal(VNTimeUtils.formatTimeRemaining(90_061_000), '1 ngày 01:01:01');

      const start = new Date('2026-08-13T00:00:00Z');
      const end = VNTimeUtils.createEndDateFromDuration(start, 3);
      assert.equal(end.getTime() - start.getTime(), 3 * 24 * 3600_000);

      const later = VNTimeUtils.addToCurrentVNTime(2, 'hours');
      assert.ok(later.getTime() - Date.now() > 7_100_000);
    },
  },
  {
    name: 'validatePagination preserves query filters and converts page/limit to number',
    run: async () => {
      const req: any = {
        query: {
          page: '1',
          limit: '5',
          type: 'topup_success',
          status: 'open',
        },
      };
      const res: any = {
        status: () => res,
        json: () => res,
      };
      let nextCalled = false;
      validationMiddlewares.validatePagination(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.query.page, 1);
      assert.equal(typeof req.query.page, 'number');
      assert.equal(req.query.limit, 5);
      assert.equal(typeof req.query.limit, 'number');
      assert.equal(req.query.type, 'topup_success');
      assert.equal(req.query.status, 'open');
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
