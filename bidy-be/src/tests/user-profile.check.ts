/**
 * Smallest runnable check for user profile semantics.
 *
 *   npx tsx src/tests/user-profile.check.ts
 *
 * Drives UserService against an in-memory repository stub — no database required.
 * It fails if the password hash becomes selectable by default again (it would then
 * serialise into every response that loads a User relation), or if PATCH /users/update
 * goes back to putting absent fields into the TypeORM `where` clause.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { UserService } from '../modules/user/user.service.js';
import { User } from '../modules/user/entity/user.entity.js';

function makeUserRepo() {
  const calls = { findWhere: [] as unknown[], updated: [] as unknown[] };

  const repo = {
    findOne: async (options: any) => {
      calls.findWhere.push(options.where);
      return null;
    },
    update: async (_id: string, changes: unknown) => {
      calls.updated.push(changes);
    },
  } as any;

  return { repo, calls };
}

/**
 * In-memory stand-in for the addresses table, faithful to the few TypeORM behaviours
 * the address methods rely on — including `Not()` in an update criteria.
 */
function makeAddressRepo(seed: any[] = []) {
  const rows: any[] = seed.map((row) => ({ ...row }));
  let nextId = rows.length + 1;

  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, expected]: [string, any]) =>
      expected && typeof expected === 'object' && 'value' in expected
        ? String(row[key]) !== String(expected.value) // Not(...)
        : String(row[key]) === String(expected),
    );

  const manager = {
    count: async (_entity: unknown, options: any) => rows.filter((row) => matches(row, options.where)).length,
    create: (_entity: unknown, data: any) => ({ ...data }),
    findOne: async (_entity: unknown, options: any) => {
      const found = rows.filter((row) => matches(row, options.where));
      if (options.order?.created_at === 'ASC') found.sort((a, b) => a.created_at - b.created_at);
      return found[0] ?? null;
    },
    update: async (_entity: unknown, where: any, changes: any) => {
      rows.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, changes));
    },
    save: async (_entity: unknown, row: any) => {
      const existing = rows.find((candidate) => candidate.id && candidate.id === row.id);
      if (existing) return Object.assign(existing, row);
      row.id = String(nextId++);
      row.created_at ??= nextId;
      rows.push(row);
      return row;
    },
    remove: async (_entity: unknown, row: any) => {
      rows.splice(rows.findIndex((candidate) => candidate.id === row.id), 1);
    },
  };

  return { repo: { manager: { transaction: (run: any) => run(manager) } } as any, rows };
}

const addressService = (repo: any) =>
  new UserService(null as any, null as any, null as any, null as any, repo);

const defaultsOf = (rows: any[]) => rows.filter((row) => row.isDefault).map((row) => row.id);

const cases = [
  {
    name: 'the first address becomes the default even when not asked for',
    run: async () => {
      const { repo, rows } = makeAddressRepo();
      await addressService(repo).createAddress('7', { street: 'a', city: 'b', state: 'c' } as any);

      assert.equal(rows.length, 1);
      assert.equal(rows[0].isDefault, true, 'a user with one address must have a default — buyNow resolves it');
      assert.equal(rows[0].zipCode, null, 'an omitted zipCode is stored as NULL, not undefined');
    },
  },
  {
    name: 'promoting a default demotes the previous one',
    run: async () => {
      const { repo, rows } = makeAddressRepo([
        { id: '1', userId: '7', isDefault: true, created_at: 1 },
        { id: '2', userId: '7', isDefault: false, created_at: 2 },
        { id: '3', userId: '9', isDefault: true, created_at: 3 }, // another user, must not move
      ]);

      await addressService(repo).setDefaultAddress('7', '2');

      assert.deepEqual(defaultsOf(rows.filter((row) => row.userId === '7')), ['2'], 'exactly one default');
      assert.equal(rows.find((row) => row.id === '3').isDefault, true, "another user's default is untouched");
    },
  },
  {
    name: "deleting the default promotes a survivor",
    run: async () => {
      const { repo, rows } = makeAddressRepo([
        { id: '1', userId: '7', isDefault: true, created_at: 1 },
        { id: '2', userId: '7', isDefault: false, created_at: 2 },
      ]);

      await addressService(repo).removeAddress('7', '1');

      assert.deepEqual(defaultsOf(rows), ['2'], 'the user still owns an address, so it must still have a default');
    },
  },
  {
    name: "another user's address reads as absent, not forbidden",
    run: async () => {
      const { repo } = makeAddressRepo([{ id: '1', userId: '9', isDefault: true, created_at: 1 }]);

      await assert.rejects(
        () => addressService(repo).setDefaultAddress('7', '1'),
        /ADDRESS_NOT_FOUND/,
        'ownership is part of the lookup — never reveal that the id exists',
      );
    },
  },
  {
    name: 'User.passwordHash is never selected by default',
    run: async () => {
      const passwordColumn = getMetadataArgsStorage().columns.find(
        (column) => column.target === User && column.propertyName === 'passwordHash',
      );

      assert.ok(passwordColumn, 'User.passwordHash column metadata not found');
      assert.equal(
        passwordColumn.options.select,
        false,
        'User.passwordHash must stay `select: false` so it cannot leak through loaded relations',
      );
    },
  },
  {
    name: 'userUpdate writes only the supplied fields',
    run: async () => {
      const { repo, calls } = makeUserRepo();
      await new UserService(repo, null as any, null as any, null as any, null as any)
        .userUpdate('9', 'Only A Name');

      const uniquenessProbes = calls.findWhere.filter((where) => Array.isArray(where));
      assert.equal(
        uniquenessProbes.length,
        0,
        'no email/phone supplied, so userUpdate must not run a uniqueness probe at all',
      );

      assert.deepEqual(
        calls.updated,
        [{ fullname: 'Only A Name' }],
        'userUpdate must only write the fields the caller actually supplied',
      );
    },
  },
  {
    name: 'userUpdate uniqueness probe omits absent fields',
    run: async () => {
      const { repo, calls } = makeUserRepo();
      await new UserService(repo, null as any, null as any, null as any, null as any)
        .userUpdate('9', undefined, 'a@b.c');

      assert.deepEqual(
        calls.findWhere[0],
        [{ email: 'a@b.c' }],
        'probe must contain only supplied fields — a null/undefined value throws in TypeORM',
      );
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
