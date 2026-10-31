import 'reflect-metadata';
import assert from 'node:assert/strict';

import { dtoValidationMiddleware } from '../middlewares/dto-validation.middleware.js';
import { RegisterDto } from '../modules/auth/dtos/auth.dto.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { AUTH_MESSAGE } from '../common/messages/auth/auth.message.js';

const validate = dtoValidationMiddleware(RegisterDto);

/** Returns the middleware's outcome: 'next' when the body passed validation. */
async function run(body: unknown): Promise<{ status: number | 'next'; errors: string[] }> {
  let status: number | 'next' = 'next';
  let errors: string[] = [];

  const req = { body } as any;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: any) {
      errors = payload?.error_code?.errors ?? [];
      return this;
    },
  } as any;

  await validate(req, res, () => {
    status = 'next';
  });

  return { status, errors };
}

async function main() {
  // The payload the signup form actually sends must keep working.
  const ok = await run({
    userName: 'johndoe',
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '0912345678',
    identity: '123456789',
    password: 'Abc12345',
  });
  assert.equal(ok.status, 'next', `valid signup payload was rejected: ${ok.errors.join(', ')}`);

  // Previously crashed inside the service with "Cannot read properties of undefined".
  const noEmail = await run({ userName: 'johndoe', fullName: 'John Doe', password: '123456' });
  assert.equal(noEmail.status, 400);
  assert.ok(
    noEmail.errors.some((e) => e.includes('email')),
    'missing email should be reported as a validation error',
  );

  // Previously saved a user with fullname = NULL.
  const snakeCase = await run({
    userName: 'johndoe',
    full_name: 'John Doe',
    email: 'john@example.com',
    password: '123456',
  });
  assert.equal(snakeCase.status, 400);
  assert.ok(
    snakeCase.errors.some((e) => e.includes('full_name')),
    'unknown property full_name should be rejected, not silently dropped',
  );

  // A username is published — the auction bidder list is a public endpoint — so an
  // email address must never be accepted as one. Registration used to take any
  // string, which quietly exposed the address of anyone who filled the wrong box.
  const emailAsUsername = await run({
    userName: 'quynhpn.lcdmkt@gmail.com',
    fullName: 'John Doe',
    email: 'quynhpn.lcdmkt@gmail.com',
    password: 'Abc12345',
  });
  assert.equal(emailAsUsername.status, 400, 'an email address must not be accepted as a username');
  assert.ok(
    emailAsUsername.errors.some((e) => e.toLowerCase().includes('username')),
    'the rejection should name the username field',
  );

  // The dot/underscore/hyphen names already in the table must keep validating,
  // or the rule would lock existing users out of their own profile updates.
  for (const userName of ['quynhpn.lcdmkt', 'seed_seller', 'net23145', 'a-b_c.d']) {
    const legit = await run({ userName, fullName: 'John Doe', email: 'john@example.com', password: 'Abc12345' });
    assert.equal(legit.status, 'next', `"${userName}" should be a valid username: ${legit.errors.join(', ')}`);
  }

  await checkDuplicateMapping();

  console.log('register validation: ok');
  // auth.service opens a redis client at import time, so the process would
  // otherwise hang on that handle instead of ending the check.
  process.exit(0);
}

/** The pg driver shape TypeORM rethrows for a unique violation. */
function uniqueViolation(column: string, value: string) {
  return Object.assign(
    new Error(`duplicate key value violates unique constraint "UQ_${column}_hash"`),
    { code: '23505', detail: `Key (${column})=(${value}) already exists.` },
  );
}

/**
 * register() now writes the user and its wallet in one transaction, so the stub has to
 * offer a manager rather than a bare save(). `failOn` picks which entity blows up:
 * a 23505 raised by the wallets table must not be read as a duplicate email.
 */
function serviceThatFailsWith(error: Error, failOn: 'User' | 'Wallet' = 'User') {
  const manager = {
    save: async (entity: any, row: any) => {
      if (entity?.name === failOn) throw error;
      return { ...row, id: '1' };
    },
  };
  const repository = {
    manager: { transaction: async (fn: (m: any) => Promise<unknown>) => fn(manager) },
  };
  return new AuthService(repository as any, { hash: async () => 'hashed' } as any);
}

const signup = {
  userName: 'johndoe',
  fullName: 'John Doe',
  email: 'john@example.com',
  password: 'Abc12345',
} as any;

async function checkDuplicateMapping() {
  await assert.rejects(
    () => serviceThatFailsWith(uniqueViolation('email', 'john@example.com')).register(signup),
    (e: Error) => e.message === AUTH_MESSAGE.EMAIL_EXISTS,
    'duplicate email should surface as the EMAIL_EXISTS key, not the raw pg text',
  );

  await assert.rejects(
    () => serviceThatFailsWith(uniqueViolation('username', 'johndoe')).register(signup),
    (e: Error) => e.message === AUTH_MESSAGE.USERNAME_EXISTS,
    'duplicate username should surface as the USERNAME_EXISTS key',
  );

  // The wallet row created alongside the user has its own UNIQUE (user_id). A 23505
  // coming from that constraint must not be dressed up as a duplicate email or
  // username — that would tell the user to pick another address for a fault that has
  // nothing to do with their input.
  const walletClash = Object.assign(
    new Error('duplicate key value violates unique constraint "UQ_wallets_user_id"'),
    { code: '23505', detail: 'Key (user_id)=(1) already exists.', table: 'wallets' },
  );
  await assert.rejects(
    () => serviceThatFailsWith(walletClash, 'Wallet').register(signup),
    (e: Error) => e.message !== AUTH_MESSAGE.EMAIL_EXISTS && e.message !== AUTH_MESSAGE.USERNAME_EXISTS,
    'a unique violation from the wallets table must not be reported as a duplicate signup field',
  );

  // Anything that is not a unique violation must travel untouched, so real
  // failures keep reaching the logs instead of being reported as a duplicate.
  const other = Object.assign(new Error('connection terminated'), { code: '08006' });
  await assert.rejects(
    () => serviceThatFailsWith(other).register(signup),
    (e: Error) => e.message === 'connection terminated',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
