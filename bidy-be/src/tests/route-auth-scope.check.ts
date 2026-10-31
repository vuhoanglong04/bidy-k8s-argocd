/**
 * Smallest runnable check that productRouter's auth guard covers only the paths it
 * owns.
 *
 *   npx tsx src/tests/route-auth-scope.check.ts
 *
 * productRouter is mounted on the bare /api/v1 prefix, so a router-wide
 * `router.use(isAuth)` also guarded every unmatched path under it: a mistyped URL
 * such as /api/v1/api/v1/categories/tree answered 401 instead of falling through to
 * notFoundHandler, which reads as a public route demanding a token. This walks the
 * router's real layer stack — no database, no HTTP listener.
 */
import assert from 'node:assert/strict';
import productRouter from '../modules/product/product.route.js';

/**
 * Mount paths of the auth middleware layers. Express does not keep the literal
 * mount path, so recover it from the layer's regexp the same way
 * route-mounting.check.ts does: /^\/products\/?(?=\/|$)/ -> '/products'. A
 * router-wide `use` yields fast_slash instead, which is the regression.
 */
const guardMounts = (productRouter as any).stack
  .filter((layer: any) => !layer.route && layer.name === 'isAuth')
  .map((layer: any) =>
    layer.regexp?.fast_slash
      ? '/'
      : (layer.regexp?.source ?? '')
          .replace(/^\^/, '')
          .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
          .replace(/\\\//g, '/'),
  );

// Every guard is scoped to a prefix; none of them is the catch-all '/'.
assert.ok(guardMounts.length > 0, 'expected productRouter to register auth middleware');
for (const mount of guardMounts) {
  assert.notEqual(mount, '/', 'productRouter must not guard every path under its bare /api/v1 mount');
}
assert.deepEqual([...guardMounts].sort(), ['/me', '/products']);

console.log('route-auth-scope.check: OK');
