/**
 * Runs every src/tests/**\/*.check.ts in its own tsx process and reports a summary.
 *
 *   npm test
 *
 * The project has no TS transform configured for jest, so the check scripts are the
 * real suite. Each runs in a child process because several import modules that open
 * repository handles, and one hung process would otherwise stall the whole run.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const TESTS_DIR = __dirname;
const TIMEOUT_MS = 120_000;

function findChecks(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return findChecks(full);
    return entry.endsWith('.check.ts') ? [full] : [];
  });
}

const checks = findChecks(TESTS_DIR).sort();

if (checks.length === 0) {
  console.error('No *.check.ts files found.');
  process.exit(1);
}

let failed = 0;

for (const check of checks) {
  const name = relative(process.cwd(), check);
  const result = spawnSync('npx', ['tsx', check], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });

  const ok = result.status === 0;
  if (!ok) failed++;

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);

  if (!ok) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trimEnd();
    if (output) console.log(output.replace(/^/gm, '      '));
    if (result.signal) console.log(`      (killed by ${result.signal} after ${TIMEOUT_MS}ms)`);
  }
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
