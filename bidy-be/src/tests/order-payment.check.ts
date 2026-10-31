/**
 * Smallest runnable check for checkout payment semantics.
 *
 *   npx tsx src/tests/order-payment.check.ts
 *
 * Drives OrderService.processPayment against an in-memory DataSource/EntityManager
 * stub — no database required. It fails if the batch stops being atomic, stops
 * locking the rows it checks, or stops rejecting partially-claimed batches.
 */
import assert from 'node:assert/strict';
import { OrderService } from '../modules/order/order.service.js';
import { OrderStatus } from '../modules/order/enum/order-status.enum.js';

function makeOrder(id: string, price: number) {
  return { id, final_price: price, payment_status: OrderStatus.PENDING } as any;
}

function makeDataSource(ordersFound: any[]) {
  const calls = { transactions: 0, findOptions: null as any, saved: [] as any[] };

  const manager = {
    find: async (_entity: unknown, options: any) => {
      calls.findOptions = options;
      return ordersFound;
    },
    create: (_entity: unknown, data: any) => data,
    save: async (_entity: unknown, data: any) => {
      calls.saved.push(data);
      return data;
    },
  };

  const dataSource = {
    transaction: async (fn: (m: any) => Promise<unknown>) => {
      calls.transactions++;
      return await fn(manager);
    },
  } as any;

  return { dataSource, calls };
}

/**
 * One QR-payment world: an order, the buyer's wallet, and a ledger service that records
 * the legs instead of writing them. Phase 4D routes QR payments through the wallet, so
 * these scenarios assert on ledger legs rather than on a transactions row.
 */
function qrWorld({ total, received }: { total: number; received: string }) {
  const order: any = {
    id: '1',
    buyer_id: 'u1',
    total_amount: String(total),
    final_price: String(total),
    payment_status: OrderStatus.PENDING,
    fund_status: 'none',
  };
  const wallet = { id: '20', userId: 'u1', balance: '0.00', status: 'active' };
  const legs: any[] = [];

  const manager: any = {
    findOne: async (entity: any, options: any) => {
      if (entity?.name === 'Wallet') return wallet;
      if (options.where?.providerTransactionId) return null;
      if (options.where?.id === '1') return order;
      return null;
    },
    create: (_entity: any, data: any) => data,
    save: async (_entity: any, data: any) => data,
  };

  const walletLedgerService: any = {
    postEntry: async (_m: any, entry: any) => { legs.push(entry); return entry; },
    postTransfer: async (_m: any, entries: any[]) => { legs.push(...entries); return entries; },
  };

  const dataSource: any = { transaction: async (fn: (m: any) => Promise<any>) => fn(manager) };
  const service = new OrderService(null as any, dataSource, walletLedgerService);

  const payload = {
    id: 99999,
    gateway: 'MBBank',
    transferType: 'in',
    transferAmount: received,
    code: 'BIDY001',
    content: 'BIDY001 thanh toan don hang',
  };

  return { service, order, legs, payload };
}

const cases: { name: string; run: () => Promise<void> }[] = [
  {
    name: 'empty orderIds is rejected before touching the database',
    run: async () => {
      const { dataSource, calls } = makeDataSource([]);
      const service = new OrderService(null as any, dataSource);
      await assert.rejects(() => service.processPayment('u1', [], 'vnpay'), /INVALID_ORDER_IDS/);
      assert.equal(calls.transactions, 0);
    },
  },
  {
    name: 'batch runs in one transaction and locks the rows it checks',
    run: async () => {
      const { dataSource, calls } = makeDataSource([makeOrder('o1', 100), makeOrder('o2', 50)]);
      const service = new OrderService(null as any, dataSource);

      const result = await service.processPayment('u1', ['o1', 'o2'], 'vnpay');

      assert.equal(calls.transactions, 1, 'must run inside exactly one transaction');
      assert.deepEqual(calls.findOptions.lock, { mode: 'pessimistic_write' }, 'orders must be row-locked');
      assert.equal(result.totalAmount, 150);
    },
  },
  {
    name: 'one Transaction row per order, sharing the payment group id',
    run: async () => {
      const { dataSource, calls } = makeDataSource([makeOrder('o1', 100), makeOrder('o2', 50)]);
      const service = new OrderService(null as any, dataSource);

      const result = await service.processPayment('u1', ['o1', 'o2'], 'vnpay');

      const txRows = calls.saved.filter(r => r.providerTransactionId !== undefined);
      assert.equal(txRows.length, 2);
      assert.ok(txRows.every(r => r.providerTransactionId === result.transactionId));
      assert.ok(txRows.every(r => r.transactionStatus === OrderStatus.PROCESSING));
    },
  },
  {
    name: 'a batch where some order was already claimed is rejected whole',
    run: async () => {
      // Only one of the two requested orders still qualifies as PENDING.
      const { dataSource } = makeDataSource([makeOrder('o1', 100)]);
      const service = new OrderService(null as any, dataSource);

      await assert.rejects(
        () => service.processPayment('u1', ['o1', 'o2'], 'vnpay'),
        /INVALID_OR_ALREADY_PAID_ORDERS/,
      );
    },
  },
  {
    name: 'getOrderPaymentQr rejects when order is missing, forbidden, or already paid',
    run: async () => {
      const orderRepo = {
        findOne: async ({ where }: any) => {
          if (where.id === 'missing') return null;
          if (where.id === 'other-user') return { id: 'other-user', buyer_id: 'other', payment_status: OrderStatus.PENDING };
          if (where.id === 'paid') return { id: 'paid', buyer_id: 'u1', payment_status: OrderStatus.PAID };
          return null;
        },
      } as any;
      const service = new OrderService(orderRepo, null as any);

      await assert.rejects(() => service.getOrderPaymentQr('u1', 'missing'), /ORDER_NOT_FOUND/);
      await assert.rejects(() => service.getOrderPaymentQr('u1', 'other-user'), /FORBIDDEN/);
      await assert.rejects(() => service.getOrderPaymentQr('u1', 'paid'), /ORDER_ALREADY_PAID/);
    },
  },
  {
    name: 'getOrderPaymentQr pads short order IDs to at least 3 digits (e.g. BIDY001)',
    run: async () => {
      const order = {
        id: '1',
        buyer_id: 'u1',
        total_amount: 100000,
        final_price: 100000,
        payment_status: OrderStatus.PENDING,
        payment_deadline: new Date('2026-10-01T00:00:00Z'),
      };
      const service = new OrderService({ findOne: async () => order } as any, null as any);
      const result = await service.getOrderPaymentQr('u1', '1');

      assert.equal(result.paymentCode, 'BIDY001', 'order 1 must be padded to BIDY001');
      assert.ok(result.qrCodeUrl.includes('des=BIDY001'));
    },
  },
  {
    name: 'processSepayWebhook pays an exact-amount QR order through the wallet (4D)',
    run: async () => {
      const w = qrWorld({ total: 500000, received: '500000.00' });
      const result = await w.service.processSepayWebhook(w.payload);

      assert.equal(result.success, true);
      assert.equal(w.order.payment_status, OrderStatus.PAID);
      assert.equal(w.order.fund_status, 'held');
      assert.equal(w.order.payment_channel, 'qr_direct', 'a QR payment is not a wallet payment');

      // Pass-through: every dong received is credited, then exactly the order amount leaves.
      assert.deepEqual(
        w.legs.map((l: any) => [l.type, l.amount]),
        [
          ['topup_success', '500000.00'],
          ['payment', '-500000.00'],
          ['payment_escrow_in', '500000.00'],
        ],
      );
      assert.equal(w.legs[0].idempotencyKey, 'sepay:99999');
      assert.equal(w.legs[1].idempotencyKey, 'order_payment:1');
      assert.equal(w.legs[2].idempotencyKey, 'order_escrow_in:1');
      for (const leg of w.legs) {
        assert.equal(typeof leg.amount, 'string', 'money must never reach the ledger as a number');
      }
    },
  },
  {
    // 4E: the old code wrote an `underpaid` transaction row and credited the buyer
    // nothing, so the money hung in limbo with only a log line to find it by.
    name: 'processSepayWebhook credits an underpaid QR transfer and leaves the order unpaid (4E)',
    run: async () => {
      const w = qrWorld({ total: 500000, received: '400000.00' });
      const result = await w.service.processSepayWebhook(w.payload);

      assert.equal(result.success, true);
      assert.notEqual(w.order.payment_status, OrderStatus.PAID, 'a short transfer must not mark the order paid');
      assert.equal(w.order.fund_status ?? 'none', 'none', 'nothing may enter escrow on an underpayment');

      assert.deepEqual(
        w.legs.map((l: any) => [l.type, l.amount]),
        [['topup_success', '400000.00']],
        'the buyer keeps what actually arrived, and only that',
      );
    },
  },
  {
    // 4E: the old comparison was `<` only, so an overpayment was marked paid and the
    // surplus was written nowhere at all — it simply vanished.
    name: 'processSepayWebhook keeps the surplus of an overpaid QR transfer in the wallet (4E)',
    run: async () => {
      const w = qrWorld({ total: 500000, received: '530000.00' });
      const result = await w.service.processSepayWebhook(w.payload);

      assert.equal(result.success, true);
      assert.equal(w.order.payment_status, OrderStatus.PAID, 'an overpayment still pays the order');
      assert.equal(w.order.fund_status, 'held');

      assert.deepEqual(
        w.legs.map((l: any) => [l.type, l.amount]),
        [
          ['topup_success', '530000.00'],
          ['payment', '-500000.00'],
          ['payment_escrow_in', '500000.00'],
        ],
        'the full amount is credited; escrow takes total_amount; 30000.00 stays in the wallet',
      );
    },
  },
  {
    name: 'processSepayWebhook is idempotent and handles duplicate sepay IDs',
    run: async () => {
      const existingTx = { id: 'tx-1', providerTransactionId: '99999', orderId: '1' };
      const manager = {
        findOne: async (_entity: any, options: any) => {
          if (options.where?.providerTransactionId === '99999') return existingTx;
          return null;
        },
      };
      const dataSource = {
        transaction: async (fn: (m: any) => Promise<any>) => fn(manager),
      } as any;

      const service = new OrderService(null as any, dataSource);
      const result = await service.processSepayWebhook({
        id: 99999,
        transferType: 'in',
        transferAmount: 500000,
        code: 'BIDY001',
      });

      assert.equal(result.success, true);
      assert.equal(result.message, 'Transaction already processed');
    },
  },
  {
    name: 'getOrderStatus returns order status and checks buyer/seller permissions',
    run: async () => {
      const order = {
        id: '1',
        buyer_id: 'u1',
        seller_id: 'u2',
        payment_status: OrderStatus.PAID,
        shipping_status: 'pending',
        final_price: 500000,
        total_amount: 500000,
        payment_deadline: new Date(),
      };
      const orderRepo = {
        findOne: async (options: any) => {
          if (options.where?.id === '1') return order;
          return null;
        },
      } as any;

      const service = new OrderService(orderRepo, null as any);

      // Buyer can view
      const buyerResult = await service.getOrderStatus('u1', '1');
      assert.equal(buyerResult.orderId, '1');
      assert.equal(buyerResult.paymentStatus, OrderStatus.PAID);
      assert.equal(buyerResult.isPaid, true);

      // Seller can view
      const sellerResult = await service.getOrderStatus('u2', '1');
      assert.equal(sellerResult.orderId, '1');

      // Stranger is rejected with FORBIDDEN
      await assert.rejects(() => service.getOrderStatus('u3', '1'), /FORBIDDEN/);

      // Missing order is rejected with ORDER_NOT_FOUND
      await assert.rejects(() => service.getOrderStatus('u1', 'nonexistent'), /ORDER_NOT_FOUND/);
    },
  },
  {
    name: 'getWonAuctions returns pure camelCase fields and calculates summary counts',
    run: async () => {
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const futureDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const mockOrders: any[] = [
        {
          id: '1',
          buyer_id: 'u1',
          seller_id: 'u2',
          auction_id: 'a1',
          shipping_address_id: 'addr1',
          final_price: 500000,
          shipping_fee: 30000,
          total_amount: 530000,
          payment_status: OrderStatus.PENDING,
          shipping_status: 'pending',
          tracking_number: null,
          payment_deadline: futureDeadline,
          fund_status: 'none',
          platform_fee: null,
          seller_payout: null,
          fee_rate: null,
          payment_channel: null,
          delivered_at: null,
          released_at: null,
          released_by: null,
          created_at: new Date(now.getTime() - 1000),
          updated_at: new Date(now.getTime() - 1000),
          auction: {
            id: 'a1',
            currentPrice: 500000,
            product: {
              name: 'Test Product 1',
              description: 'Desc 1',
              images: [],
            },
          },
        },
        {
          id: '2',
          buyer_id: 'u1',
          seller_id: 'u2',
          auction_id: 'a2',
          shipping_address_id: null,
          final_price: 1000000,
          shipping_fee: 0,
          total_amount: 1000000,
          payment_status: OrderStatus.PENDING,
          shipping_status: 'pending',
          tracking_number: null,
          payment_deadline: pastDeadline,
          fund_status: 'none',
          platform_fee: null,
          seller_payout: null,
          fee_rate: null,
          payment_channel: null,
          delivered_at: null,
          released_at: null,
          released_by: null,
          created_at: new Date(now.getTime() - 5000),
          updated_at: new Date(now.getTime() - 5000),
          auction: null,
        },
        {
          id: '3',
          buyer_id: 'u1',
          seller_id: 'u2',
          auction_id: 'a3',
          shipping_address_id: 'addr2',
          final_price: 200000,
          shipping_fee: 20000,
          total_amount: 220000,
          payment_status: OrderStatus.PAID,
          shipping_status: 'delivering',
          tracking_number: 'TRK123',
          payment_deadline: pastDeadline,
          fund_status: 'held',
          platform_fee: '10000.00',
          seller_payout: '190000.00',
          fee_rate: '0.0500',
          payment_channel: 'wallet',
          delivered_at: null,
          released_at: null,
          released_by: null,
          created_at: new Date(now.getTime() - 10000),
          updated_at: new Date(now.getTime() - 1000),
          auction: {
            id: 'a3',
            currentPrice: 200000,
            product: {
              name: 'Test Product 3',
              description: 'Desc 3',
              images: [],
            },
          },
        },
      ];

      const orderRepo = {
        find: async () => mockOrders,
      } as any;

      const service = new OrderService(orderRepo, null as any);
      const res = await service.getWonAuctions('u1');

      assert.equal(res.orders.length, 3);
      assert.deepEqual(res.summary, {
        total: 3,
        pending: 1, // order 1 is pending & not overdue
        paid: 1,    // order 3 is paid
        overdue: 1, // order 2 is pending & past deadline
      });

      const order1 = res.orders[0];
      // Assert no snake_case or _id keys present
      const forbiddenKeys = [
        '_id',
        'buyer_id',
        'seller_id',
        'auction_id',
        'shipping_address_id',
        'final_price',
        'shipping_fee',
        'total_amount',
        'payment_status',
        'shipping_status',
        'tracking_number',
        'payment_deadline',
        'fund_status',
        'platform_fee',
        'seller_payout',
        'fee_rate',
        'payment_channel',
        'delivered_at',
        'released_at',
        'released_by',
        'created_at',
        'updated_at',
        'bid_id',
        'auction',
      ];

      for (const key of forbiddenKeys) {
        assert.equal(key in order1, false, `Key ${key} must not be present in order response`);
      }

      // Assert camelCase keys are present and correct
      assert.equal(order1.id, '1');
      assert.equal(order1.buyerId, 'u1');
      assert.equal(order1.sellerId, 'u2');
      assert.equal(order1.auctionId, 'a1');
      assert.equal(order1.shippingAddressId, 'addr1');
      assert.equal(order1.price, 500000);
      assert.equal(order1.shippingFee, 30000);
      assert.equal(order1.totalAmount, 530000);
      assert.equal(order1.paymentStatus, OrderStatus.PENDING);
      assert.equal(order1.shippingStatus, 'pending');
      assert.equal(order1.fundStatus, 'none');
      assert.equal(order1.isOverdue, false);
      assert.ok(order1.bidId);
      assert.equal(order1.bidId?.id, 'a1');
      assert.equal(order1.bidId?.name, 'Test Product 1');
      assert.equal('_id' in (order1.bidId || {}), false, '_id must not be in bidId');
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
