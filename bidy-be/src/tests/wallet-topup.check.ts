/**
 * Smallest runnable check for wallet top-up semantics.
 *
 *   npx tsx src/tests/wallet-topup.check.ts
 *
 * Drives OrderService.processSepayWebhook against an in-memory DataSource/EntityManager stub.
 * Covers:
 * - a note matching the top-up code credits the wallet;
 * - a note matching BIDY{id} does not take the top-up branch;
 * - an unparseable note credits nothing;
 * - a replayed provider_transaction_id credits once and still answers 200;
 * - the credited amount comes from transferAmount, not from the body;
 * - the amount stays a string end to end — assert typeof === 'string' on what reaches postEntry.
 */
import assert from 'node:assert/strict';
import { OrderService } from '../modules/order/order.service.js';
import { OrderStatus } from '../modules/order/enum/order-status.enum.js';
import { Transaction } from '../modules/order/entity/transaction.entity.js';
import { Order } from '../modules/order/entity/order.entity.js';
import { Wallet } from '../modules/wallet/entity/wallet.entity.js';
import { notificationService } from '../modules/notification/notification.service.js';
import { NotificationType } from '../modules/notification/enum/notification-type.enum.js';
import { NotificationCategory } from '../modules/notification/enum/notification-category.enum.js';
import { NotificationPriority } from '../modules/notification/enum/notification-priority.enum.js';

interface HarnessSetup {
  transactions?: any[];
  orders?: any[];
  /** Drop every wallet, to exercise the hard failure when a buyer has none. */
  noWallet?: boolean;
}

function createHarness(setup: HarnessSetup = {}) {
  const transactions: any[] = setup.transactions ?? [];
  const orders: any[] = setup.orders ?? [];
  const savedTransactions: any[] = [];
  const savedOrders: any[] = [];
  const postEntryCalls: any[] = [];

  // The buyer's wallet is created during registration and backfilled for every existing
  // user, so the money paths resolve it and fail hard when it is absent rather than
  // creating one mid-webhook. `setup.noWallet` exercises that failure.
  const wallets: any[] = setup.noWallet
    ? []
    : [
        { id: '20', userId: '5', balance: '0.00', status: 'active' },
        { id: '21', userId: 'user-100', balance: '0.00', status: 'active' },
      ];

  const manager = {
    findOne: async (entity: any, options: any) => {
      if (entity === Wallet || entity?.name === 'Wallet') {
        return wallets.find((w) => String(w.userId) === String(options?.where?.userId)) ?? null;
      }

      // If querying Transaction
      if (
        entity === Transaction ||
        entity?.name === 'Transaction' ||
        options?.where?.providerTransactionId !== undefined ||
        options?.where?.walletId !== undefined
      ) {
        if (options?.where?.providerTransactionId) {
          const found = transactions.find(
            (t) => t.providerTransactionId === options.where.providerTransactionId,
          );
          return found ?? null;
        }
        if (options?.where?.id) {
          const found = transactions.find((t) => String(t.id) === String(options.where.id));
          return found ?? null;
        }
      }

      // If querying Order
      if (
        entity === Order ||
        entity?.name === 'Order' ||
        options?.where?.buyer_id !== undefined ||
        options?.where?.seller_id !== undefined
      ) {
        if (options?.where?.id) {
          const found = orders.find((o) => String(o.id) === String(options.where.id));
          return found ?? null;
        }
      }

      return null;
    },
    create: (_entity: any, data: any) => ({ ...data }),
    save: async (_entity: any, data: any) => {
      if (
        data.transactionStatus !== undefined ||
        data.providerTransactionId !== undefined ||
        data.walletId !== undefined
      ) {
        savedTransactions.push(data);
        const idx = transactions.findIndex((t) => String(t.id) === String(data.id));
        if (idx >= 0) {
          transactions[idx] = data;
        } else {
          transactions.push(data);
        }
        return data;
      }
      if (data.payment_status !== undefined || data.buyer_id !== undefined) {
        savedOrders.push(data);
        const idx = orders.findIndex((o) => String(o.id) === String(data.id));
        if (idx >= 0) {
          orders[idx] = data;
        } else {
          orders.push(data);
        }
        return data;
      }
      return data;
    },
  };

  const dataSource = {
    transaction: async (fn: (m: any) => Promise<any>) => fn(manager),
  } as any;

  const walletLedgerService = {
    postEntry: async (_manager: any, entry: any) => {
      postEntryCalls.push(entry);
      return {
        id: 'ledger-' + postEntryCalls.length,
        ...entry,
        balanceAfter: '1000000.00',
      };
    },
  } as any;

  const service = new OrderService(null as any, dataSource, walletLedgerService);

  return {
    service,
    transactions,
    orders,
    savedTransactions,
    savedOrders,
    postEntryCalls,
  };
}

const cases: { name: string; run: () => Promise<void> }[] = [
  {
    name: 'a note matching the top-up code credits the wallet',
    run: async () => {
      const pendingTx = {
        id: '1',
        userId: 'user-100',
        walletId: 'wallet-100',
        amount: '100000.00',
        paymentMethod: 'sepay',
        transactionStatus: 'pending',
        providerTransactionId: null,
      };
      const { service, postEntryCalls, savedTransactions } = createHarness({
        transactions: [pendingTx],
      });

      const payload = {
        id: 88801,
        transferType: 'in',
        transferAmount: 250000,
        content: 'BIDYTOPUP001 nap tien vao vi',
      };

      const result = await service.processSepayWebhook(payload);

      assert.equal(result.success, true);
      assert.equal(postEntryCalls.length, 1, 'postEntry must be called once');
      const entry = postEntryCalls[0];
      assert.equal(entry.walletId, 'wallet-100');
      assert.equal(entry.type, 'topup_success');
      assert.equal(entry.amount, '250000.00');
      assert.equal(entry.idempotencyKey, 'sepay:88801');
      assert.equal(pendingTx.transactionStatus, 'success');
      assert.equal(pendingTx.providerTransactionId, '88801');
      assert.equal(savedTransactions.length, 1);
    },
  },
  {
    name: 'a note matching BIDY{id} does not take the top-up branch',
    run: async () => {
      const order = {
        id: '1',
        buyer_id: 'user-100',
        final_price: 500000,
        total_amount: 500000,
        payment_status: OrderStatus.PENDING,
      };
      const { service, postEntryCalls, savedOrders } = createHarness({
        orders: [order],
      });

      const payload = {
        id: 88802,
        transferType: 'in',
        transferAmount: 500000,
        content: 'BIDY001 thanh toan don hang',
      };

      const result = await service.processSepayWebhook(payload);

      assert.equal(result.success, true);
      assert.equal(postEntryCalls.length, 0, 'postEntry must NOT be called for order payment');
      assert.equal(order.payment_status, OrderStatus.PAID);
      assert.equal(savedOrders.length, 1);
    },
  },
  {
    name: 'an unparseable note credits nothing',
    run: async () => {
      const { service, postEntryCalls, savedTransactions } = createHarness();

      const payload = {
        id: 88803,
        transferType: 'in',
        transferAmount: 500000,
        content: 'Chuyen tien khong ro ma don hang hay ma nap vi',
      };

      const result = await service.processSepayWebhook(payload);

      assert.equal(result.success, true, 'answers 200 OK so Sepay does not endlessly retry');
      assert.match(result.message, /Unparseable transfer note/i);
      assert.equal(postEntryCalls.length, 0, 'must credit nothing');
      assert.equal(savedTransactions.length, 0, 'must record no transactions');
    },
  },
  {
    name: 'a replayed provider_transaction_id credits once and still answers 200',
    run: async () => {
      const existingTx = {
        id: '1',
        userId: 'user-100',
        walletId: 'wallet-100',
        amount: '200000.00',
        paymentMethod: 'sepay',
        transactionStatus: 'success',
        providerTransactionId: '88804',
      };
      const { service, postEntryCalls, savedTransactions } = createHarness({
        transactions: [existingTx],
      });

      const payload = {
        id: 88804,
        transferType: 'in',
        transferAmount: 200000,
        content: 'BIDYTOPUP001 nap tien',
      };

      const result = await service.processSepayWebhook(payload);

      assert.equal(result.success, true, 'returns 200 OK');
      assert.match(result.message, /Transaction already processed/i);
      assert.equal(postEntryCalls.length, 0, 'must not credit wallet again');
      assert.equal(savedTransactions.length, 0, 'must not save transaction again');
    },
  },
  {
    name: 'the credited amount comes from transferAmount, not from the body',
    run: async () => {
      const pendingTx = {
        id: '1',
        userId: 'user-100',
        walletId: 'wallet-100',
        amount: '50000.00', // client originally requested 50k
        paymentMethod: 'sepay',
        transactionStatus: 'pending',
        providerTransactionId: null,
      };
      const { service, postEntryCalls } = createHarness({
        transactions: [pendingTx],
      });

      // Attacker sends extra fields in JSON body claiming amount is 999,999,999
      const payload = {
        id: 88805,
        transferType: 'in',
        transferAmount: 150000, // actual verified bank deposit is 150,000
        amount: 999999999,
        totalAmount: 999999999,
        clientAmount: 999999999,
        content: 'BIDYTOPUP001',
      };

      const result = await service.processSepayWebhook(payload);

      assert.equal(result.success, true);
      assert.equal(postEntryCalls.length, 1);
      assert.equal(
        postEntryCalls[0].amount,
        '150000.00',
        'credited amount must match transferAmount exactly',
      );
      assert.notEqual(postEntryCalls[0].amount, '999999999');
      assert.notEqual(postEntryCalls[0].amount, '50000.00');
    },
  },
  {
    name: 'the amount stays a string end to end — assert typeof === string on what reaches postEntry',
    run: async () => {
      const pendingTx = {
        id: '1',
        userId: 'user-100',
        walletId: 'wallet-100',
        amount: '100000.00',
        paymentMethod: 'sepay',
        transactionStatus: 'pending',
        providerTransactionId: null,
      };
      const { service, postEntryCalls } = createHarness({
        transactions: [pendingTx],
      });

      const payload = {
        id: 88806,
        transferType: 'in',
        transferAmount: 300000,
        content: 'BIDYTOPUP001',
      };

      await service.processSepayWebhook(payload);

      assert.equal(postEntryCalls.length, 1);
      const creditedAmount = postEntryCalls[0].amount;
      assert.strictEqual(
        typeof creditedAmount,
        'string',
        'credited amount reaching postEntry must be a string',
      );
      assert.strictEqual(
        creditedAmount,
        '300000.00',
        'credited amount must be canonical decimal(14,2) string',
      );
    },
  },
  {
    name: 'invalid or non-positive transferAmount is rejected without crediting',
    run: async () => {
      const pendingTx = {
        id: '1',
        userId: 'user-100',
        walletId: 'wallet-100',
        amount: '100000.00',
        paymentMethod: 'sepay',
        transactionStatus: 'pending',
        providerTransactionId: null,
      };
      const { service, postEntryCalls } = createHarness({
        transactions: [pendingTx],
      });

      const negativeResult = await service.processSepayWebhook({
        id: 88807,
        transferType: 'in',
        transferAmount: -50000,
        content: 'BIDYTOPUP001',
      });
      assert.equal(negativeResult.success, false);
      assert.equal(postEntryCalls.length, 0);

      const nanResult = await service.processSepayWebhook({
        id: 88808,
        transferType: 'in',
        transferAmount: 'invalid_number',
        content: 'BIDYTOPUP001',
      });
      assert.equal(nanResult.success, false);
      assert.equal(postEntryCalls.length, 0);
    },
  },
  {
    name: 'a buyer with no wallet is a hard failure, never a guessed wallet id',
    run: async () => {
      // The code once fell back to `order.buyer_id ?? '1'` here. buyer_id is a user id,
      // not a wallet id, and '1' is the platform wallet — so a buyer without a wallet had
      // their money credited to the platform's own account. Nothing errored and every
      // invariant still held, because that wallet's ledger and balance agreed with each
      // other. Money moving to a guessed account must fail loudly instead.
      const h = createHarness({
        noWallet: true,
        transactions: [{ id: '1', userId: '5', walletId: '20', transactionStatus: 'pending' }],
        orders: [{ id: '1', buyer_id: 'user-100', total_amount: '500000.00', final_price: '500000.00', payment_status: 'pending' }],
      });

      await assert.rejects(
        () => h.service.processSepayWebhook({
          id: 77777,
          transferType: 'in',
          transferAmount: '500000.00',
          code: 'BIDY001',
          content: 'BIDY001 thanh toan',
        }),
        /BUYER_WALLET_NOT_FOUND/,
      );

      assert.deepEqual(h.postEntryCalls, [], 'no ledger entry may be written when the wallet is unknown');
    },
  },
  {
    name: 'top-up via webhook creates TOPUP_SUCCESS notification for the user',
    run: async () => {
      const pendingTx = {
        id: '1',
        userId: 'user-100',
        walletId: 'wallet-100',
        amount: '100000.00',
        paymentMethod: 'sepay',
        transactionStatus: 'pending',
        providerTransactionId: null,
      };
      const { service } = createHarness({
        transactions: [pendingTx],
      });

      const sentNotifications: any[] = [];
      const originalCreate = notificationService.createNotification;
      notificationService.createNotification = (async (data: any) => {
        sentNotifications.push(data);
        return data;
      }) as any;

      try {
        const payload = {
          id: 88809,
          transferType: 'in',
          transferAmount: 100000,
          content: 'BIDYTOPUP001 nap tien',
        };

        const result = await service.processSepayWebhook(payload);

        assert.equal(result.success, true);
        assert.equal(sentNotifications.length, 1, 'must create exactly one notification');
        const notif = sentNotifications[0];
        assert.equal(notif.recipient, 'user-100');
        assert.equal(notif.type, NotificationType.TOPUP_SUCCESS);
        assert.equal(notif.category, NotificationCategory.ACCOUNT);
        assert.equal(notif.priority, NotificationPriority.NORMAL);
        assert.equal(notif.title, 'Nạp tiền thành công');
        assert.equal(notif.message, 'Đã cộng 100000.00 VNĐ vào ví của bạn.');
        assert.deepEqual(notif.relatedData, {
          transactionId: '1',
          amount: '100000.00',
        });
      } finally {
        notificationService.createNotification = originalCreate;
      }
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
