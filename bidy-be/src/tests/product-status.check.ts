/**
 * Smallest runnable check for the product lifecycle and the product/auction boundary.
 *
 *   npx tsx src/tests/product-status.check.ts
 *
 * These are the rules that decide whether a product is visible and whether it can
 * be auctioned, so getting them wrong is not a cosmetic bug:
 *
 *  - A product created through POST /products starts as `draft` and is filtered out
 *    of every public query, so publishing is what makes the manage-product flow work
 *    at all.
 *  - Publishing without an image would put an unsellable listing in front of buyers.
 *  - Withdrawing a product whose auction is still pending or running would strand
 *    bidders on a listing its owner has taken back. Withdrawal is DELETE now —
 *    `inactive` and `archived` are gone — so that guard has to live on the delete
 *    path. It previously lived only on the status transitions, which meant deleting
 *    was the way around it.
 *  - Two live auctions on one product would take two buyers' money for one item.
 *  - A product field sent alongside `product_id` must be refused, not dropped: a
 *    seller who renames their listing there would see the old name everywhere.
 *
 * Repositories are stubbed; no database, no network.
 */
import assert from 'node:assert/strict';

import { ProductService } from '../modules/product/product.service.js';
import { AuctionService } from '../modules/auction/auction.service.js';
import { ProductStatus } from '../modules/product/enums/product-status.enum.js';
import { AuctionStatus } from '../modules/auction/enum/auction-status.enum.js';
import { PRODUCT_MESSAGE, PRODUCT_ERROR_CODE } from '../common/messages/product/product.message.js';

const OWNER = 'user-1';

type Options = {
  status: ProductStatus;
  imageCount?: number;
  auctionStatus?: AuctionStatus | null;
  ownerId?: string;
};

function makeService({ status, imageCount = 1, auctionStatus = null, ownerId = OWNER }: Options) {
  const product: any = {
    id: 'p1',
    ownerId,
    status,
    images: Array.from({ length: imageCount }, (_, i) => ({ id: String(i), displayOrder: i })),
  };

  const saved: any[] = [];
  const deleted: string[] = [];
  const productRepo = {
    findOne: async () => product,
    save: async (row: any) => { saved.push({ ...row }); return row; },
    softDelete: async (id: string) => { deleted.push(id); },
  } as any;

  // Stands in for the auctions repository: the product carries at most one auction
  // here, and only a pending or happening one counts as live.
  const dataSource = {
    getRepository: () => ({
      existsBy: async () =>
        auctionStatus !== null &&
        [AuctionStatus.PENDING, AuctionStatus.HAPPENING].includes(auctionStatus),
    }),
  } as any;

  return { service: new ProductService(productRepo, {} as any, dataSource), product, saved, deleted };
}

/**
 * AuctionService with everything stubbed except the mode-A branch: the transaction
 * runs the callback inline and every save is a no-op, so only the product/auction
 * boundary is under test.
 */
function makeAuctionService(onAssert: (productId: string) => void = () => {}) {
  const manager = { create: (_e: any, data: any) => data, save: async (_e: any, row: any) => row };
  const dataSource = { transaction: async (fn: any) => await fn(manager) } as any;
  const productService = {
    assertAuctionable: async (productId: string) => { onAssert(productId); return { id: productId }; },
  } as any;

  return new AuctionService(
    dataSource, {} as any, {} as any, {} as any, {} as any, {} as any, productService,
  );
}

async function rejects(fn: () => Promise<unknown>, expected: string, label: string) {
  try {
    await fn();
  } catch (error: any) {
    assert.equal(error.message, expected, label);
    return;
  }
  assert.fail(`${label}: expected a rejection, got success`);
}

const cases: { name: string; run: () => Promise<void> }[] = [
  {
    name: 'publish: a draft with an image publishes',
    run: async () => {
      const { service, saved } = makeService({ status: ProductStatus.DRAFT });
      const result = await service.publishProduct('p1', OWNER, 'user');

      assert.equal(result.status, ProductStatus.ACTIVE);
      assert.equal(saved.length, 1, 'the new status must be persisted');
    },
  },
  {
    name: 'publish: a draft with no image cannot be published',
    run: async () => {
      const { service, saved } = makeService({ status: ProductStatus.DRAFT, imageCount: 0 });
      await rejects(
        () => service.publishProduct('p1', OWNER, 'user'),
        PRODUCT_MESSAGE.PRODUCT_NEEDS_IMAGE_TO_PUBLISH,
        'publishing an imageless product',
      );
      assert.equal(saved.length, 0, 'nothing may be persisted on a refused publish');
    },
  },
  {
    name: 'publish: publishing an already-published product changes nothing',
    run: async () => {
      const { service, saved } = makeService({ status: ProductStatus.ACTIVE });
      const result = await service.publishProduct('p1', OWNER, 'user');

      assert.equal(result.status, ProductStatus.ACTIVE);
      assert.equal(saved.length, 0, 'a no-op publish must not write');
    },
  },
  {
    name: 'publish: a non-owner is refused before any rule is evaluated',
    run: async () => {
      const { service } = makeService({ status: ProductStatus.DRAFT, ownerId: 'someone-else' });
      await rejects(
        () => service.publishProduct('p1', OWNER, 'user'),
        PRODUCT_ERROR_CODE.PRODUCT_FORBIDDEN,
        'publishing somebody else\u2019s product',
      );
    },
  },
  {
    name: 'delete: a product with a running auction cannot be withdrawn',
    run: async () => {
      const { service } = makeService({
        status: ProductStatus.ACTIVE,
        auctionStatus: AuctionStatus.HAPPENING,
      });
      await rejects(
        () => service.softDeleteProduct('p1', OWNER, 'user'),
        PRODUCT_MESSAGE.PRODUCT_HAS_LIVE_AUCTION,
        'deleting a product mid-auction',
      );
    },
  },
  {
    name: 'delete: a pending auction blocks withdrawal too',
    run: async () => {
      const { service } = makeService({
        status: ProductStatus.ACTIVE,
        auctionStatus: AuctionStatus.PENDING,
      });
      await rejects(
        () => service.softDeleteProduct('p1', OWNER, 'user'),
        PRODUCT_MESSAGE.PRODUCT_HAS_LIVE_AUCTION,
        'deleting a product with an auction about to open',
      );
    },
  },
  {
    name: 'delete: an ended auction no longer blocks withdrawal',
    run: async () => {
      const { service, deleted } = makeService({
        status: ProductStatus.ACTIVE,
        auctionStatus: AuctionStatus.ENDED,
      });
      await service.softDeleteProduct('p1', OWNER, 'user');
      assert.deepEqual(deleted, ['p1'], 'the product must actually be soft-deleted');
    },
  },
  {
    name: 'delete: a non-owner cannot withdraw somebody else\u2019s product',
    run: async () => {
      const { service } = makeService({ status: ProductStatus.ACTIVE, ownerId: 'someone-else' });
      await rejects(
        () => service.softDeleteProduct('p1', OWNER, 'user'),
        PRODUCT_ERROR_CODE.PRODUCT_FORBIDDEN,
        'deleting somebody else\u2019s product',
      );
    },
  },
  {
    name: 'auctionable: a published product with an image and no live auction passes',
    run: async () => {
      const { service } = makeService({ status: ProductStatus.ACTIVE });
      const product = await service.assertAuctionable('p1', OWNER, 'user');
      assert.equal(product.id, 'p1');
    },
  },
  {
    name: 'auctionable: a draft cannot be auctioned',
    run: async () => {
      const { service } = makeService({ status: ProductStatus.DRAFT });
      await rejects(
        () => service.assertAuctionable('p1', OWNER, 'user'),
        PRODUCT_MESSAGE.PRODUCT_NOT_AUCTIONABLE,
        'auctioning an unpublished product',
      );
    },
  },
  {
    name: 'auctionable: a second live auction on one product is refused',
    run: async () => {
      const { service } = makeService({
        status: ProductStatus.ACTIVE,
        auctionStatus: AuctionStatus.PENDING,
      });
      await rejects(
        () => service.assertAuctionable('p1', OWNER, 'user'),
        PRODUCT_MESSAGE.PRODUCT_HAS_LIVE_AUCTION,
        'double-listing one item',
      );
    },
  },
  {
    // A field the caller sent expecting it to apply must never be quietly dropped:
    // the seller would rename their listing here and see the old name everywhere.
    name: 'listing: product-owned fields sent with product_id are refused, not ignored',
    run: async () => {
      const auctionService = makeAuctionService();

      for (const field of ['name', 'category_id', 'description', 'condition']) {
        let message = '';
        try {
          await auctionService.listingAuction(
            { product_id: '5', starting_price: 100, [field]: 'something' },
            OWNER,
            'user',
          );
        } catch (error: any) {
          message = error.message;
        }
        assert.match(message, new RegExp(field), `${field} must be reported as refused`);
        assert.match(message, /belong to the product/, `${field} must explain why`);
      }
    },
  },
  {
    name: 'listing: product_id alone reaches the product rules',
    run: async () => {
      let asserted = '';
      const auctionService = makeAuctionService((id) => { asserted = id; });

      await auctionService.listingAuction(
        { product_id: '5', starting_price: 100 },
        OWNER,
        'user',
      );

      assert.equal(asserted, '5', 'a clean mode-A payload must go through assertAuctionable');
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
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
