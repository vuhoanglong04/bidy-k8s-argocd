/**
 * Smallest runnable check for the chat socket trust boundary.
 *
 *   npx tsx src/tests/chat-socket-authz.check.ts
 *
 * Stubs the DataSource repository — no database required. It fails if joining a
 * conversation stops verifying membership (any client could then read a stranger's
 * conversation by guessing an id), if conversation activity goes back to being
 * broadcast to every connected socket instead of the participants, or if a
 * per-conversation time window starts dropping messages again.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AppDataSource } from '../database/data-source.js';
import chatWebSocketService from '../modules/chat/chat-websocket.service.js';

const MEMBERS = [{ userId: '7' }, { userId: '8' }];

/** Membership rows exist only for conversation 100, members 7 and 8. */
function stubRepositories() {
  const original = AppDataSource.getRepository;
  (AppDataSource as any).getRepository = () => ({
    findOne: async ({ where }: any) =>
      where.conversationId === '100' && MEMBERS.some((m) => m.userId === where.userId)
        ? { conversationId: where.conversationId, userId: where.userId }
        : null,
    find: async () => MEMBERS,
  });
  return () => {
    (AppDataSource as any).getRepository = original;
  };
}

/** Records what the service emitted, and to which room. */
function stubIo() {
  const joined: string[] = [];
  const emits: { room: string; event: string }[] = [];

  chatWebSocketService.io = {
    sockets: {
      sockets: new Map([
        ['sock-member', { join: (room: string) => joined.push(room), emit: () => {} }],
        ['sock-outsider', { join: (room: string) => joined.push(room), emit: () => {} }],
      ]),
    },
    to: (room: string) => ({ emit: (event: string) => emits.push({ room, event }) }),
    emit: (event: string) => emits.push({ room: '*GLOBAL*', event }),
  };

  return { joined, emits };
}

async function main() {
  const restore = stubRepositories();

  try {
    // A member of conversation 100 gets in.
    let io = stubIo();
    const allowed = await chatWebSocketService.joinConversationRoom('sock-member', '100', '7');
    assert.equal(allowed, true, 'a conversation member must be allowed to join');
    assert.ok(
      io.joined.includes('conversation_100'),
      'an allowed member must actually be joined to the conversation room',
    );

    // A non-member guessing the same id does not.
    io = stubIo();
    const denied = await chatWebSocketService.joinConversationRoom('sock-outsider', '100', '99');
    assert.equal(denied, false, 'a non-member must be denied — knowing the id is not permission');
    assert.equal(io.joined.length, 0, 'a denied user must not be joined to the conversation room');

    // Activity reaches the participants' own rooms, never every connected socket.
    io = stubIo();
    await chatWebSocketService.notifyConversationActivity('100', {
      messageId: '1',
      senderId: '7',
      message: 'private text',
    });

    assert.ok(
      !io.emits.some((e) => e.room === '*GLOBAL*'),
      'conversation activity must never be broadcast globally: it leaks a message preview '
        + 'to every connected user and costs one write per online user per message',
    );
    assert.deepEqual(
      io.emits.map((e) => e.room).sort(),
      ['user_7', 'user_8'],
      'conversation activity must go to exactly the participants',
    );

    // Two messages in immediate succession both reach the room. A 1s per-conversation
    // window used to drop the second: it was written to the database but never
    // delivered, so a fast exchange lost half its turns until the client reloaded.
    io = stubIo();
    const roomEmits: string[] = [];
    chatWebSocketService.io.to = (room: string) => ({
      emit: (event: string) => roomEmits.push(`${room}:${event}`),
    });

    // Distinct messageIds, as createMessage always supplies: the helper's own dedup
    // is keyed on the message identity, which is the correct thing to dedup on.
    chatWebSocketService.broadcastChatMessage({ conversationId: '100', messageId: '1', senderId: '7', message: 'first' });
    chatWebSocketService.broadcastChatMessage({ conversationId: '100', messageId: '2', senderId: '8', message: 'second' });

    assert.equal(
      roomEmits.filter((e) => e === 'conversation_100:getMessage').length,
      2,
      'both messages must be delivered — a time window here silently swallows messages',
    );

    console.log('✓ chat socket authorization check passed');
  } finally {
    restore();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
