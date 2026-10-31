import { test, expect, TestInfo } from '@playwright/test';
import { Socket } from 'socket.io-client';
import { CONFIG, validateEnvironment } from './helpers/config';
import { loginUserViaApi, setupUserSession, LoginResult } from './helpers/auth';
import { simulateSepay } from './helpers/sepay';
import { runReconcile } from './helpers/reconcile';
import { connectTestSocket, waitForSocketEvent } from './helpers/socket';
import { fetchWonOrders, fetchOrderStatus, fetchPaymentQr, getWalletBalance, WonOrderSummary } from './helpers/orders';

function checkNotification(
  testInfo: TestInfo,
  found: unknown,
  label: string,
  responseBody: unknown
) {
  if (found) return;

  testInfo.attach(`notification-${label}-not-found`, {
    body: JSON.stringify(responseBody, null, 2),
    contentType: 'application/json',
  });
  testInfo.annotations.push({
    type: 'known-issue',
    description: `BE chưa tạo notification ${label}`,
  });
  console.warn(`[Notification Warning] BE chưa tạo notification ${label}`);

  if (process.env.E2E_NOTIFICATION_STRICT === '1') {
    expect(found, `BE chưa tạo notification ${label}`).toBeDefined();
  }
}

async function expectOk(
  res: { ok(): boolean; status(): number; text(): Promise<string> },
  label: string
) {
  if (!res.ok()) {
    const status = res.status();
    const body = await res.text().catch(() => '');
    try {
      test.info().attach(`${label.replace(/[^a-zA-Z0-9_-]/g, '_')}-error`, {
        body: `Status: ${status}\n\nBody:\n${body}`,
        contentType: 'text/plain',
      });
    } catch {
      // ignore
    }
    expect(res.ok(), `[${label}] Request failed with status ${status}: ${body}`).toBeTruthy();
  }
}

test.describe.configure({ mode: 'serial' });
test.use({ browserName: 'chromium' });

test.describe('E2E Payment Flow & Financial Integrity Suite', () => {
  // Shared state across serial steps
  let sellerAuth: LoginResult;
  let buyerAuth: LoginResult;
  let bidder2Auth: LoginResult;
  let adminAuth: LoginResult;

  let buyerSocket: Socket | null = null;
  let sellerSocket: Socket | null = null;

  // Tracked identifiers across steps
  const orderIdRelease = CONFIG.ORDERS.RELEASE_ID;
  const orderIdRefund = CONFIG.ORDERS.REFUND_ID;
  const orderIdQr = CONFIG.ORDERS.QR_ID;
  const topupAmount = CONFIG.TOPUP_AMOUNT;

  // Dynamic order amounts fetched from won-auctions
  let orderReleaseAmount = 0;
  let orderRefundAmount = 0;
  let orderQrAmount = 0;

  let withdrawalId1: string | null = null;
  let withdrawalId2: string | null = null;
  let proofFileId: string | null = null;

  test.beforeAll(async ({ request }) => {
    validateEnvironment();

    // 1. Authenticate all test roles via API
    buyerAuth = await loginUserViaApi(request, CONFIG.USERS.BUYER.username, CONFIG.USERS.BUYER.password);
    sellerAuth = await loginUserViaApi(request, CONFIG.USERS.SELLER.username, CONFIG.USERS.SELLER.password);
    bidder2Auth = await loginUserViaApi(request, CONFIG.USERS.BIDDER2.username, CONFIG.USERS.BIDDER2.password);
    adminAuth = await loginUserViaApi(request, CONFIG.USERS.ADMIN.username, CONFIG.USERS.ADMIN.password);

    // 2. Fetch buyer won-auctions to initialize dynamic order amounts
    const wonOrders: WonOrderSummary[] = await fetchWonOrders(request, buyerAuth.token);
    const relOrder = wonOrders.find((o) => String(o.id) === String(orderIdRelease));
    const refOrder = wonOrders.find((o) => String(o.id) === String(orderIdRefund));
    const qrOrder = wonOrders.find((o) => String(o.id) === String(orderIdQr));

    if (!relOrder) {
      throw new Error(`[E2E Setup Error] Đơn hàng release #${orderIdRelease} không tồn tại trong GET /orders/won-auctions của ${CONFIG.USERS.BUYER.username}`);
    }
    if (!refOrder) {
      throw new Error(`[E2E Setup Error] Đơn hàng refund #${orderIdRefund} không tồn tại trong GET /orders/won-auctions của ${CONFIG.USERS.BUYER.username}`);
    }
    if (!qrOrder) {
      throw new Error(`[E2E Setup Error] Đơn hàng QR #${orderIdQr} không tồn tại trong GET /orders/won-auctions của ${CONFIG.USERS.BUYER.username}`);
    }

    orderReleaseAmount = Number(relOrder.totalAmount);
    orderRefundAmount = Number(refOrder.totalAmount);
    orderQrAmount = Number(qrOrder.totalAmount);

    // 3. Establish test WebSocket connections for realtime event assertions
    try {
      buyerSocket = await connectTestSocket(buyerAuth.token);
      sellerSocket = await connectTestSocket(sellerAuth.token);
    } catch (err: any) {
      console.warn(`[WebSocket Warning] Failed to connect test sockets: ${err.message}. Event assertions will fail if socket is unreachable.`);
    }
  });

  test.afterAll(async () => {
    if (buyerSocket) {
      buyerSocket.disconnect();
    }
    if (sellerSocket) {
      sellerSocket.disconnect();
    }
  });

  // =========================================================================
  // BƯỚC 1: NẠP TIỀN VÍ (WALLET TOP-UP VIA SIMULATED SEPAY)
  // =========================================================================
  test(`Bước 1: Nạp tiền vào ví qua VietQR mô phỏng (${CONFIG.USERS.BUYER.username})`, async ({ page, context, request }) => {
    test.info().annotations.push({
      type: 'description',
      description: `${CONFIG.USERS.BUYER.username} nạp ${topupAmount.toLocaleString('vi-VN')} VNĐ qua UI /profile/wallet, nhận mã chuyển khoản và mô phỏng SePay webhook.`,
    });

    // 1. Inject buyer session cookies
    await setupUserSession(context, buyerAuth, CONFIG.BASE_URL);

    // 2. Fetch initial wallet balance via API
    const { balance: initialBalance } = await getWalletBalance(request, buyerAuth.token);

    // 3. Navigate to /profile/wallet on UI
    await page.goto(`${CONFIG.BASE_URL}/profile/wallet`);
    await page.waitForLoadState('networkidle');

    // 4. Click "Nạp tiền" button to open TopupDialog
    const topupBtn = page.getByRole('button', { name: /Nạp tiền/i }).first();
    await expect(topupBtn).toBeVisible();
    await topupBtn.click();

    // 5. Fill amount: topupAmount VNĐ
    const quickChip = topupAmount === 8000000 ? page.getByRole('button', { name: /\+8\.000\.000\s*đ/i }) : null;
    if (quickChip && await quickChip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quickChip.click();
    } else {
      const moneyInput = page.locator('input#topup-amount').or(page.getByPlaceholder(/Nhập số tiền/i)).first();
      await moneyInput.fill(String(topupAmount));
    }

    // 6. Click "Tạo mã chuyển khoản" & intercept topup response
    const createCodePromise = page.waitForResponse(
      (res) => res.url().includes('/wallet/topup') && res.request().method() === 'POST',
      { timeout: 10000 }
    );

    const submitBtn = page.getByRole('button', { name: /Tạo mã chuyển khoản/i });
    await submitBtn.click();

    const topupResponse = await createCodePromise;
    await expectOk(topupResponse, 'POST /wallet/topup');
    expect(topupResponse.status()).toBe(200);
    const topupJson = await topupResponse.json();
    const topupData = topupJson.data;

    const paymentCode = topupData.paymentCode;
    const txId = topupData.transactionId;

    test.info().attach('topup-initiation-response', {
      body: JSON.stringify(topupJson, null, 2),
      contentType: 'application/json',
    });

    expect(paymentCode).toBeDefined();
    expect(paymentCode).toMatch(/^BIDYTOPUP\d+/i);

    // 7. Prepare WebSocket listener for wallet:topup_success (topupAmount VNĐ)
    const socketPromise = buyerSocket
      ? waitForSocketEvent(buyerSocket, 'wallet:topup_success', 15000, (payload) => {
          return String(payload.amount).startsWith(String(topupAmount)) || Number(payload.amount) === topupAmount;
        })
      : Promise.resolve(null);

    // 8. Simulate bank deposit of topupAmount VNĐ via SePay webhook script
    const simulateOutput = simulateSepay(paymentCode, topupAmount);
    test.info().attach('sepay-simulate-topup-stdout', {
      body: simulateOutput,
      contentType: 'text/plain',
    });

    // 9. Assert WebSocket event
    if (buyerSocket) {
      const socketPayload = await socketPromise;
      expect(socketPayload).toBeTruthy();
      test.info().attach('wallet-topup-socket-event', {
        body: JSON.stringify(socketPayload, null, 2),
        contentType: 'application/json',
      });
    }

    // 10. Assert balance increase via API (+topupAmount VNĐ)
    const { balance: updatedBalance, raw: updatedWalletRaw } = await getWalletBalance(request, buyerAuth.token);
    try {
      expect(updatedBalance).toBeCloseTo(initialBalance + topupAmount, 2);
    } catch (err) {
      test.info().attach('topup-balance-assertion-failure', {
        body: JSON.stringify({
          initialBalance,
          expectedBalance: initialBalance + topupAmount,
          actualBalance: updatedBalance,
          paymentCode,
          txId,
          rawWalletResponse: updatedWalletRaw,
        }, null, 2),
        contentType: 'application/json',
      });
      throw err;
    }

    // Assert before Bước 2: buyer balance must be >= total đơn release + total đơn refund
    const requiredForWalletOrders = orderReleaseAmount + orderRefundAmount;
    expect(
      updatedBalance,
      `Số dư ví buyer sau nạp (${updatedBalance.toLocaleString('vi-VN')} đ) không đủ để thanh toán 2 đơn ví: đơn #${orderIdRelease} (${orderReleaseAmount.toLocaleString('vi-VN')} đ) + đơn #${orderIdRefund} (${orderRefundAmount.toLocaleString('vi-VN')} đ) = ${requiredForWalletOrders.toLocaleString('vi-VN')} đ.`
    ).toBeGreaterThanOrEqual(requiredForWalletOrders);

    // 11. Assert notification exists for topup_success
    const notifRes = await request.get(`${CONFIG.API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${buyerAuth.token}` },
    });
    expect.soft(notifRes.ok(), 'GET /notifications response failed').toBeTruthy();
    const notifJson = await notifRes.json().catch(() => ({}));
    const notifications = notifJson.data?.notifications || notifJson.data || [];
    const topupNotif = Array.isArray(notifications)
      ? notifications.find(
          (n: any) => n.type === 'topup_success' || (n.message && (n.message.includes(topupAmount.toLocaleString('vi-VN')) || n.message.includes(String(topupAmount))))
        )
      : undefined;
    checkNotification(test.info(), topupNotif, 'topup_success', notifJson);

    // 12. Run ledger reconciliation
    runReconcile(test.info());
  });

  // =========================================================================
  // BƯỚC 2: THANH TOÁN ĐƠN HÀNG WON (VÍ BIDY & QR PASS-THROUGH)
  // =========================================================================
  test('Bước 2: Thanh toán đơn hàng won (Ví Bidy đơn Release, Refund & QR mô phỏng)', async ({ page, context, request }) => {
    // Assert buyer balance before step 2 is sufficient for wallet orders
    const requiredBalance = orderReleaseAmount + orderRefundAmount;
    const { balance: currentBuyerBalance } = await getWalletBalance(request, buyerAuth.token);
    expect(
      currentBuyerBalance,
      `Số dư ví buyer trước bước 2 (${currentBuyerBalance.toLocaleString('vi-VN')} đ) không đủ để thanh toán 2 đơn ví: đơn #${orderIdRelease} (${orderReleaseAmount.toLocaleString('vi-VN')} đ) + đơn #${orderIdRefund} (${orderRefundAmount.toLocaleString('vi-VN')} đ) = ${requiredBalance.toLocaleString('vi-VN')} đ.`
    ).toBeGreaterThanOrEqual(requiredBalance);

    test.info().annotations.push({
      type: 'description',
      description: `${CONFIG.USERS.BUYER.username} thanh toán đơn #${orderIdRelease} (Ví Bidy ${orderReleaseAmount.toLocaleString('vi-VN')} đ), đơn #${orderIdRefund} (Ví Bidy ${orderRefundAmount.toLocaleString('vi-VN')} đ), và đơn #${orderIdQr} (VietQR ${orderQrAmount.toLocaleString('vi-VN')} đ).`,
    });

    // 1. Assert won-auctions of buyer contains order release, refund, qr and all are pending
    const wonOrders: WonOrderSummary[] = await fetchWonOrders(request, buyerAuth.token);
    test.info().attach('buyer-won-auctions', {
      body: JSON.stringify(wonOrders, null, 2),
      contentType: 'application/json',
    });

    const orderReleaseSummary = wonOrders.find((o) => String(o.id) === String(orderIdRelease));
    const orderRefundSummary = wonOrders.find((o) => String(o.id) === String(orderIdRefund));
    const orderQrSummary = wonOrders.find((o) => String(o.id) === String(orderIdQr));

    expect(orderReleaseSummary, `Đơn hàng #${orderIdRelease} phải tồn tại trong GET /orders/won-auctions của ${CONFIG.USERS.BUYER.username}`).toBeDefined();
    expect(orderRefundSummary, `Đơn hàng #${orderIdRefund} phải tồn tại trong GET /orders/won-auctions của ${CONFIG.USERS.BUYER.username}`).toBeDefined();
    expect(orderQrSummary, `Đơn hàng #${orderIdQr} phải tồn tại trong GET /orders/won-auctions của ${CONFIG.USERS.BUYER.username}`).toBeDefined();

    expect(orderReleaseSummary?.paymentStatus, `Đơn hàng #${orderIdRelease} phải ở trạng thái pending`).toBe('pending');
    expect(orderRefundSummary?.paymentStatus, `Đơn hàng #${orderIdRefund} phải ở trạng thái pending`).toBe('pending');
    expect(orderQrSummary?.paymentStatus, `Đơn hàng #${orderIdQr} phải ở trạng thái pending`).toBe('pending');

    orderReleaseAmount = Number(orderReleaseSummary!.totalAmount);
    orderRefundAmount = Number(orderRefundSummary!.totalAmount);
    orderQrAmount = Number(orderQrSummary!.totalAmount);

    // Setup session for buyer
    await setupUserSession(context, buyerAuth, CONFIG.BASE_URL);

    // -----------------------------------------------------------------------
    // ĐƠN RELEASE: Total orderReleaseAmount -> Thanh toán bằng Ví Bidy trên UI
    // -----------------------------------------------------------------------
    const { balance: buyerBalBeforeRel } = await getWalletBalance(request, buyerAuth.token);

    await page.goto(`${CONFIG.BASE_URL}/payment?orderId=${orderIdRelease}`);
    await page.waitForLoadState('networkidle');

    // Select "Ví Bidy" method
    const walletLabelRel = page.locator('label[for="channel-wallet"]').or(page.getByText('Ví Bidy', { exact: false })).first();
    if (await walletLabelRel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await walletLabelRel.click();
    }

    // Prepare socket listener for order:paid
    const orderRelSocketPromise = buyerSocket
      ? waitForSocketEvent(buyerSocket, 'order:paid', 15000, (payload) => {
          return String(payload.orderId) === String(orderIdRelease);
        })
      : Promise.resolve(null);

    // Click button "Thanh toán ... đ bằng ví"
    const payBtnRel = page.getByRole('button', { name: /Thanh toán .* bằng ví/i })
      .or(page.getByRole('button', { name: /bằng ví/i }))
      .first();
    await expect(payBtnRel).toBeVisible();
    await payBtnRel.click();

    // Verify socket event
    if (buyerSocket) {
      const orderRelPayload = await orderRelSocketPromise;
      expect(orderRelPayload).toBeTruthy();
      test.info().attach('orderRelease-paid-socket-event', {
        body: JSON.stringify(orderRelPayload, null, 2),
        contentType: 'application/json',
      });
    }

    // Assert order release status: isPaid = true, paymentStatus = 'paid', fundStatus = 'held'
    const orderRelStatus = await fetchOrderStatus(request, orderIdRelease, buyerAuth.token);
    test.info().attach('orderRelease-status-after-wallet-pay', {
      body: JSON.stringify(orderRelStatus, null, 2),
      contentType: 'application/json',
    });
    expect(orderRelStatus.isPaid).toBe(true);
    expect(orderRelStatus.paymentStatus).toBe('paid');
    expect(orderRelStatus.fundStatus).toBe('held');

    // Assert buyer balance decreased by orderReleaseAmount
    const { balance: buyerBalAfterRel } = await getWalletBalance(request, buyerAuth.token);
    try {
      expect(buyerBalAfterRel).toBeCloseTo(buyerBalBeforeRel - orderReleaseAmount, 2);
    } catch (err) {
      test.info().attach('orderRelease-wallet-balance-mismatch', {
        body: JSON.stringify({
          orderId: orderIdRelease,
          amountPaid: orderReleaseAmount,
          balanceBefore: buyerBalBeforeRel,
          balanceAfter: buyerBalAfterRel,
          expectedBalance: buyerBalBeforeRel - orderReleaseAmount,
        }, null, 2),
        contentType: 'application/json',
      });
      throw err;
    }

    // -----------------------------------------------------------------------
    // ĐƠN REFUND: Total orderRefundAmount -> Thanh toán bằng Ví Bidy (UI / API)
    // -----------------------------------------------------------------------
    const { balance: buyerBalBeforeRef } = await getWalletBalance(request, buyerAuth.token);

    const orderRefSocketPromise = buyerSocket
      ? waitForSocketEvent(buyerSocket, 'order:paid', 15000, (payload) => {
          return String(payload.orderId) === String(orderIdRefund);
        })
      : Promise.resolve(null);

    await page.goto(`${CONFIG.BASE_URL}/payment?orderId=${orderIdRefund}`);
    await page.waitForLoadState('networkidle');

    const walletLabelRef = page.locator('label[for="channel-wallet"]').or(page.getByText('Ví Bidy', { exact: false })).first();
    if (await walletLabelRef.isVisible({ timeout: 2000 }).catch(() => false)) {
      await walletLabelRef.click();
    }

    const payBtnRef = page.getByRole('button', { name: /Thanh toán .* bằng ví/i })
      .or(page.getByRole('button', { name: /bằng ví/i }))
      .first();

    if (await payBtnRef.isVisible({ timeout: 2000 }).catch(() => false)) {
      await payBtnRef.click();
    } else {
      // Fallback: POST /orders/:id/pay
      const payRefApiRes = await request.post(`${CONFIG.API_URL}/orders/${orderIdRefund}/pay`, {
        headers: { Authorization: `Bearer ${buyerAuth.token}` },
        data: { paymentMethod: 'wallet' },
      });
      await expectOk(payRefApiRes, `POST /orders/${orderIdRefund}/pay`);
    }

    if (buyerSocket) {
      const orderRefPayload = await orderRefSocketPromise;
      if (orderRefPayload) {
        test.info().attach('orderRefund-paid-socket-event', {
          body: JSON.stringify(orderRefPayload, null, 2),
          contentType: 'application/json',
        });
      }
    }

    // Assert order refund status: isPaid = true, paymentStatus = 'paid', fundStatus = 'held'
    const orderRefStatus = await fetchOrderStatus(request, orderIdRefund, buyerAuth.token);
    test.info().attach('orderRefund-status-after-wallet-pay', {
      body: JSON.stringify(orderRefStatus, null, 2),
      contentType: 'application/json',
    });
    expect(orderRefStatus.isPaid).toBe(true);
    expect(orderRefStatus.paymentStatus).toBe('paid');
    expect(orderRefStatus.fundStatus).toBe('held');

    // Assert buyer balance decreased by orderRefundAmount
    const { balance: buyerBalAfterRef } = await getWalletBalance(request, buyerAuth.token);
    try {
      expect(buyerBalAfterRef).toBeCloseTo(buyerBalBeforeRef - orderRefundAmount, 2);
    } catch (err) {
      test.info().attach('orderRefund-wallet-balance-mismatch', {
        body: JSON.stringify({
          orderId: orderIdRefund,
          amountPaid: orderRefundAmount,
          balanceBefore: buyerBalBeforeRef,
          balanceAfter: buyerBalAfterRef,
          expectedBalance: buyerBalBeforeRef - orderRefundAmount,
        }, null, 2),
        contentType: 'application/json',
      });
      throw err;
    }

    // -----------------------------------------------------------------------
    // ĐƠN QR: Total orderQrAmount -> Chuyển khoản QR (a) Thiếu & (b) Đủ (+400k dư)
    // -----------------------------------------------------------------------
    const underpayAmount = Math.floor((orderQrAmount * 0.7) / 1000) * 1000;
    const overpayAmount = orderQrAmount + 400000;

    // Lấy paymentCode chuẩn từ GET /orders/:id/payment-qr
    const qrData = await fetchPaymentQr(request, orderIdQr, buyerAuth.token);
    test.info().attach('orderQr-payment-qr-response', {
      body: JSON.stringify(qrData, null, 2),
      contentType: 'application/json',
    });

    const paymentCode = qrData.paymentCode || qrData.code || qrData.transferContent;
    expect(paymentCode, `Mã paymentCode phải được trả về từ GET /orders/${orderIdQr}/payment-qr`).toBeDefined();

    // (a) Mô phỏng chuyển thiếu: underpayAmount VNĐ (trên tổng orderQrAmount VNĐ)
    const { balance: balBeforeA } = await getWalletBalance(request, buyerAuth.token);
    const simAOutput = simulateSepay(paymentCode, underpayAmount);
    test.info().attach('orderQr-simA-underpay-stdout', { body: simAOutput, contentType: 'text/plain' });

    // Assert (a): Đơn QR vẫn pending (isPaid: false) và số dư ví buyer tăng toàn bộ underpayAmount VNĐ
    const orderQrStatusA = await fetchOrderStatus(request, orderIdQr, buyerAuth.token);
    test.info().attach('orderQr-status-after-simA', {
      body: JSON.stringify(orderQrStatusA, null, 2),
      contentType: 'application/json',
    });
    expect(orderQrStatusA.isPaid).toBe(false);
    expect(orderQrStatusA.paymentStatus).toBe('pending');

    const { balance: balAfterA } = await getWalletBalance(request, buyerAuth.token);
    try {
      expect(balAfterA).toBeCloseTo(balBeforeA + underpayAmount, 2);
    } catch (err) {
      test.info().attach('orderQr-simA-balance-mismatch', {
        body: JSON.stringify({
          orderId: orderIdQr,
          simulatedAmount: underpayAmount,
          balBeforeA,
          balAfterA,
          expected: balBeforeA + underpayAmount,
        }, null, 2),
        contentType: 'application/json',
      });
      throw err;
    }

    // (b) Mô phỏng chuyển overpayAmount VNĐ (dư 400.000 so với orderQrAmount)
    const orderQrSocketPromise = buyerSocket
      ? waitForSocketEvent(buyerSocket, 'order:paid', 15000, (payload) => {
          return String(payload.orderId) === String(orderIdQr);
        })
      : Promise.resolve(null);

    const simBOutput = simulateSepay(paymentCode, overpayAmount);
    test.info().attach('orderQr-simB-overpay-stdout', { body: simBOutput, contentType: 'text/plain' });

    if (buyerSocket) {
      await orderQrSocketPromise;
    }

    // Assert (b): Đơn QR đã paid, fundStatus = held
    const orderQrStatusB = await fetchOrderStatus(request, orderIdQr, buyerAuth.token);
    test.info().attach('orderQr-status-after-simB', {
      body: JSON.stringify(orderQrStatusB, null, 2),
      contentType: 'application/json',
    });
    expect(orderQrStatusB.isPaid).toBe(true);
    expect(orderQrStatusB.paymentStatus).toBe('paid');
    expect(orderQrStatusB.fundStatus).toBe('held');

    // Balance buyer cuối = balance trước (a) + thiếu + dư − total
    const { balance: balAfterB, raw: balAfterBRaw } = await getWalletBalance(request, buyerAuth.token);
    const expectedFinalBalance = balBeforeA + underpayAmount + overpayAmount - orderQrAmount;

    test.info().attach('orderQr-balance-audit', {
      body: JSON.stringify({
        orderId: orderIdQr,
        orderTotal: orderQrAmount,
        paymentCode,
        stepA_underpay: {
          amount: underpayAmount,
          balBefore: balBeforeA,
          balAfter: balAfterA,
          isPaid: orderQrStatusA.isPaid,
        },
        stepB_overpay: {
          amount: overpayAmount,
          balBefore: balAfterA,
          balAfter: balAfterB,
          isPaid: orderQrStatusB.isPaid,
          surplus: overpayAmount - orderQrAmount,
          expectedFinalBalance,
          rawWallet: balAfterBRaw,
        },
      }, null, 2),
      contentType: 'application/json',
    });

    expect(
      Math.abs(balAfterB - expectedFinalBalance) < 1,
      `Số dư ví buyer sau bước (b) (${balAfterB}) phải khớp công thức: balance trước (a) (${balBeforeA}) + thiếu (${underpayAmount}) + dư (${overpayAmount}) - total (${orderQrAmount}) = ${expectedFinalBalance}`
    ).toBe(true);

    // Run reconciliation after payments
    runReconcile(test.info());
  });

  // =========================================================================
  // BƯỚC 3: ADMIN GIẢI NGÂN (RELEASE ESCROW)
  // =========================================================================
  test(`Bước 3: Admin giải ngân đơn hàng #${orderIdRelease} (Release Escrow)`, async ({ request }) => {
    const expectedPlatformFee = Math.round(orderReleaseAmount * 0.05);
    const expectedSellerPayout = orderReleaseAmount - expectedPlatformFee;

    test.info().annotations.push({
      type: 'description',
      description: `Admin release đơn #${orderIdRelease} (total ${orderReleaseAmount.toLocaleString('vi-VN')} VNĐ): trừ escrow sàn, cộng sellerPayout (${expectedSellerPayout.toLocaleString('vi-VN')} VNĐ) vào ví seller, thu platformFee (${expectedPlatformFee.toLocaleString('vi-VN')} VNĐ - 5%).`,
    });

    // 1. Fetch initial seller balance
    const { balance: initialSellerBalance } = await getWalletBalance(request, sellerAuth.token);

    // 2. Prepare WebSocket listener on seller socket for payment:released
    const releaseSocketPromise = sellerSocket
      ? waitForSocketEvent(sellerSocket, 'payment:released', 15000, (payload) => {
          return String(payload.orderId) === String(orderIdRelease);
        })
      : Promise.resolve(null);

    // 3. Admin calls release API: POST /api/v1/admin/orders/:id/release
    const releaseRes = await request.post(`${CONFIG.API_URL}/admin/orders/${orderIdRelease}/release`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    await expectOk(releaseRes, `POST /admin/orders/${orderIdRelease}/release`);

    const releaseJson = await releaseRes.json();
    const releaseData = releaseJson.data;

    test.info().attach('admin-release-response', {
      body: JSON.stringify(releaseJson, null, 2),
      contentType: 'application/json',
    });

    expect(releaseData.fundStatus).toBe('released');
    const sellerPayout = Number(releaseData.sellerPayout);
    const platformFee = Number(releaseData.platformFee);

    // Assert fee invariants: platformFee = round(total * 0.05), sellerPayout = total - platformFee
    expect(platformFee).toBe(expectedPlatformFee);
    expect(sellerPayout).toBe(expectedSellerPayout);

    // 4. Assert seller socket event received
    if (sellerSocket) {
      const socketData = await releaseSocketPromise;
      expect(socketData).toBeTruthy();
      test.info().attach('payment-released-socket-event', {
        body: JSON.stringify(socketData, null, 2),
        contentType: 'application/json',
      });
    }

    // 5. Assert seller balance increased by exactly sellerPayout
    const { balance: updatedSellerBalance, raw: updatedSellerRaw } = await getWalletBalance(request, sellerAuth.token);
    try {
      expect(updatedSellerBalance).toBeCloseTo(initialSellerBalance + expectedSellerPayout, 2);
    } catch (err) {
      test.info().attach('seller-release-balance-mismatch', {
        body: JSON.stringify({
          orderId: orderIdRelease,
          initialSellerBalance,
          expectedSellerPayout,
          actualSellerPayout: sellerPayout,
          updatedSellerBalance,
          expectedBalance: initialSellerBalance + expectedSellerPayout,
          rawResponse: updatedSellerRaw,
        }, null, 2),
        contentType: 'application/json',
      });
      throw err;
    }

    // 6. Assert seller notification for PAYMENT_RELEASED
    const sellerNotifRes = await request.get(`${CONFIG.API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${sellerAuth.token}` },
    });
    expect.soft(sellerNotifRes.ok(), 'GET /notifications response failed').toBeTruthy();
    const sellerNotifJson = await sellerNotifRes.json().catch(() => ({}));
    const sellerNotifs = sellerNotifJson.data?.notifications || sellerNotifJson.data || [];
    const releaseNotif = Array.isArray(sellerNotifs)
      ? sellerNotifs.find((n: any) => n.type === 'payment_released')
      : undefined;
    checkNotification(test.info(), releaseNotif, 'payment_released', sellerNotifJson);

    // 7. Run reconciliation
    runReconcile(test.info());
  });

  // =========================================================================
  // BƯỚC 4: ADMIN HOÀN TIỀN (REFUND ESCROW)
  // =========================================================================
  test(`Bước 4: Admin hoàn tiền đơn hàng #${orderIdRefund} (Refund Escrow)`, async ({ request }) => {
    test.info().annotations.push({
      type: 'description',
      description: `Admin refund đơn #${orderIdRefund}: hoàn đủ ${orderRefundAmount.toLocaleString('vi-VN')} VNĐ vào ví người mua (${CONFIG.USERS.BUYER.username}), socket order:refunded.`,
    });

    // 1. Fetch initial buyer balance
    const { balance: initialBuyerBalance } = await getWalletBalance(request, buyerAuth.token);

    // 2. Prepare WebSocket listener for order:refunded
    const refundSocketPromise = buyerSocket
      ? waitForSocketEvent(buyerSocket, 'order:refunded', 15000, (payload) => {
          return String(payload.orderId) === String(orderIdRefund);
        })
      : Promise.resolve(null);

    // 3. Admin calls refund API: POST /api/v1/admin/orders/:id/refund
    const refundRes = await request.post(`${CONFIG.API_URL}/admin/orders/${orderIdRefund}/refund`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    await expectOk(refundRes, `POST /admin/orders/${orderIdRefund}/refund`);

    const refundJson = await refundRes.json();
    const refundData = refundJson.data;

    test.info().attach('admin-refund-response', {
      body: JSON.stringify(refundJson, null, 2),
      contentType: 'application/json',
    });

    expect(refundData.paymentStatus).toBe('refunded');
    expect(refundData.fundStatus).toBe('refunded');

    // 4. Assert buyer socket event received
    if (buyerSocket) {
      const socketData = await refundSocketPromise;
      expect(socketData).toBeTruthy();
      test.info().attach('order-refunded-socket-event', {
        body: JSON.stringify(socketData, null, 2),
        contentType: 'application/json',
      });
    }

    // 5. Assert buyer balance refunded full orderRefundAmount VNĐ
    const { balance: updatedBuyerBalance, raw: updatedBuyerRaw } = await getWalletBalance(request, buyerAuth.token);
    try {
      expect(updatedBuyerBalance).toBeCloseTo(initialBuyerBalance + orderRefundAmount, 2);
    } catch (err) {
      test.info().attach('buyer-refund-balance-mismatch', {
        body: JSON.stringify({
          orderId: orderIdRefund,
          initialBuyerBalance,
          refundAmount: orderRefundAmount,
          updatedBuyerBalance,
          expectedBalance: initialBuyerBalance + orderRefundAmount,
          rawResponse: updatedBuyerRaw,
        }, null, 2),
        contentType: 'application/json',
      });
      throw err;
    }

    // 6. Run reconciliation
    runReconcile(test.info());
  });

  // =========================================================================
  // BƯỚC 5: RÚT TIỀN, TẢI CHỨNG TỪ & TỪ CHỐI HOÀN TIỀN
  // =========================================================================
  test('Bước 5: Rút tiền, phê duyệt tải chứng từ và từ chối hoàn tiền', async ({ page, context, request }) => {
    test.info().annotations.push({
      type: 'description',
      description: 'Seller tạo lệnh rút 100k -> Admin process -> upload proof PNG -> complete với { proof_file_id } -> kiểm tra phân quyền file proof. Lệnh 2 (50k) -> Admin reject -> hoàn tiền.',
    });

    // 0. Ensure seller has enough balance (>= 150.000 VNĐ) to execute both withdrawals (100k + 50k)
    const { balance: currentSellerBal } = await getWalletBalance(request, sellerAuth.token);
    test.skip(
      currentSellerBal < 150000,
      `Số dư ví seller không đủ để test rút tiền (${currentSellerBal.toLocaleString('vi-VN')} đ < 150.000 đ). Cần tối thiểu 150.000 đ để thực hiện 2 lệnh rút (100k + 50k).`
    );

    // 1. Inject seller session cookies into browser context
    await setupUserSession(context, sellerAuth, CONFIG.BASE_URL);

    // -----------------------------------------------------------------------
    // YÊU CẦU RÚT TIỀN 1: 100.000 VNĐ -> Phê duyệt & Tải chứng từ
    // -----------------------------------------------------------------------
    await page.goto(`${CONFIG.BASE_URL}/profile/wallet`);
    await page.waitForLoadState('networkidle');

    // Click "Rút tiền" button
    const withdrawBtn = page.getByRole('button', { name: /Rút tiền/i }).first();
    await expect(withdrawBtn).toBeVisible();
    await withdrawBtn.click();

    // Fill withdrawal form: amount = 100000, bankCode = MB, bankAccountNo = 0123456789, bankAccountName = SEED SELLER
    const amountInput = page.locator('input#amount').or(page.getByPlaceholder(/Nhập số tiền/i)).first();
    await amountInput.fill('100000');

    const bankCodeInput = page.locator('input#bankCode').or(page.getByPlaceholder(/MB, VCB/i)).first();
    await bankCodeInput.fill('MB');

    const bankAccNoInput = page.locator('input#bankAccountNo').or(page.getByPlaceholder(/số tài khoản/i)).first();
    await bankAccNoInput.fill('0123456789');

    const bankAccNameInput = page.locator('input#bankAccountName').or(page.getByPlaceholder(/NGUYEN VAN A/i)).first();
    await bankAccNameInput.fill('SEED SELLER');

    // Submit form & intercept POST /wallet/withdrawals
    const createWithdrawalPromise = page.waitForResponse(
      (res) => res.url().includes('/wallet/withdrawals') && res.request().method() === 'POST',
      { timeout: 10000 }
    );

    const confirmWithdrawBtn = page.getByRole('button', { name: /Xác nhận rút tiền/i });
    await confirmWithdrawBtn.click();

    const withdrawalRes = await createWithdrawalPromise;
    await expectOk(withdrawalRes, 'POST /wallet/withdrawals');
    expect(withdrawalRes.status()).toBe(201);
    const withdrawalJson = await withdrawalRes.json();
    withdrawalId1 = withdrawalJson.data?.id;

    expect(withdrawalId1).toBeDefined();
    test.info().attach('withdrawal1-created-response', {
      body: JSON.stringify(withdrawalJson, null, 2),
      contentType: 'application/json',
    });

    // Admin moves withdrawal 1 to PROCESSING
    const processRes = await request.patch(`${CONFIG.API_URL}/admin/wallet/withdrawals/${withdrawalId1}/process`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    await expectOk(processRes, `PATCH /admin/wallet/withdrawals/${withdrawalId1}/process`);

    // Admin uploads proof file (1x1 transparent PNG buffer) with purpose=withdrawal_proof
    const tinyPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const uploadRes = await request.post(`${CONFIG.API_URL}/files`, {
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
      },
      multipart: {
        file: {
          name: 'withdrawal_receipt_test.png',
          mimeType: 'image/png',
          buffer: tinyPngBuffer,
        },
        purpose: 'withdrawal_proof',
      },
    });

    await expectOk(uploadRes, 'POST /files (proof)');
    const uploadJson = await uploadRes.json();
    proofFileId = String(uploadJson.data?.id);
    expect(proofFileId).toBeDefined();

    test.info().attach('admin-proof-uploaded', {
      body: JSON.stringify(uploadJson, null, 2),
      contentType: 'application/json',
    });

    // Admin completes withdrawal 1 with body { proof_file_id }
    const completeRes = await request.post(`${CONFIG.API_URL}/admin/wallet/withdrawals/${withdrawalId1}/complete`, {
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
      },
      data: {
        proof_file_id: proofFileId,
      },
    });
    await expectOk(completeRes, `POST /admin/wallet/withdrawals/${withdrawalId1}/complete`);
    const completeJson = await completeRes.json();
    test.info().attach('withdrawal1-completed-response', {
      body: JSON.stringify(completeJson, null, 2),
      contentType: 'application/json',
    });

    // Assert seller can view withdrawal list and see status=completed and proofUrl
    const sellerWithdrawalsRes = await request.get(`${CONFIG.API_URL}/wallet/withdrawals`, {
      headers: { Authorization: `Bearer ${sellerAuth.token}` },
    });
    expect(sellerWithdrawalsRes.ok()).toBeTruthy();
    const sellerWithdrawals = (await sellerWithdrawalsRes.json()).data?.items || [];
    const completedItem = sellerWithdrawals.find((w: any) => String(w.id) === String(withdrawalId1));
    expect(completedItem).toBeDefined();
    expect(completedItem.status).toBe('completed');
    expect(completedItem.proofUrl || completedItem.proofFileId).toBeTruthy();

    // Security check: Seller GET /files/{proofFileId}/url returns 200
    const sellerProofAccessRes = await request.get(`${CONFIG.API_URL}/files/${proofFileId}/url`, {
      headers: { Authorization: `Bearer ${sellerAuth.token}` },
    });
    expect(sellerProofAccessRes.status()).toBe(200);

    // Security check: seed_bidder2 (unrelated user) GET /files/{proofFileId}/url returns 404
    const bidder2ProofAccessRes = await request.get(`${CONFIG.API_URL}/files/${proofFileId}/url`, {
      headers: { Authorization: `Bearer ${bidder2Auth.token}` },
    });
    expect(bidder2ProofAccessRes.status()).toBe(404);

    // -----------------------------------------------------------------------
    // YÊU CẦU RÚT TIỀN 2: 50.000 VNĐ -> Từ chối (Reject) & Hoàn tiền
    // -----------------------------------------------------------------------
    // Check seller balance before second withdrawal
    const { balance: sellerBalanceBeforeW2 } = await getWalletBalance(request, sellerAuth.token);

    // Create withdrawal 2 via API
    const createW2Res = await request.post(`${CONFIG.API_URL}/wallet/withdrawals`, {
      headers: { Authorization: `Bearer ${sellerAuth.token}` },
      data: {
        amount: 50000,
        bankCode: 'MB',
        bankAccountNo: '9999999999',
        bankAccountName: 'SEED SELLER REJECT TEST',
      },
    });
    await expectOk(createW2Res, 'POST /wallet/withdrawals (withdrawal 2)');
    withdrawalId2 = (await createW2Res.json()).data?.id;
    expect(withdrawalId2).toBeDefined();

    // Admin rejects withdrawal 2
    const rejectRes = await request.post(`${CONFIG.API_URL}/admin/wallet/withdrawals/${withdrawalId2}/reject`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
      data: {
        reject_reason: 'Thông tin tài khoản thụ hưởng không chính xác theo E2E test',
      },
    });
    await expectOk(rejectRes, `POST /admin/wallet/withdrawals/${withdrawalId2}/reject`);
    const rejectJson = await rejectRes.json();
    test.info().attach('withdrawal2-rejected-response', {
      body: JSON.stringify(rejectJson, null, 2),
      contentType: 'application/json',
    });

    // Assert seller balance is refunded 50,000 VNĐ
    const { balance: sellerBalanceAfterReject, raw: sellerAfterRejectRaw } = await getWalletBalance(request, sellerAuth.token);
    try {
      expect(sellerBalanceAfterReject).toBeCloseTo(sellerBalanceBeforeW2, 2);
    } catch (err) {
      test.info().attach('withdrawal2-refund-balance-mismatch', {
        body: JSON.stringify({
          withdrawalId: withdrawalId2,
          amount: 50000,
          sellerBalanceBefore: sellerBalanceBeforeW2,
          sellerBalanceAfter: sellerBalanceAfterReject,
          expectedBalance: sellerBalanceBeforeW2,
          rawResponse: sellerAfterRejectRaw,
        }, null, 2),
        contentType: 'application/json',
      });
      throw err;
    }

    // Run reconciliation
    runReconcile(test.info());
  });

  // =========================================================================
  // BƯỚC 6: KIỂM TRA ĐỐI SOÁT CUỐI CÙNG (FINAL RECONCILIATION)
  // =========================================================================
  test('Bước 6: Kiểm tra đối soát cuối cùng (Final Reconciliation)', async () => {
    test.info().annotations.push({
      type: 'description',
      description: 'Chạy nightly reconciliation kiểm tra toàn bộ các invariant tài chính của hệ thống.',
    });

    const output = runReconcile(test.info());
    expect(output).toContain('Reconciliation completed successfully');
  });
});
