/**
 * Guards the public auction payloads against leaking bidder PII.
 *
 *   npx tsx src/tests/public-payload-pii.check.ts
 *
 * Both routes below are unauthenticated, and both once embedded a full User row per
 * bid — email, phone, account state — because they loaded the `user` relation and
 * returned it verbatim. GET /auctions/{id} is also polled by every viewer, so the
 * addresses went out continuously.
 *
 * The stubs hand back a User carrying obvious secrets; the check fails if any of
 * them can still be reached anywhere in the response.
 */
import assert from 'node:assert/strict';
import { getMetadataArgsStorage } from 'typeorm';
import { AuctionService } from '../modules/auction/auction.service.js';
import { AppDataSource } from '../database/data-source.js';
import bidHistoryService from '../modules/auction/bid-history.service.js';

const SECRETS = ['secret@example.com', '0900000000', 'hashed-password', 'banned for fraud'];

/** Every string anywhere in the payload, however deeply nested. */
function flatten(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => flatten(v, out));
  return out;
}

function assertNoSecrets(label: string, payload: unknown) {
  const strings = flatten(payload);
  for (const secret of SECRETS) {
    assert.ok(!strings.includes(secret), `${label} leaked ${secret}`);
  }
}

const bidder = {
  id: '30',
  username: 'quynhpn.lcdmkt',
  fullname: 'Quynh',
  avatarUrl: null,
  email: 'secret@example.com',
  phone: '0900000000',
  passwordHash: 'hashed-password',
  statusReason: 'banned for fraud',
};

const bidRow = {
  id: '1',
  auctionId: '2',
  userId: '30',
  amount: '104.00',
  actionType: 'place_bid',
  createdAt: new Date('2026-01-01'),
  user: bidder,
};

async function main() {
  // --- GET /auctions/{id} ----------------------------------------------------
  const service = new (AuctionService as any)();
  service.auctionRepo = {
    findOne: async () => ({
      id: '2',
      startingPrice: '100.00',
      currentPrice: '104.00',
      bidIncrement: '1.00',
      product: { name: 'X', ownerId: '22', category: null, images: [] },
      bids: [bidRow],
    }),
  };

  const detail = await service.getProductById('2');
  assertNoSecrets('GET /auctions/{id}', detail);

  // The raw relation must not ride along at all — it is what carried the User.
  assert.ok(!('bids' in detail), 'the raw bids relation must not be returned');

  // The safe projection of the same rows must survive, or clients lose the list.
  assert.equal(detail.top_ownerships.length, 1);
  assert.equal(detail.top_ownerships[0].user_name, 'quynhpn.lcdmkt');
  assert.equal(detail.minNextBid, 105);

  // --- GET /auctions ---------------------------------------------------------
  // The list joins the seller so cards can show a name; the rest of that User row
  // must not ride along with it.
  service.auctionRepo = {
    findAndCount: async () => [[{ id: '2', product: { name: 'X', ownerId: '22', owner: bidder, images: [] } }], 1],
  };

  const { items } = await service.getAuctions({});
  assertNoSecrets('GET /auctions', items);
  assert.deepEqual(items[0].product.owner, { id: '30', username: 'quynhpn.lcdmkt' });

  // --- GET /auctions/{id}/bid-history ---------------------------------------
  const realGetRepository = AppDataSource.getRepository.bind(AppDataSource);
  (AppDataSource as any).getRepository = () => ({ find: async () => [bidRow] });

  try {
    const history = await bidHistoryService.getAuctionHistory('2');
    assertNoSecrets('GET /auctions/{id}/bid-history', history);

    // Still useful: the bidder is named, just not exposed.
    assert.equal(history[0]!.user?.username, 'quynhpn.lcdmkt');
    assert.equal(history[0]!.amount, '104.00');
  } finally {
    (AppDataSource as any).getRepository = realGetRepository;
  }

  // --- User columns that must never load by default ---------------------------
  // The projections above are per-call-site and a new module that joins a User
  // relation gets none of them. These two columns are the ones with no legitimate
  // reader outside auth and the admin screens, so they are withheld at the entity
  // instead: `select: false` means a forgotten projection fails closed.
  const columns = getMetadataArgsStorage().columns.filter((c) => (c.target as any)?.name === 'User');
  for (const property of ['passwordHash', 'statusReason']) {
    const column = columns.find((c) => c.propertyName === property);
    assert.ok(column, `User.${property} not found — was it renamed?`);
    assert.equal(
      (column!.options as any).select,
      false,
      `User.${property} must stay select:false; admin opts in through ADMIN_USER_SELECT`,
    );
  }

  console.log('✅ public auction payloads carry no bidder PII');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
