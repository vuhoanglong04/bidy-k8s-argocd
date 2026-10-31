/**
 * Smallest runnable check for the ticket / conversation / stored-file ownership guards.
 *
 *   npx tsx src/tests/authorization-guards.check.ts
 *
 * These three endpoints all take a resource id straight from the request, and ids
 * are sequential bigints — so without an ownership check any authenticated user can
 * walk the whole table. Each case here corresponds to a fixed IDOR; the test drives
 * the services against in-memory repository stubs, no database required.
 */
import assert from 'node:assert/strict';

import { AppDataSource } from '../database/data-source.js';
import supportService from '../modules/support-chat/support.service.js';
import chatService from '../modules/chat/chat.service.js';
import { FileController } from '../modules/file/file.controller.js';
import { FileService } from '../modules/file/file.service.js';

// Both services resolve their repositories from AppDataSource inside each function
// rather than at import time, so swapping the resolver here is enough to isolate them.
const repositories = new Map<string, any>();

(AppDataSource as any).getRepository = (entity: any) => {
  const name = typeof entity === 'string' ? entity : entity?.name;
  return repositories.get(name) ?? { findOne: async () => null, find: async () => [] };
};

const OWNER = 'u-owner';
const ATTACKER = 'u-attacker';

function setTicket(ticket: any) {
  repositories.set('SupportTicket', {
    findOne: async ({ where }: any) => (ticket && String(ticket.id) === String(where.id) ? ticket : null),
  });
}

function setMembership(members: { conversationId: string; userId: string }[]) {
  repositories.set('ConversationMember', {
    findOne: async ({ where }: any) =>
      members.find(
        (m) =>
          String(m.conversationId) === String(where.conversationId) &&
          String(m.userId) === String(where.userId),
      ) ?? null,
    find: async () => members,
  });
}

// File 1 is a product image (public); file 2 is an avatar (private); file 3 is a withdrawal proof.
const STORED_FILES: Record<string, any> = {
  '1': { id: '1', s3Key: 'products/1/real.jpg', originalName: 'real.jpg', mimeType: 'image/jpeg', sizeBytes: 1 },
  '2': { id: '2', s3Key: 'avatars/private.png', originalName: 'private.png', mimeType: 'image/png', sizeBytes: 1 },
  '3': { id: '3', s3Key: 'withdrawal-proofs/proof.png', originalName: 'proof.png', mimeType: 'image/png', sizeBytes: 1 },
};
const PUBLIC_FILE_IDS = new Set(['1']);
const WITHDRAWAL_REQUESTS: any[] = [
  { id: 'w1', userId: OWNER, proofFileId: '3' },
];

const fileController = new FileController(
  new FileService({
    findOne: async ({ where }: any) => STORED_FILES[String(where.id)] ?? null,
    manager: {
      getRepository: (entity: any) => {
        const name = typeof entity === 'string' ? entity : entity?.name;
        if (name === 'ProductImage') {
          return {
            existsBy: async ({ fileId }: any) => PUBLIC_FILE_IDS.has(String(fileId)),
          };
        }
        if (name === 'WalletWithdrawalRequest') {
          return {
            findOne: async ({ where }: any) =>
              WITHDRAWAL_REQUESTS.find((w) => String(w.proofFileId) === String(where.proofFileId)) ?? null,
          };
        }
        if (name === 'User') {
          return {
            findOne: async ({ where }: any) => {
              if (String(where.id) === 'admin-1') return { id: 'admin-1', role: 'admin' };
              return { id: String(where.id), role: 'user' };
            },
          };
        }
        return { findOne: async () => null, existsBy: async () => false };
      },
    },
  } as any),
);

/** Minimal Express Response surface the file handler actually touches. */
function makeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    set: () => res,
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    json: (body: any) => {
      res.body = body;
      return res;
    },
    redirect: (url: string) => {
      res.statusCode = 302;
      res.body = { url };
      return res;
    },
    get: () => undefined,
  };
  return res;
}

const cases: { name: string; run: () => Promise<void> }[] = [
  {
    name: 'support: a stranger cannot read another user\'s ticket messages',
    run: async () => {
      setTicket({ id: 't1', userId: OWNER });
      await assert.rejects(
        () => supportService.getChatMessages('t1', 1, 20, ATTACKER),
        /TICKET_NOT_FOUND/,
      );
    },
  },
  {
    name: 'support: the ticket owner still can',
    run: async () => {
      setTicket({ id: 't1', userId: OWNER });
      repositories.set('SupportMessage', { findAndCount: async () => [[], 0] });

      const result = await supportService.getChatMessages('t1', 1, 20, OWNER);
      assert.equal(result.totalMessages, 0);
    },
  },
  {
    name: 'support: a stranger cannot post into another user\'s ticket',
    run: async () => {
      setTicket({ id: 't1', userId: OWNER });
      await assert.rejects(
        () =>
          supportService.sendMessage({
            ticketId: 't1',
            senderId: ATTACKER,
            content: 'injected',
            requesterId: ATTACKER,
          }),
        /TICKET_NOT_FOUND/,
      );
    },
  },
  {
    name: 'support: a stranger cannot mark another user\'s ticket read',
    run: async () => {
      setTicket({ id: 't1', userId: OWNER });
      await assert.rejects(
        () => supportService.markMessagesAsRead('t1', ATTACKER),
        /TICKET_NOT_FOUND/,
      );
    },
  },
  {
    name: 'support: admin callers (no requesterId) intentionally bypass the guard',
    run: async () => {
      // Admin routes are gated by isAdmin, so they pass no requesterId.
      setTicket({ id: 't1', userId: OWNER });
      await supportService.assertTicketAccess('t1');
    },
  },
  {
    name: 'support: a missing ticket is indistinguishable from a forbidden one',
    run: async () => {
      // Ids stay unenumerable: both cases surface the same error.
      setTicket(null);
      await assert.rejects(() => supportService.assertTicketAccess('t404', OWNER), /TICKET_NOT_FOUND/);
    },
  },
  {
    name: 'chat: a non-member cannot read a conversation',
    run: async () => {
      setMembership([{ conversationId: 'c1', userId: OWNER }]);
      await assert.rejects(
        () => chatService.getConversationById('c1', ATTACKER),
        /CONVERSATION_NOT_FOUND/,
      );
    },
  },
  {
    name: 'chat: a member still can',
    run: async () => {
      setMembership([{ conversationId: 'c1', userId: OWNER }]);
      repositories.set('Conversation', {
        findOne: async () => ({ id: 'c1', members: [{ user: { id: OWNER, fullname: 'Owner' } }] }),
      });

      const conv = await chatService.getConversationById('c1', OWNER);
      assert.equal(conv.conversationId, 'c1');
    },
  },
  {
    // The endpoint takes a files.id, so the row's existence is the whole gate: an
    // id with no row can never reach getPresignedUrl and therefore can never have
    // an arbitrary bucket key signed on its behalf.
    name: 'files: an unregistered file id is refused, not presigned',
    run: async () => {
      const res = makeRes();
      await fileController.getUrl({ params: { id: '999' }, ip: '::1' } as any, res as any);

      assert.equal(res.statusCode, 404, 'an unknown file id must not be servable');
      assert.equal(res.body?.data?.url, undefined, 'no presigned URL may be handed out');
    },
  },
  {
    name: 'files: a registered file still resolves to a presigned URL',
    run: async () => {
      const res = makeRes();
      await fileController.getUrl({ params: { id: '1' }, idUser: '7', ip: '::1' } as any, res as any);

      assert.equal(res.statusCode, 200);
      assert.ok(res.body?.data?.url, 'a registered file must still be presigned');
      assert.ok(
        !res.body.data.url.includes('secrets'),
        'the signed URL must come from the stored key, not the request',
      );
    },
  },
  {
    // Product images render on pages a logged-out visitor can open, so an expired
    // URL must be recoverable without a token.
    name: 'files: an anonymous caller may re-sign a product image',
    run: async () => {
      const res = makeRes();
      await fileController.getUrl({ params: { id: '1' }, ip: '::1' } as any, res as any);

      assert.equal(res.statusCode, 200, 'a public product image must not require auth');
      assert.ok(res.body?.data?.url, 'the public image must be presigned');
    },
  },
  {
    // The whole point of the conditional gate: reaching the endpoint anonymously
    // must not turn a guessable file id into somebody's avatar.
    name: 'files: an anonymous caller may NOT re-sign a non-public file',
    run: async () => {
      const res = makeRes();
      await fileController.getUrl({ params: { id: '2' }, ip: '::1' } as any, res as any);

      assert.equal(res.statusCode, 404, 'a private file must not be signed for an anonymous caller');
      assert.equal(res.body?.data?.url, undefined, 'no presigned URL may be handed out');
    },
  },
  {
    name: 'files: an authenticated caller may re-sign a non-public file',
    run: async () => {
      const res = makeRes();
      await fileController.getUrl({ params: { id: '2' }, idUser: '7', ip: '::1' } as any, res as any);

      assert.equal(res.statusCode, 200, 'a token must still unlock non-public files');
      assert.ok(res.body?.data?.url);
    },
  },
  {
    name: 'files: withdrawal proof is restricted to withdrawal owner and admin',
    run: async () => {
      // 1. Anonymous caller is refused (404)
      const resAnon = makeRes();
      await fileController.getUrl({ params: { id: '3' }, ip: '::1' } as any, resAnon as any);
      assert.equal(resAnon.statusCode, 404, 'anonymous caller must receive 404 for withdrawal proof');
      assert.equal(resAnon.body?.data?.url, undefined);

      // 2. Non-owner authenticated user is refused (404)
      const resAttacker = makeRes();
      await fileController.getUrl(
        { params: { id: '3' }, idUser: ATTACKER, role: 'user', ip: '::1' } as any,
        resAttacker as any,
      );
      assert.equal(resAttacker.statusCode, 404, 'non-owner user must receive 404 for withdrawal proof');
      assert.equal(resAttacker.body?.data?.url, undefined);

      // 3. Withdrawal owner is allowed (200)
      const resOwner = makeRes();
      await fileController.getUrl(
        { params: { id: '3' }, idUser: OWNER, role: 'user', ip: '::1' } as any,
        resOwner as any,
      );
      assert.equal(resOwner.statusCode, 200, 'withdrawal owner must be allowed to read proof');
      assert.ok(resOwner.body?.data?.url);

      // 4. Admin (with role in token) is allowed (200)
      const resAdmin = makeRes();
      await fileController.getUrl(
        { params: { id: '3' }, idUser: 'admin-1', role: 'admin', ip: '::1' } as any,
        resAdmin as any,
      );
      assert.equal(resAdmin.statusCode, 200, 'admin with role must be allowed to read proof');
      assert.ok(resAdmin.body?.data?.url);

      // 5. Admin (role resolved from DB via idUser) is allowed (200)
      const resAdminDb = makeRes();
      await fileController.getUrl(
        { params: { id: '3' }, idUser: 'admin-1', ip: '::1' } as any,
        resAdminDb as any,
      );
      assert.equal(resAdminDb.statusCode, 200, 'admin resolved from DB must be allowed to read proof');
      assert.ok(resAdminDb.body?.data?.url);
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
