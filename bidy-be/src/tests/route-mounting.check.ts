/**
 * Smallest runnable check that the previously-orphaned controllers are actually
 * reachable through the router tree.
 *
 *   npx tsx src/tests/route-mounting.check.ts
 *
 * Walks the composed indexRouter's Express layer stack and asserts every newly
 * mounted path resolves. No database and no HTTP listener — the router is built
 * from repository handles, not connections, so this fails fast if a route file
 * stops being mounted in src/routes/index.ts or its path drifts.
 */
import assert from 'node:assert/strict';
import { indexRouter } from '../routes/index.js';
import { corsConfig } from '../config/cors.config.js';

/** Rebuild the concrete paths Express would match, by walking nested routers. */
function collectRoutes(layer: any, prefix = ''): string[] {
  const found: string[] = [];

  if (layer.route) {
    const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
    // A router's own '/' route yields '<prefix>/' — normalise so it reads as the mount itself.
    const path = `${prefix}${layer.route.path}`.replace(/(.)\/$/, '$1');
    for (const method of methods) found.push(`${method} ${path}`);
    return found;
  }

  if (layer.handle?.stack) {
    // Express does not keep the literal mount path, so recover it from the
    // layer's own regexp: /^\/api\/v1\/chat\/?(?=\/|$)/ -> '/api/v1/chat'
    const source: string = layer.regexp?.source ?? '';
    const segment = layer.regexp?.fast_slash
      ? ''
      : source
          .replace(/^\^/, '')
          .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
          .replace(/\\\//g, '/');

    for (const child of layer.handle.stack) {
      found.push(...collectRoutes(child, prefix + segment));
    }
  }

  return found;
}

const routes = new Set(
  indexRouter.stack.flatMap((layer: any) => collectRoutes(layer)),
);

// One representative endpoint per newly mounted controller.
const expected = [
  'GET /api/v1/notifications/unread-count',       // notification.controller
  'DELETE /api/v1/notifications/:id',             // notification.controller
  'POST /api/v1/chat/messages',                   // chat.controller
  'GET /api/v1/chat/conversations/:id/messages',  // chat.controller
  'GET /api/v1/admin/support/chats',              // admin.support.controller
  'GET /api/v1/admin/support/conversations',      // chat.controller (admin side)
  // The user-facing half of support chat. Its service and entities were migrated
  // but these five routes never were, so the widget 404'd on every call while the
  // admin side worked — which is exactly the asymmetry this list exists to catch.
  'GET /api/v1/time/current',                     // time.controller
  'POST /api/v1/files',                           // file.controller
  'GET /api/v1/files/:id/url',                    // file.controller
  'GET /api/v1/auctions/:auctionId/bid-history',  // bid-history.controller
  'GET /api/v1/auctions/user/bid-history',        // bid-history.controller
  'POST /api/v1/users/support/messages/product-grid', // product-grid.controller
  'GET /api/v1/users/support/products/batch',     // product-grid.controller
  'POST /api/v1/reviews',                         // review.controller
  'GET /api/v1/reviews/user/:userId',             // review.controller
  'GET /api/v1/reviews/user/:userId/summary',     // review.controller
  'POST /api/v1/reviews/:id/reply',               // review.controller
  'GET /api/v1/wallet/me',                        // wallet.controller
];

const missing = expected.filter((route) => !routes.has(route));

assert.deepEqual(
  missing,
  [],
  `Unmounted routes:\n  ${missing.join('\n  ')}\n\nMounted:\n  ${[...routes].sort().join('\n  ')}`,
);

// The auction router matches '/:id' for any single segment, so the more specific
// '/:auctionId/bid-history' route must be registered ahead of it or it is shadowed.
const ordered = [...routes];
const catchAll = ordered.indexOf('GET /api/v1/auctions/:id');
const bidHistory = ordered.indexOf('GET /api/v1/auctions/:auctionId/bid-history');
assert.ok(
  catchAll === -1 || bidHistory < catchAll,
  `'/:auctionId/bid-history' must be registered before the '/:id' catch-all, otherwise it is shadowed`,
);

// Same shadowing hazard in the review router: '/:id' would otherwise swallow '/user/:userId'.
const reviewCatchAll = ordered.indexOf('GET /api/v1/reviews/:id');
const reviewByUser = ordered.indexOf('GET /api/v1/reviews/user/:userId');
assert.ok(
  reviewCatchAll === -1 || reviewByUser < reviewCatchAll,
  `'/reviews/user/:userId' must be registered before the '/reviews/:id' catch-all, otherwise it is shadowed`,
);

// Every verb the router mounts must be in the CORS allowlist. A verb missing there
// fails only in a browser, and fails as an opaque "Network Error": the preflight is
// refused so the real request is never sent, leaving no status code to debug from.
// PATCH was absent while 28 PATCH routes were mounted, and nothing here noticed.
const mountedMethods = new Set([...routes].map((route) => route.split(' ')[0]));
const uncovered = [...mountedMethods].filter((method) => !corsConfig.methods.includes(method));

assert.deepEqual(
  uncovered,
  [],
  `These verbs are mounted but missing from corsConfig.methods, so browsers cannot ` +
    `call them cross-origin: ${uncovered.join(', ')}\n` +
    `corsConfig.methods = ${corsConfig.methods.join(', ')}`,
);

console.log(`route-mounting.check: OK (${routes.size} routes mounted, ${expected.length} asserted, ` +
  `${mountedMethods.size} verbs CORS-covered)`);
// Importing the router builds repository handles that keep the event loop alive.
process.exit(0);
