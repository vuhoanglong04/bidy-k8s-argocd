/**
 * Smallest runnable check for support-chat message sending.
 *
 *   npx tsx src/tests/support-chat-send.check.ts
 *
 * Stubs the DataSource repository and the websocket service — no database or socket
 * server required. It fails if a stored message stops being broadcast (the other
 * side then sees nothing until a reload), if clientMessageId stops being echoed
 * (senders can then only reconcile optimistic bubbles by guessing at content), if
 * ticket ownership stops being enforced for a requester, or if a participant's full
 * User row starts reaching the counterpart again.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AppDataSource } from '../database/data-source.js';
import supportService from '../modules/support-chat/support.service.js';
import supportChatWebSocketService from '../modules/support-chat/support-chat-websocket.service.js';

/** Ticket 500 belongs to user 7, and to nobody else. */
function stubRepositories() {
  const original = AppDataSource.getRepository;
  (AppDataSource as any).getRepository = () => ({
    findOne: async ({ where }: any) =>
      where.id === '500' ? { id: '500', userId: '7', status: 'open' } : null,
    create: (row: any) => ({ ...row, id: '900', createdAt: new Date('2026-08-16T00:00:00Z') }),
    save: async (row: any) => row,
  });
  return () => {
    (AppDataSource as any).getRepository = original;
  };
}

function stubBroadcast() {
  const sent: any[] = [];
  const original = supportChatWebSocketService.broadcastSupportMessage;
  (supportChatWebSocketService as any).broadcastSupportMessage = (data: any) => {
    sent.push(data);
    return true;
  };
  return {
    sent,
    restore: () => {
      (supportChatWebSocketService as any).broadcastSupportMessage = original;
    },
  };
}

async function main() {
  const restoreRepos = stubRepositories();
  const broadcast = stubBroadcast();

  try {
    // The owner sends, and the message is both stored and announced.
    const msg = await supportService.sendMessage({
      ticketId: '500',
      senderId: '7',
      content: 'hello',
      requesterId: '7',
      clientMessageId: 'tmp-abc',
    });

    assert.equal(msg.id, '900', 'the stored message must be returned');
    assert.equal(broadcast.sent.length, 1, 'a stored message must be broadcast, or the other side sees nothing until a reload');
    assert.equal(broadcast.sent[0].chatId, '500');
    assert.equal(broadcast.sent[0].messageId, '900');
    assert.equal(
      broadcast.sent[0].clientMessageId,
      'tmp-abc',
      'clientMessageId must be echoed back untouched so the sender can reconcile its optimistic bubble',
    );

    // A different user who knows the ticket id is refused.
    await assert.rejects(
      () => supportService.sendMessage({
        ticketId: '500',
        senderId: '99',
        content: 'intruding',
        requesterId: '99',
      }),
      /TICKET_NOT_FOUND/,
      'a non-owner must not be able to post into someone else\'s ticket by guessing its id',
    );
    assert.equal(broadcast.sent.length, 1, 'a refused send must not broadcast anything');

    // senderType is derived from the ticket, not from whoever is listening. A client
    // deciding "senderId === myId ? mine : theirs" gets a second admin replying to the
    // same ticket wrong, and a client could otherwise just claim to be the admin.
    assert.equal(broadcast.sent[0].senderType, 'user', 'the ticket owner sends as user');

    // Admin paths pass no requesterId on purpose: admins reply to every ticket.
    await supportService.sendMessage({ ticketId: '500', senderId: '1', content: 'admin reply' });
    assert.equal(broadcast.sent.length, 2, 'an admin reply must still broadcast');
    assert.equal(broadcast.sent[1].clientMessageId, null, 'a send without clientMessageId echoes null');
    assert.equal(broadcast.sent[1].senderType, 'admin', 'anyone who is not the ticket owner sends as admin');

    // A second admin, not the one on the ticket, is still an admin to the reader.
    await supportService.sendMessage({ ticketId: '500', senderId: '2', content: 'other admin' });
    assert.equal(broadcast.sent[2].senderType, 'admin', 'a second admin must not be mislabelled as the user');

    // A message cannot be attached to a ticket that does not exist, even on the admin
    // path that skips the ownership check — that produced rows no conversation shows.
    await assert.rejects(
      () => supportService.sendMessage({ ticketId: '404', senderId: '1', content: 'orphan' }),
      /TICKET_NOT_FOUND/,
      'an admin send to a nonexistent ticket must be refused',
    );
    assert.equal(broadcast.sent.length, 3, 'a refused send must not broadcast anything');

    // Reading a chat must not hand the counterpart the other participant's account
    // row. The admin the user is talking to is a real person with an email address.
    const SECRETS = ['admin@internal.example', 'banned for fraud'];
    const adminRow = {
      id: '1',
      username: 'support',
      fullname: 'Support Desk',
      email: SECRETS[0],
      statusReason: SECRETS[1],
      accountLocked: false,
      avatarFile: { id: '3', s3Key: 'avatars/admin.png' },
    };

    (AppDataSource as any).getRepository = () => ({
      findOne: async () => ({
        id: '500',
        userId: '7',
        status: 'open',
        user: { ...adminRow, id: '7' },
        admin: adminRow,
        messages: [{ id: '900', content: 'hi', sender: adminRow }],
      }),
      findAndCount: async () => [[{ id: '900', content: 'hi', sender: adminRow }], 1],
    });

    const strings = (value: unknown, out: string[] = []): string[] => {
      if (typeof value === 'string') out.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
      return out;
    };

    // my-chat seeds a client's message list, so it must be bounded and ordered. It used
    // to read a `messages` relation with no ORDER BY and no limit: rows came back in
    // whatever order Postgres chose (observed newest-first) and a long-running ticket
    // shipped its whole history in one response.
    const seeded: any = await supportService.getUserActiveChat('7');
    assert.equal(seeded.hasMoreMessages, false, 'my-chat must say whether older messages exist');
    assert.equal(seeded.totalMessages, 1);
    assert.ok(seeded.messages[0].senderType, 'seeded messages must carry senderType like every other path');

    for (const [label, payload] of [
      ['my-chat', seeded],
      ['messages', await supportService.getChatMessages('500', 1, 20, '7')],
    ] as const) {
      const found = strings(payload);
      for (const secret of SECRETS) {
        assert.ok(!found.includes(secret), `${label} leaked ${secret} from a participant's User row`);
      }
      assert.ok(found.includes('Support Desk'), `${label} must still carry the display name`);
      // The bucket key must never ship in place of a URL — a client cannot render it.
      assert.ok(!found.includes('avatars/admin.png'), `${label} leaked a raw storage key`);
    }

    // Read state and ticket status must be persisted AND announced by the same call.
    // These were split before: the REST route wrote without broadcasting and the socket
    // event broadcast without writing, so whichever half the client used, the other
    // side was stale until a reload.
    const receipts: any[] = [];
    const statuses: any[] = [];
    const originalReceipt = supportChatWebSocketService.broadcastSupportChatReadReceipt;
    const originalStatus = supportChatWebSocketService.broadcastSupportChatStatusUpdate;
    (supportChatWebSocketService as any).broadcastSupportChatReadReceipt = (chatId: string, userId: string) => {
      receipts.push({ chatId, userId });
      return true;
    };
    (supportChatWebSocketService as any).broadcastSupportChatStatusUpdate = (chatId: string, status: string, adminId: string) => {
      statuses.push({ chatId, status, adminId });
      return true;
    };

    try {
      let updates = 0;
      (AppDataSource as any).getRepository = () => ({
        findOne: async ({ where }: any) =>
          where.id === '500' ? { id: '500', userId: '7', status: 'closed' } : null,
        update: async () => { updates++; return { affected: 1 }; },
      });

      await supportService.markMessagesAsRead('500', '7');
      assert.equal(updates, 1, 'marking as read must persist is_read, not just broadcast');
      assert.deepEqual(receipts, [{ chatId: '500', userId: '7' }], 'persisting read state must also announce it');

      // Admins pass no requesterId, but the receipt still has to name who read it.
      await supportService.markMessagesAsRead('500', undefined, '1');
      assert.equal(receipts.at(-1)?.userId, '1', 'an admin read receipt must carry the admin id');

      // status is a closed vocabulary. It used to accept any string, which mattered
      // because 'open' is what /my-chat looks for and what the one-open-ticket-per-user
      // index is keyed on: a typo hid the ticket from its owner AND let them open a
      // second one. Rejected in the service, not only in the DTO, because the socket
      // event admin_status_update never passes through Express middleware.
      for (const bad of ['clsoed', 'OPEN', 'pending', '']) {
        await assert.rejects(
          () => supportService.updateChatStatus('500', bad, '1'),
          /INVALID_STATUS/,
          `status "${bad}" must be refused`,
        );
      }
      assert.equal(statuses.length, 0, 'a refused status change must not be broadcast');

      // The list filter takes the same vocabulary, so a misspelled filter is an error
      // rather than an empty page that looks like a legitimately empty queue.
      await assert.rejects(
        () => supportService.getAllSupportChats(1, 20, 'nonsense'),
        /INVALID_STATUS/,
        'an unknown status filter must be refused, not silently matched against nothing',
      );

      await supportService.updateChatStatus('500', 'closed', '1');
      assert.deepEqual(
        statuses,
        [{ chatId: '500', status: 'closed', adminId: '1' }],
        'closing a ticket must announce it, or the user sits in a chat the server closed',
      );
    } finally {
      (supportChatWebSocketService as any).broadcastSupportChatReadReceipt = originalReceipt;
      (supportChatWebSocketService as any).broadcastSupportChatStatusUpdate = originalStatus;
    }

    // History must be loadable newest-page-first and must say which side sent each
    // message. A client loading history has no other way to tell the sides apart: the
    // rows carry a senderId, but not the ticket owner to compare it against.
    (AppDataSource as any).getRepository = () => ({
      findOne: async () => ({ id: '500', userId: '7', status: 'open' }),
      findAndCount: async ({ order, skip }: any) => {
        assert.equal(order.createdAt, 'DESC', 'history must page from the recent end, or opening a chat needs the last page number first');
        // Page 3 of 5 with limit 2 is the last page and holds a single row.
        if (skip >= 4) return [[{ id: '9', senderId: '7', createdAt: new Date('2026-08-30T00:00:00Z') }], 5];
        // The repository hands back newest-first; the service reverses within the page.
        return [[
          { id: '11', senderId: '1', createdAt: new Date('2026-09-02T00:00:00Z') },
          { id: '10', senderId: '7', createdAt: new Date('2026-09-01T00:00:00Z') },
        ], 5];
      },
    });

    const history: any = await supportService.getChatMessages('500', 1, 2, '7');
    assert.deepEqual(
      history.messages.map((m: any) => m.id),
      ['10', '11'],
      'rows inside a page must be oldest-first so the caller renders top to bottom',
    );
    assert.equal(history.messages[0].senderType, 'user', 'the ticket owner is the user side');
    assert.equal(history.messages[1].senderType, 'admin', 'anyone else is the admin side');
    assert.equal(history.hasMore, true, '2 of 5 loaded means there is more to scroll to');
    assert.equal((await supportService.getChatMessages('500', 3, 2, '7')).hasMore, false, 'the last page reports no more');

    // The admin list carries two fields the SupportTicket entity does not have. A ticket
    // with no messages yet must report lastMessageAt: null rather than borrowing
    // updatedAt — that column also moves on a status change, so using it sorts a ticket
    // nobody has written in as though it had just been active.
    const originalQuery = AppDataSource.query;
    (AppDataSource as any).getRepository = () => ({
      findAndCount: async () => [[{ id: '500', userId: '7', status: 'open' }, { id: '501', userId: '8', status: 'open' }], 2],
    });
    (AppDataSource as any).query = async (sql: string) => {
      if (sql.includes('GROUP BY t.status')) {
        return [
          { status: 'open', count: 2, unread: 7 },
          { status: 'closed', count: 5, unread: 0 },
        ];
      }
      // Only ticket 500 has messages; 501 was opened and never written in.
      return [{
        ticket_id: '500',
        last_message_id: '900',
        last_message_content: 'hello admin',
        last_message_sender_id: '7',
        last_message_at: new Date('2026-09-01T00:00:00Z'),
        unread_by_admin: 4,
      }];
    };

    try {
      const list: any = await supportService.getAllSupportChats(1, 20);
      const [withMessages, empty] = list.chats;

      assert.equal(withMessages.unreadByAdmin, 4, 'per-ticket unread must come from the aggregate');
      assert.equal(withMessages.lastMessageAt.toISOString(), '2026-09-01T00:00:00.000Z');
      assert.equal(withMessages.lastMessage?.message, 'hello admin', 'per-ticket last message must be populated');
      assert.equal(withMessages.lastMessage?.senderType, 'user', 'senderType of last message must be derived correctly');
      assert.equal(empty.lastMessageAt, null, 'a ticket with no messages has no last activity');
      assert.equal(empty.unreadByAdmin, 0, 'a ticket with no messages has nothing unread');
      assert.equal(empty.lastMessage, null, 'a ticket with no messages has no last message');
      // Counts AND unread totals must describe the whole queue. Summing the page's
      // unreadByAdmin instead is only right while everything fits on one page — here
      // the page holds 2 tickets reporting 4 unread, but the queue has 7.
      assert.deepEqual(
        list.statusCounts,
        { open: { count: 2, unread: 7 }, closed: { count: 5, unread: 0 } },
        'status tiles must cover every ticket, not just the current page',
      );
    } finally {
      (AppDataSource as any).query = originalQuery;
    }

    console.log('✓ support chat send check passed');
  } finally {
    broadcast.restore();
    restoreRepos();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
