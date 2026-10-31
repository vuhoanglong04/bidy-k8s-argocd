/**
 * Guards the invariant that broke every admin user mutation: `User.avatarFile` is
 * eager, so a `findOne` with a pessimistic lock emits `LEFT JOIN files ... FOR
 * UPDATE`, and Postgres rejects that with
 *
 *   FOR UPDATE cannot be applied to the nullable side of an outer join
 *
 * turning POST /admin/users/:id/suspend (and ban/unlock/activate/…) into a 500.
 * Every locked read must therefore opt out of eager relations.
 *
 *   npx tsx src/tests/admin-user-lock-eager.check.ts
 *
 * Source-level rather than stub-level: instantiating AdminUserService needs a live
 * DataSource, and the failure is a property of the query the options produce.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SERVICE = 'src/modules/admin/admin-user.service.ts';
const ENTITY = 'src/modules/user/entity/user.entity.ts';

const entity = readFileSync(ENTITY, 'utf8');
const service = readFileSync(SERVICE, 'utf8');

// If the eager relation ever goes away the whole hazard does too — but until then
// this check must stay meaningful, so assert the premise it rests on.
assert.match(entity, /eager:\s*true/, `${ENTITY} no longer has an eager relation — revisit this check`);

// Each locked findOne, sliced from the `lock:` line to the end of its options object.
const lockedOptions = [...service.matchAll(/lock:\s*\{[^}]*\}[\s\S]*?\n\s*\}\)/g)].map((m) => m[0]);

assert.ok(lockedOptions.length > 0, 'expected pessimistic locks in the admin user service');

for (const options of lockedOptions) {
  assert.match(
    options,
    /loadEagerRelations:\s*false/,
    `a pessimistic lock in ${SERVICE} is missing "loadEagerRelations: false":\n${options}`,
  );
}

console.log(`admin-user-lock-eager.check: OK (${lockedOptions.length} locked reads)`);
