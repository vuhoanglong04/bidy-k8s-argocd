/**
 * Guards the public seller storefront.
 *
 *   npx tsx src/tests/seller-storefront.check.ts
 *
 * Two invariants, both of which fail silently in production if they break:
 *
 *  1. `cancelled` auctions never reach a storefront — not when `status` is omitted,
 *     and not when a client asks for them outright. The filter lives on the server
 *     precisely so a client that forgets a parameter cannot surface one.
 *  2. The profile is unauthenticated, so it must carry no email and no phone. The
 *     stub hands back a User row full of secrets; the check fails if any of them can
 *     be reached anywhere in the response.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AuctionStatus } from '../modules/auction/enum/auction-status.enum.js';
import { SellerService } from '../modules/user/seller.service.js';
import { AuctionService } from '../modules/auction/auction.service.js';

const SECRETS = ['secret@example.com', '0900000000', 'hashed-password'];

function flatten(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => flatten(v, out));
  return out;
}

const sellerRow: any = {
  id: '30',
  username: 'quynhpn',
  fullname: 'Quynh',
  avatarFileId: null,
  avatarFile: null,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  email: 'secret@example.com',
  phone: '0900000000',
  passwordHash: 'hashed-password',
};

let countedStatuses: AuctionStatus[] = [];
let aggregateQueries = 0;

const auctionRepo: any = {
  createQueryBuilder: () => {
    const builder: any = {
      innerJoin: () => builder,
      select: () => builder,
      addSelect: () => builder,
      where: () => builder,
      andWhere: (_clause: string, params: any) => {
        if (params?.statuses) countedStatuses = params.statuses;
        return builder;
      },
      groupBy: () => builder,
      getRawMany: async () => {
        aggregateQueries += 1;
        return [
          { status: 'pending', count: '2' },
          { status: 'happening', count: '3' },
          { status: 'ended', count: '5' },
        ];
      },
    };
    return builder;
  },
};

const userRepo: any = {
  findOne: async () => sellerRow,
  exists: async () => true,
};

async function main() {
  const service = new SellerService(userRepo, auctionRepo);
  const profile = await service.getPublicProfile('30');

  // 1 — no PII on an unauthenticated payload.
  const strings = flatten(profile);
  for (const secret of SECRETS) {
    assert.ok(!strings.includes(secret), `seller profile leaked ${secret}`);
  }
  assert.ok(!('email' in profile), 'seller profile must not carry an email field');
  assert.ok(!('phone' in profile), 'seller profile must not carry a phone field');

  // 2 — counts cover exactly the publicly visible statuses, and never `cancelled`.
  assert.ok(
    !countedStatuses.includes(AuctionStatus.CANCELLED),
    'storefront counts must exclude cancelled auctions',
  );
  assert.deepEqual(
    [...countedStatuses].sort(),
    [AuctionStatus.ENDED, AuctionStatus.HAPPENING, AuctionStatus.PENDING].sort(),
  );

  // 3 — the three tab counts add up to `total`, so the UI never shows a total the
  // tabs cannot account for.
  assert.deepEqual(profile.auctionCounts, { pending: 2, happening: 3, ended: 5, total: 10 });
  assert.equal(
    profile.auctionCounts.pending + profile.auctionCounts.happening + profile.auctionCounts.ended,
    profile.auctionCounts.total,
  );

  assert.equal(aggregateQueries, 1, 'the counts must come from one grouped query, not three');

  // 4 — the listing filter itself. Asking for `cancelled` outright must return
  // nothing rather than quietly widening the list, which is how a hidden auction
  // would otherwise reach a storefront.
  let capturedWhere: any;
  const listRepo: any = {
    findAndCount: async ({ where }: any) => {
      capturedWhere = where;
      return [[], 0];
    },
  };
  const auctions = new AuctionService(
    {} as any, listRepo, {} as any, {} as any, {} as any, {} as any, {} as any,
  );

  await auctions.getAuctions(
    { sellerId: '30', excludeStatuses: [AuctionStatus.CANCELLED] },
    1,
    20,
  );
  assert.ok(capturedWhere.status, 'omitting status must still constrain it');
  assert.equal(capturedWhere.product.ownerId, '30', 'the list is scoped to one seller');

  await auctions.getAuctions(
    { status: AuctionStatus.CANCELLED, sellerId: '30', excludeStatuses: [AuctionStatus.CANCELLED] },
    1,
    20,
  );
  const askedForCancelled = capturedWhere.status;
  assert.ok(
    askedForCancelled && askedForCancelled.value?.length === 0,
    'asking for an excluded status must match nothing, not fall through to every status',
  );

  // A storefront that passes no exclusions keeps the old behaviour of GET /auctions.
  await auctions.getAuctions({ status: AuctionStatus.HAPPENING }, 1, 20);
  assert.equal(capturedWhere.status, AuctionStatus.HAPPENING);

  console.log('seller-storefront.check OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
