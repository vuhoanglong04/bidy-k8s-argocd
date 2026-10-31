/**
 * Smallest runnable check for automatic suspension expiry.
 *
 *   npx tsx src/tests/suspension-expiry.check.ts
 *
 * suspendUser wrote `suspendedUntil` and nothing ever read it back, so a timed
 * suspension never ended: the account stayed SUSPENDED — unable to log in or
 * refresh — until an admin activated it by hand. This check fails if the job stops
 * lifting expired suspensions, or if it starts lifting things it must not touch:
 * open-ended suspensions, bans, and rows an admin changed under the lock.
 *
 * No database: the repository and the transaction manager are stubbed.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';

async function main() {
  const { AppDataSource } = await import('../database/data-source.js');
  const { AdminUserService } = await import('../modules/admin/admin-user.service.js');
  const { notificationService } = await import('../modules/notification/notification.service.js');
  const { UserStatus } = await import('../modules/user/enum/user.enum.js');

  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 60_000);

  const notified: any[] = [];
  const originalCreate = notificationService.createNotification;
  (notificationService as any).createNotification = async (data: any) => { notified.push(data); return data; };

  const originalGetRepository = AppDataSource.getRepository;
  const originalTransaction = AppDataSource.transaction;

  // One stub, reconfigured per case: the service captures its repository in the
  // constructor, so it must already be the stub by the time it is built.
  let scanned: string[] = [];
  let locked: Record<string, any> = {};
  let saved: any[] = [];
  let whereUsed: any = null;

  (AppDataSource as any).getRepository = () => ({
    find: async (options: any) => { whereUsed = options.where; return scanned.map((id) => ({ id })); },
  });

  (AppDataSource as any).transaction = async (run: any) => run({
    findOne: async (_entity: any, options: any) => locked[options.where.id] ?? null,
    save: async (_entity: any, row: any) => { saved.push(row); return row; },
  });

  function drive(rows: string[], byId: Record<string, any>) {
    scanned = rows;
    locked = byId;
    saved = [];
    return { saved: [] as any[], whereFor: () => whereUsed };
  }

  const service = new AdminUserService();

  try {
    // --- 1. An elapsed suspension is lifted and announced ---------------------
    let harness = drive(['9'], {
      '9': { id: '9', status: UserStatus.SUSPENDED, suspendedUntil: past, statusReason: 'spam' },
    });

    let result = await service.liftExpiredSuspensions();

    assert.equal(result.lifted, 1);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].status, UserStatus.ACTIVE);

    // Left set, the columns would keep describing a suspension that is over — and
    // the next scan would keep finding the same row.
    assert.equal(saved[0].suspendedUntil, null, 'suspendedUntil must be cleared');
    assert.equal(saved[0].statusReason, null, 'statusReason must be cleared');

    assert.equal(notified.length, 1, 'the user must be told their account works again');
    assert.equal(notified[0].recipient, '9');

    // The scan must not sweep in open-ended suspensions: those wait for an admin.
    const where = harness.whereFor();
    assert.equal(where.status, UserStatus.SUSPENDED, 'only SUSPENDED rows, never BANNED');
    assert.ok(where.suspendedUntil, 'the deadline must be part of the query, not filtered in memory');

    // --- 2. Nothing to do is not an error ------------------------------------
    notified.length = 0;
    harness = drive([], {});
    result = await service.liftExpiredSuspensions();
    assert.equal(result.lifted, 0);
    assert.equal(notified.length, 0);

    // --- 3. The locked re-read is authoritative ------------------------------
    // An admin can ban the account between the scan and the lock. Lifting then
    // would silently undo a ban that was decided later.
    notified.length = 0;
    harness = drive(['9', '11', '12'], {
      '9': { id: '9', status: UserStatus.BANNED, suspendedUntil: past },
      '11': { id: '11', status: UserStatus.SUSPENDED, suspendedUntil: future },
      '12': null,
    });

    result = await service.liftExpiredSuspensions();

    assert.equal(result.lifted, 0, 'a banned, a not-yet-expired and a deleted row must all be skipped');
    assert.equal(saved.length, 0);
    assert.equal(notified.length, 0, 'no notification for an account that was not actually reactivated');
  } finally {
    (notificationService as any).createNotification = originalCreate;
    (AppDataSource as any).getRepository = originalGetRepository;
    (AppDataSource as any).transaction = originalTransaction;
  }

  console.log('✓ suspension expiry check passed');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
