/**
 * Guards the auction approval queue.
 *
 *   npx tsx src/tests/auction-request.check.ts
 *
 * The queue only means anything if these hold:
 *
 *  - Approval RE-CHECKS the product rules. Between filing and approval a product can
 *    be unpublished, deleted, or auctioned through another route; approving on the
 *    check made at filing time is what would put two live auctions on one item.
 *  - Approving creates the auction and stamps the request in ONE transaction. An
 *    approved request without its auction is a listing the seller believes is live
 *    and nobody can find.
 *  - A request whose start date has passed opens immediately instead of waiting for
 *    a moment that is gone — but one whose END date has passed is refused rather
 *    than created already over.
 *  - Nothing decided twice: a request that is not `pending` cannot be approved,
 *    rejected, edited or withdrawn.
 *  - Someone else's request reads as not-found, never forbidden.
 */
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { AuctionRequestService } from '../modules/auction/auction-request.service.js';
import { AuctionRequestStatus } from '../modules/auction/enum/auction-request-status.enum.js';
import { AuctionStatus } from '../modules/auction/enum/auction-status.enum.js';

const SELLER = '30';
const ADMIN = '1';
const HOUR = 60 * 60 * 1000;

function makeService({
  status = AuctionRequestStatus.PENDING,
  startOffset = HOUR,
  endOffset = 48 * HOUR,
  auctionable = true,
}: {
  status?: AuctionRequestStatus;
  startOffset?: number;
  endOffset?: number;
  auctionable?: boolean;
} = {}) {
  const now = Date.now();
  const request: any = {
    id: '9',
    productId: '35',
    sellerId: SELLER,
    status,
    quantity: 2,
    startingPrice: 1000,
    buyNowPrice: null,
    reservePrice: null,
    bidIncrement: 50,
    startDate: new Date(now + startOffset),
    endDate: new Date(now + endOffset),
    auctionId: null,
    reviewedBy: null,
    reviewedAt: null,
  };

  const savedAuctions: any[] = [];
  const savedRequests: any[] = [];
  let auctionableCalls = 0;

  const manager: any = {
    findOne: async () => request,
    create: (_entity: any, data: any) => ({ id: '77', ...data }),
    save: async (entity: any, row: any) => {
      // TypeORM's manager.save(Entity, row) — the first argument tells them apart.
      if (entity?.name === 'Auction') savedAuctions.push(row);
      else savedRequests.push(row);
      return row;
    },
  };

  const dataSource: any = {
    transaction: async (fn: (m: any) => Promise<unknown>) => fn(manager),
  };

  const requestRepo: any = {
    findOne: async () => request,
    save: async (row: any) => {
      savedRequests.push(row);
      return row;
    },
    create: (row: any) => row,
  };

  const productService: any = {
    assertAuctionable: async () => {
      auctionableCalls += 1;
      if (!auctionable) {
        const error: any = new Error('PRODUCT_NOT_AUCTIONABLE');
        error.statusCode = 422;
        throw error;
      }
      return { id: '35' };
    },
  };

  const service = new AuctionRequestService(dataSource, requestRepo, productService);
  return {
    service,
    request,
    savedAuctions,
    savedRequests,
    auctionableCalls: () => auctionableCalls,
  };
}

async function rejects(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (err: Error) => {
    assert.equal(err.message, code, `expected ${code}, got ${err.message}`);
    return true;
  });
}

async function main() {
  // Approval creates the auction from the stored terms and stamps the request.
  {
    const t = makeService();
    const result = await t.service.approve('9', ADMIN);

    assert.equal(result.status, AuctionRequestStatus.APPROVED);
    assert.equal(result.auctionId, '77');
    assert.equal(t.savedAuctions.length, 1, 'exactly one auction per approval');

    const auction = t.savedAuctions[0]!;
    assert.equal(auction.quantity, 2, 'the auction carries the terms that were approved');
    assert.equal(auction.startingPrice, 1000);
    assert.equal(auction.currentPrice, 1000, 'bidding opens at the starting price');
    assert.equal(auction.status, AuctionStatus.PENDING, 'a future start date stays pending');

    const saved = t.savedRequests.at(-1)!;
    assert.equal(saved.auctionId, '77', 'the request records which auction it produced');
    assert.equal(saved.reviewedBy, ADMIN);
    assert.ok(saved.reviewedAt instanceof Date);
  }

  // The product rules are re-checked at approval, not trusted from filing time.
  {
    const t = makeService({ auctionable: false });
    await rejects(() => t.service.approve('9', ADMIN), 'PRODUCT_NOT_AUCTIONABLE');
    assert.equal(t.auctionableCalls(), 1, 'approval must re-run the product check');
    assert.equal(t.savedAuctions.length, 0, 'no auction may exist after a refused approval');
  }

  // A start date already past opens the auction now rather than leaving it pending
  // for a moment that has gone.
  {
    const t = makeService({ startOffset: -2 * HOUR });
    await t.service.approve('9', ADMIN);
    assert.equal(t.savedAuctions[0]!.status, AuctionStatus.HAPPENING);
  }

  // But an end date already past is refused, not created already over.
  {
    const t = makeService({ startOffset: -48 * HOUR, endOffset: -HOUR });
    await rejects(() => t.service.approve('9', ADMIN), 'REQUEST_SCHEDULE_EXPIRED');
    assert.equal(t.savedAuctions.length, 0);
  }

  // Nothing gets decided twice.
  for (const status of [
    AuctionRequestStatus.APPROVED,
    AuctionRequestStatus.REJECTED,
    AuctionRequestStatus.CANCELLED,
  ]) {
    const t = makeService({ status });
    await rejects(() => t.service.approve('9', ADMIN), 'REQUEST_NOT_PENDING');
    await rejects(() => t.service.reject('9', ADMIN, 'nope'), 'REQUEST_NOT_PENDING');
    await rejects(() => t.service.cancel('9', SELLER), 'REQUEST_NOT_PENDING');
    await rejects(() => t.service.update('9', { quantity: 5 }, SELLER), 'REQUEST_NOT_PENDING');
    assert.equal(t.savedAuctions.length, 0);
  }

  // Rejection keeps the reason — it is the whole point of telling the seller.
  {
    const t = makeService();
    const result = await t.service.reject('9', ADMIN, 'Ảnh không rõ sản phẩm');
    assert.equal(result.status, AuctionRequestStatus.REJECTED);
    assert.equal(result.rejectReason, 'Ảnh không rõ sản phẩm');
    assert.equal(t.savedRequests.at(-1)!.reviewedBy, ADMIN);
  }

  // Someone else's request is not found, not forbidden.
  {
    const t = makeService();
    await rejects(() => t.service.findById('9', 'someone-else'), 'REQUEST_NOT_FOUND');
    await rejects(() => t.service.cancel('9', 'someone-else'), 'REQUEST_NOT_FOUND');
    // An admin reads it without passing a requester.
    assert.equal((await t.service.findById('9')).id, '9');
  }

  // An end date that is not after the start date is refused on edit too, not only
  // at creation — otherwise the same bad range walks in through PATCH.
  {
    const t = makeService();
    await rejects(
      () => t.service.update('9', { endDate: new Date(Date.now() - HOUR).toISOString() }, SELLER),
      'INVALID_DATE_RANGE',
    );
  }

  console.log('auction-request.check OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
