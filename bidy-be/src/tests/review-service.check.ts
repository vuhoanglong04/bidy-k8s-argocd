/**
 * Smallest runnable check for review creation and seller replies.
 *
 *   npx tsx src/tests/review-service.check.ts
 *
 * Drives ReviewService against in-memory repository/DataSource stubs — no database
 * required. It fails if a non-buyer or an unpaid order can be reviewed, if the
 * reviewee stops being taken from the order rather than the client, if a duplicate
 * (unique-violation) stops mapping to the domain error, or if anonymous reviews
 * start leaking the reviewer.
 *
 * It also pins the failure contract itself: every domain error the controller maps
 * has to go out with its code in `error_code`, because two different failures can
 * share one HTTP status (REVIEW_ALREADY_EXISTS and REPLY_ALREADY_EXISTS are both
 * 409) and a client branching on the status alone cannot tell them apart.
 */
import assert from 'node:assert/strict';
import { ReviewService } from '../modules/review/review.service.js';
import { REVIEW_MESSAGE } from '../common/messages/review/review.message.js';
import { ReviewController } from '../modules/review/review.controller.js';
import { OrderStatus } from '../modules/order/enum/order-status.enum.js';

const BUYER = 'u-buyer';
const SELLER = 'u-seller';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    buyer_id: BUYER,
    seller_id: SELLER,
    payment_status: OrderStatus.PAID,
    ...overrides,
  } as any;
}

/**
 * @param saveError optional error thrown by the first Review save, used to
 *                  simulate the unique index on reviews.order_id firing.
 */
function makeService(order: any, saveError?: any) {
  const saved: Record<string, any[]> = { Review: [], ReviewMedia: [], reply: [] };

  const repoFor = (name: string) => ({
    create: (data: any) => ({ ...data }),
    save: async (data: any) => {
      if (name === 'Review' && saveError) throw saveError;
      const rows = Array.isArray(data) ? data : [data];
      saved[name].push(...rows.map((r, i) => ({ id: `${name}-${i + 1}`, ...r })));
      return Array.isArray(data) ? saved[name] : saved[name][saved[name].length - 1];
    },
  });

  const manager = {
    getRepository: (entity: any) => repoFor(entity?.name === 'ReviewMedia' ? 'ReviewMedia' : 'Review'),
  };

  const dataSource = {
    transaction: async (fn: (m: any) => Promise<unknown>) => fn(manager),
  } as any;

  const reviewRepository = {
    findOne: async () => null,
    createQueryBuilder: () => ({}),
  } as any;

  const replyRepository = {
    create: (data: any) => ({ ...data }),
    save: async (data: any) => {
      saved.reply.push(data);
      return data;
    },
  } as any;

  const orderRepository = { findOne: async () => order } as any;

  const service = new ReviewService(dataSource, reviewRepository, replyRepository, orderRepository);
  return { service, saved, reviewRepository, replyRepository };
}

/** Captures what a controller handler actually sent, without an HTTP server. */
function fakeRes() {
  const captured: any = {};
  const res: any = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(body: any) {
      captured.body = body;
      return res;
    },
    captured,
  };
  return res;
}

const cases: { name: string; run: () => Promise<void> }[] = [
  {
    name: 'every mapped review failure carries its code in error_code',
    run: async () => {
      const expected: [string, number][] = [
        [REVIEW_MESSAGE.ORDER_NOT_FOUND, 404],
        [REVIEW_MESSAGE.REVIEW_NOT_FOUND, 404],
        [REVIEW_MESSAGE.NOT_ORDER_BUYER, 403],
        [REVIEW_MESSAGE.NOT_REVIEWEE, 403],
        [REVIEW_MESSAGE.ORDER_NOT_PAID, 409],
        [REVIEW_MESSAGE.REVIEW_ALREADY_EXISTS, 409],
        [REVIEW_MESSAGE.REPLY_ALREADY_EXISTS, 409],
      ];

      for (const [code, status] of expected) {
        const controller = new ReviewController({
          createReview: async () => {
            throw new Error(code);
          },
        } as any);

        const res = fakeRes();
        await controller.createReview({ idUser: BUYER, body: {} } as any, res);

        assert.equal(res.captured.status, status, `${code} must answer ${status}`);
        assert.equal(
          res.captured.body.error_code,
          code,
          `${code} must go out in error_code, not only in the message`,
        );
      }

      // Anything unmapped stays a 500 and must not echo the internal message back.
      const controller = new ReviewController({
        createReview: async () => {
          throw new Error('column "foo" does not exist');
        },
      } as any);
      const res = fakeRes();
      await controller.createReview({ idUser: BUYER, body: {} } as any, res);
      assert.equal(res.captured.status, 500);
      assert.equal(res.captured.body.status, 'error');
      assert.ok(
        !JSON.stringify(res.captured.body).includes('column "foo"'),
        'an unmapped failure must not leak the internal error text',
      );
    },
  },
  {
    name: 'a user who is not the buyer on the order cannot review it',
    run: async () => {
      const { service } = makeService(makeOrder());
      await assert.rejects(
        () => service.createReview('u-stranger', { orderId: 'o1', productRating: 5 } as any),
        new RegExp(REVIEW_MESSAGE.NOT_ORDER_BUYER),
      );
    },
  },
  {
    name: 'an unpaid order cannot be reviewed',
    run: async () => {
      const { service } = makeService(makeOrder({ payment_status: OrderStatus.PENDING }));
      await assert.rejects(
        () => service.createReview(BUYER, { orderId: 'o1', productRating: 5 } as any),
        new RegExp(REVIEW_MESSAGE.ORDER_NOT_PAID),
      );
    },
  },
  {
    name: 'a missing order is reported as not found',
    run: async () => {
      const { service } = makeService(null);
      await assert.rejects(
        () => service.createReview(BUYER, { orderId: 'nope', productRating: 5 } as any),
        new RegExp(REVIEW_MESSAGE.ORDER_NOT_FOUND),
      );
    },
  },
  {
    name: 'reviewee comes from the order seller, never from the caller',
    run: async () => {
      const { service, saved } = makeService(makeOrder());
      await service.createReview(BUYER, {
        orderId: 'o1',
        productRating: 4,
        // A malicious client trying to redirect the review at someone else:
        revieweeId: 'u-victim',
      } as any);

      assert.equal(saved.Review.length, 1);
      assert.equal(saved.Review[0].revieweeId, SELLER);
      assert.equal(saved.Review[0].reviewerId, BUYER);
    },
  },
  {
    name: 'attached media is persisted in submission order',
    run: async () => {
      const { service, saved } = makeService(makeOrder());
      await service.createReview(BUYER, {
        orderId: 'o1',
        productRating: 5,
        mediaFileIds: ['11', '12'],
      } as any);

      assert.equal(saved.ReviewMedia.length, 2);
      assert.deepEqual(saved.ReviewMedia.map((m: any) => m.displayOrder), [0, 1]);
      assert.equal(saved.ReviewMedia[0].fileId, '11');
    },
  },
  {
    name: 'a unique violation from the DB maps to REVIEW_ALREADY_EXISTS',
    run: async () => {
      // The unique index on reviews.order_id is what actually prevents a double
      // review under concurrency; the service must translate it, not leak 23505.
      const { service } = makeService(makeOrder(), Object.assign(new Error('dup'), { code: '23505' }));
      await assert.rejects(
        () => service.createReview(BUYER, { orderId: 'o1', productRating: 5 } as any),
        new RegExp(REVIEW_MESSAGE.REVIEW_ALREADY_EXISTS),
      );
    },
  },
  {
    name: 'only the reviewed seller may reply',
    run: async () => {
      const { service, reviewRepository } = makeService(makeOrder());
      reviewRepository.findOne = async () => ({ id: 'r1', revieweeId: SELLER });

      await assert.rejects(
        () => service.createReply('r1', 'u-stranger', { comment: 'hi' }),
        new RegExp(REVIEW_MESSAGE.NOT_REVIEWEE),
      );

      const reply = await service.createReply('r1', SELLER, { comment: 'thanks' });
      assert.equal(reply.userId, SELLER);
    },
  },
  {
    name: 'a second reply maps the unique violation to REPLY_ALREADY_EXISTS',
    run: async () => {
      const { service, reviewRepository, replyRepository } = makeService(makeOrder());
      reviewRepository.findOne = async () => ({ id: 'r1', revieweeId: SELLER });
      replyRepository.save = async () => {
        throw Object.assign(new Error('dup'), { code: '23505' });
      };

      await assert.rejects(
        () => service.createReply('r1', SELLER, { comment: 'again' }),
        new RegExp(REVIEW_MESSAGE.REPLY_ALREADY_EXISTS),
      );
    },
  },
  {
    name: 'anonymous reviews never expose the reviewer',
    run: async () => {
      const { service, reviewRepository } = makeService(makeOrder());
      reviewRepository.findOne = async () => ({
        id: 'r1',
        isAnonymous: true,
        reviewerId: BUYER,
        reviewer: { id: BUYER, email: 'buyer@example.com' },
        comment: 'great',
        status: 'published',
      });

      const review = await service.findById('r1');
      assert.equal(review.comment, 'great', 'content must survive');
      assert.equal(review.reviewer, undefined);
      assert.equal(review.reviewerId, undefined);
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
