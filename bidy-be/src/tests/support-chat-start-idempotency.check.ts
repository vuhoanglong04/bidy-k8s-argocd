/**
 * Smallest runnable check for support-chat start idempotency.
 *
 *   npx tsx src/tests/support-chat-start-idempotency.check.ts
 *
 * Stubs the DataSource repository — no database required. It fails if a user who
 * already has an open ticket gets a second one, or if losing the insert race to a
 * concurrent start surfaces as an error instead of returning the ticket the winner
 * created. The database half of that guarantee is the uq_support_tickets_user_open
 * partial index; this check covers the service half that turns its 23505 into the
 * existing row.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AppDataSource } from '../database/data-source.js';
import supportService from '../modules/support-chat/support.service.js';

const uniqueViolation = () => Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });

async function main() {
  const original = AppDataSource.getRepository;

  try {
    // 1. A user with an open ticket gets that ticket back, and nothing is inserted.
    let saves = 0;
    (AppDataSource as any).getRepository = () => ({
      findOne: async () => ({ id: '500', userId: '7', subject: 'existing', status: 'open' }),
      create: (row: any) => row,
      save: async (row: any) => { saves++; return row; },
    });

    const existing = await supportService.startOrGetUserChat('7', 'a new subject');
    assert.equal(existing.id, '500', 'an open ticket must be reused, not replaced');
    assert.equal(existing.subject, 'existing', 'reusing a ticket must not rewrite its subject');
    assert.equal(saves, 0, 'reusing an open ticket must not insert a second one');

    // 2. No open ticket yet: one is created and returned.
    let created: any = null;
    (AppDataSource as any).getRepository = () => ({
      findOne: async () => created,
      create: (row: any) => ({ ...row, id: '900' }),
      save: async (row: any) => { created = row; return row; },
    });

    const fresh = await supportService.startOrGetUserChat('8', 'help me');
    assert.equal(fresh.id, '900', 'a user with no open ticket must get a new one');
    assert.equal(fresh.status, 'open');

    // 3. The race: this call finds nothing, but by the time it inserts, a concurrent
    // start has already committed the user's open ticket and the index rejects it.
    // The caller must still receive that ticket rather than a 23505 error — otherwise
    // a double-tapped button surfaces as a failure to open a chat.
    let winner: any = null;
    let attempts = 0;
    (AppDataSource as any).getRepository = () => ({
      findOne: async () => winner,
      create: (row: any) => row,
      save: async () => {
        attempts++;
        winner = { id: '501', userId: '9', subject: 'from the winner', status: 'open' };
        throw uniqueViolation();
      },
    });

    const raced = await supportService.startOrGetUserChat('9', 'help me too');
    assert.equal(attempts, 1, 'the insert must be attempted exactly once');
    assert.equal(raced.id, '501', 'losing the race must return the winner\'s ticket, not raise');
    assert.equal(raced.subject, 'from the winner');

    // 4. Any other database failure is a real error and must not be mistaken for a race.
    (AppDataSource as any).getRepository = () => ({
      findOne: async () => null,
      create: (row: any) => row,
      save: async () => { throw Object.assign(new Error('connection terminated'), { code: '08006' }); },
    });

    await assert.rejects(
      () => supportService.startOrGetUserChat('10', 'help'),
      /connection terminated/,
      'a non-unique-violation failure must propagate, not be swallowed into a lookup',
    );

    console.log('✓ support chat start idempotency check passed');
  } finally {
    (AppDataSource as any).getRepository = original;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
