/**
 * Smallest runnable check for the three session guarantees the client depends on.
 *
 *   npx tsx src/tests/auth-session-guards.check.ts
 *
 * 1. logout/logout-all take the user from the verified token, never the body — the
 *    body variant let anyone end anyone else's session by guessing a sequential id.
 * 2. isAuth tags each 401 with a stable error_code, so the client refreshes only on
 *    TOKEN_EXPIRED instead of string-matching an English message.
 * 3. A just-rotated refresh token stays valid for a grace window, so two runtimes
 *    that cannot share a lock (edge middleware and in-page XHR) racing a refresh is
 *    not mistaken for replay — which would log the user out of every device.
 *
 * No database and no HTTP listener: the routers are walked as layer stacks and
 * isAuth is driven directly with fake req/res.
 */
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { AUTH_MESSAGE } from '../common/messages/auth/auth.message.js';

process.env.JWT_SECRET ??= 'test-secret-at-least-32-characters-long-for-safety';

async function main() {
  const { isAuth } = await import('../middlewares/authen.middleware.js');
  const { default: authRouter } = await import('../modules/auth/auth.route.js');

  function fakeRes() {
    const res: any = {
      statusCode: 0,
      body: null,
      status(code: number) { res.statusCode = code; return res; },
      json(payload: any) { res.body = payload; return res; },
    };
    return res;
  }

  function runAuth(authorization?: string) {
    const req: any = { headers: authorization ? { authorization } : {} };
    const res = fakeRes();
    let passed = false;
    isAuth(req, res, () => { passed = true; });
    return { req, res, passed };
  }

  // --- 1. Both logout routes sit behind the auth middleware -------------------
  const logoutRoutes = (authRouter as any).stack
    .filter((layer: any) => layer.route && layer.route.path.startsWith('/logout'))
    .map((layer: any) => ({
      path: layer.route.path,
      guarded: layer.route.stack.some((h: any) => h.name === 'isAuth'),
    }));

  assert.equal(logoutRoutes.length, 2, 'expected /logout and /logout-all');
  for (const route of logoutRoutes) {
    assert.ok(route.guarded, `${route.path} must require a verified access token`);
  }

  // --- 2. Every 401 carries a stable, distinct error_code ---------------------
  const missing = runAuth(undefined);
  assert.equal(missing.res.statusCode, 401);
  assert.equal(missing.res.body.error_code, 'TOKEN_MISSING');

  const invalid = runAuth('Bearer not-a-jwt');
  assert.equal(invalid.res.statusCode, 401);
  assert.equal(invalid.res.body.error_code, 'TOKEN_INVALID');

  const expiredToken = jwt.sign(
    { idUser: '1', email: 'a@b.c', role: 'user' },
    process.env.JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: -60 },
  );
  const expired = runAuth(`Bearer ${expiredToken}`);
  assert.equal(expired.res.statusCode, 401);
  assert.equal(expired.res.body.error_code, 'TOKEN_EXPIRED');

  // The message stays intact so clients matching on it keep working.
  assert.match(expired.res.body.message, /Token expired/);

  // A valid token still passes through and populates the request.
  const validToken = jwt.sign(
    { idUser: '42', email: 'a@b.c', role: 'user' },
    process.env.JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '5m' },
  );
  const ok = runAuth(`Bearer ${validToken}`);
  assert.ok(ok.passed, 'a valid token must reach the handler');
  assert.equal(ok.req.idUser, '42');

  // --- 3. Logout clears the grace key as well as the live one ---------------
  // Real service code against a fake redis: if logout forgot the grace key, the
  // just-rotated token would keep refreshing for the rest of the window, so
  // logging out would not actually end the session.
  const deleted: string[] = [];
  const { default: redis } = await import('../common/redis/redis.client.js');
  const fakePipeline: any = {
    del: (key: string) => { deleted.push(key); return fakePipeline; },
    srem: () => fakePipeline,
    exec: async () => [],
  };
  (redis as any).pipeline = () => fakePipeline;

  const { AuthService } = await import('../modules/auth/auth.service.js');
  const service = new AuthService({} as any, {} as any);
  await service.logout('7', 'device-1');

  assert.deepEqual(deleted, ['refresh:7:device-1', 'refresh:7:device-1:grace']);

  // --- 4. A banned user cannot refresh its way back in -----------------------
  // The refresh token lives for days and rotates itself, so login's status check
  // never runs again for someone already signed in. Without a re-check, banning a
  // logged-in user did nothing at all: they kept minting access tokens forever.
  const smembers: string[] = [];
  (redis as any).smembers = async (key: string) => { smembers.push(key); return ['device-1']; };

  const banned = { id: '9', status: 'banned', username: 'x', email: 'x@example.com', role: 'user' };
  const bannedService = new AuthService({ findOne: async () => banned } as any, {} as any);

  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters-long';
  const refreshToken = jwt.sign(
    { idUser: '9', deviceId: 'device-1' },
    process.env.JWT_REFRESH_SECRET!,
    { algorithm: 'HS256', issuer: 'bidy-api', audience: 'bidy-client', expiresIn: '7d' },
  );

  deleted.length = 0;
  await assert.rejects(
    () => bannedService.refresh(refreshToken),
    new Error(AUTH_MESSAGE.ACCOUNT_NOT_AVAILABLE),
    'a banned user must not be able to refresh an access token',
  );

  // Refusing is not enough — the sessions must be gone, or the client just retries.
  assert.ok(
    deleted.includes('refresh:9:device-1'),
    'a refused refresh must also revoke the sessions that allowed it',
  );

  // --- 5. The refresh 401 carries a code, not just English prose ------------
  // This was the last place in the app where the client had to read a message to
  // decide what to do. Wording changes and i18n would have broken it silently.
  const { AuthController } = await import('../modules/auth/auth.controller.js');

  const cases: Array<[string, string]> = [
    [AUTH_MESSAGE.ACCOUNT_NOT_AVAILABLE, 'ACCOUNT_NOT_AVAILABLE'],
    [AUTH_MESSAGE.REFRESH_TOKEN_REVOKED_OR_INVALID, 'REFRESH_TOKEN_INVALID'],
    [AUTH_MESSAGE.USER_NOT_FOUND, 'USER_NOT_FOUND'],
    ['something nobody mapped', 'REFRESH_FAILED'],
  ];

  for (const [message, expected] of cases) {
    const controller = new AuthController({
      refresh: async () => { throw new Error(message); },
    } as any);

    const res = fakeRes();
    await controller.refresh({ body: { refreshToken: 'x' } } as any, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error_code, expected, `"${message}" must map to ${expected}`);
  }

  console.log('auth-session-guards.check: OK');
}

// The auth service opens a redis connection at import time, which keeps the event
// loop alive once the assertions are done.
main().then(() => process.exit(0));
