import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { Order } from './entity/order.entity.js';
import { OrderService } from './order.service.js';
import { OrderController } from './orders.controller.js';
import { isAuth } from '../../middlewares/authen.middleware.js';
import { verifySepayWebhook } from '../../middlewares/sepay-auth.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { ProcessPaymentDto } from './dtos/process-payment.dto.js';

const router = express.Router();

const orderService = new OrderService(
  AppDataSource.getRepository(Order),
  AppDataSource,
);
const orderController = new OrderController(orderService);

/**
 * @swagger
 * /api/v1/orders/webhook/sepay:
 *   post:
 *     summary: Sepay bank transfer webhook
 *     tags: [Order]
 *     description: |
 *       **Internal endpoint — called by Sepay, not by the FE.**
 *
 *       Receives bank transfer notifications from Sepay when money arrives in the admin's bank account.
 *       Protected by `verifySepayWebhook` middleware (API key/signature verification).
 *
 *       **This is the only way real money enters the system.** Past this middleware is effectively
 *       a money printer — the webhook creates wallet balances from nothing (backed by the real bank deposit).
 *
 *       **Routing logic based on transfer note:**
 *       - Note matches `BIDY{orderId}` (e.g. `BIDY001`) → **Order payment flow** (QR direct):
 *         Credits buyer wallet via `topup_success`, then immediately debits via `payment` + `payment_escrow_in`.
 *         Handles underpaid (credits wallet, order stays unpaid) and overpaid (credits full amount,
 *         debits only order total, surplus stays in wallet).
 *       - Note matches `BIDYTOPUP{txId}` → **Top-up flow**: Credits wallet via `topup_success`.
 *       - Note unrecognizable → Logged for admin manual reconciliation, nothing credited.
 *
 *       **Always returns 200**, even on duplicates — returning an error would cause Sepay to retry.
 *     responses:
 *       200:
 *         description: |
 *           Webhook processed (or duplicate detected). Always 200 to stop Sepay retries.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Webhook processed
 *       401:
 *         description: Invalid Sepay API key or signature
 */
router.post('/webhook/sepay', verifySepayWebhook as any, (req: any, res: any) => orderController.handleSepayWebhook(req, res));

// Authenticated user routes below
router.use(isAuth as any);

/**
 * @swagger
 * components:
 *   schemas:
 *     WonAuctionBidInfo:
 *       type: object
 *       nullable: true
 *       description: Auction summary for the won order
 *       properties:
 *         id:
 *           type: string
 *           example: "10"
 *         name:
 *           type: string
 *           nullable: true
 *           example: "Product Name"
 *         price:
 *           type: number
 *           example: 500000
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Product description"
 *         image:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com/image.jpg"
 *     WonAuctionOrder:
 *       type: object
 *       required:
 *         - id
 *         - buyerId
 *         - sellerId
 *         - auctionId
 *         - shippingAddressId
 *         - price
 *         - shippingFee
 *         - totalAmount
 *         - paymentStatus
 *         - shippingStatus
 *         - paymentDeadline
 *         - fundStatus
 *         - createdAt
 *         - updatedAt
 *         - wonDate
 *         - daysRemaining
 *         - isOverdue
 *         - isUrgent
 *         - bidId
 *       properties:
 *         id:
 *           type: string
 *           example: "42"
 *         buyerId:
 *           type: string
 *           example: "1"
 *         sellerId:
 *           type: string
 *           example: "2"
 *         auctionId:
 *           type: string
 *           example: "10"
 *         shippingAddressId:
 *           type: string
 *           nullable: true
 *           example: "5"
 *         price:
 *           description: Final winning price of the auction
 *           oneOf:
 *             - type: string
 *               format: decimal
 *               example: "500000.00"
 *             - type: number
 *               example: 500000
 *         shippingFee:
 *           type: string
 *           format: decimal
 *           example: "30000.00"
 *         totalAmount:
 *           type: string
 *           format: decimal
 *           example: "530000.00"
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, cancelled, refunded, expired, processing, overdue]
 *           example: "pending"
 *         shippingStatus:
 *           type: string
 *           example: "pending"
 *         trackingNumber:
 *           type: string
 *           nullable: true
 *           example: null
 *         paymentDeadline:
 *           type: string
 *           format: date-time
 *           example: "2026-09-20T07:00:00.000Z"
 *         fundStatus:
 *           type: string
 *           enum: [none, held, released, refunded]
 *           example: "none"
 *         platformFee:
 *           type: string
 *           nullable: true
 *           example: null
 *         sellerPayout:
 *           type: string
 *           nullable: true
 *           example: null
 *         feeRate:
 *           type: string
 *           nullable: true
 *           example: null
 *         paymentChannel:
 *           type: string
 *           nullable: true
 *           example: null
 *         deliveredAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         releasedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         releasedBy:
 *           type: string
 *           nullable: true
 *           example: null
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-09-18T07:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-09-18T07:00:00.000Z"
 *         wonDate:
 *           type: string
 *           format: date-time
 *           example: "2026-09-18T07:00:00.000Z"
 *         daysRemaining:
 *           type: integer
 *           example: 2
 *         isOverdue:
 *           type: boolean
 *           example: false
 *         isUrgent:
 *           type: boolean
 *           example: false
 *         bidId:
 *           $ref: '#/components/schemas/WonAuctionBidInfo'
 *     WonAuctionsSummary:
 *       type: object
 *       required:
 *         - total
 *         - pending
 *         - paid
 *         - overdue
 *       properties:
 *         total:
 *           type: integer
 *           example: 5
 *         pending:
 *           type: integer
 *           example: 2
 *         paid:
 *           type: integer
 *           example: 2
 *         overdue:
 *           type: integer
 *           example: 1
 *
 * /api/v1/orders/won-auctions:
 *   get:
 *     summary: List auctions won by the authenticated user
 *     description: |
 *       Every order where the caller is the buyer (one order per won auction), newest first.
 *       Use it for the "Đấu giá đã thắng / Cần thanh toán" screen.
 *
 *       Each order carries computed helpers so the FE does not recalculate deadlines:
 *       - `paymentDeadline`, `daysRemaining` — time left to pay.
 *       - `isOverdue` — unpaid and past the deadline (the account may be locked by the deadline job).
 *       - `isUrgent` — less than 24h left.
 *       - `paymentStatus` — `pending` | `processing` | `paid` | `cancelled` | `refunded` | `expired` | `overdue`.
 *       - `fundStatus` — `none` | `held` | `released` | `refunded` (trạng thái escrow).
 *       - `bidId` — the auction summary (`id`, `name`, `price`, `description`, `image`), `null` if the auction is gone.
 *
 *       `data.summary` gives counters for tabs/badges: `total`, `pending` (not overdue), `paid`, `overdue`.
 *       To pay an order use `POST /orders/{id}/pay` (wallet balance) or `GET /orders/{id}/payment-qr` (bank QR).
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Won auctions returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - status
 *                 - message
 *                 - data
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Danh sách đơn hàng thắng đấu giá
 *                 data:
 *                   type: object
 *                   required:
 *                     - orders
 *                     - summary
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WonAuctionOrder'
 *                     summary:
 *                       $ref: '#/components/schemas/WonAuctionsSummary'
 */
router.get('/won-auctions', (req: any, res: any) => orderController.getWonAuctions(req, res));

/**
 * @swagger
 * /api/v1/orders/payment-status:
 *   get:
 *     summary: Get payment status for the authenticated user's orders
 *     description: |
 *       Aggregated reminder state over the caller's **unpaid** (`pending`) orders — meant for a global
 *       banner/badge, not a per-order view (use `GET /orders/{id}/status` for that).
 *
 *       Response fields:
 *       - `pendingCount`, `urgentCount` (< 24h left), `overdueCount`, `hasOverduePayments`.
 *       - `nearestDeadline` — earliest unpaid deadline, `null` if nothing is pending.
 *       - `warningLevel` — `none` | `low` (something pending) | `medium` (something < 24h) | `high` (something overdue).
 *         Map directly to banner colour.
 *       - `accountStatus` — currently always `active`; do not rely on it for lock state.
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment status returned
 */
router.get('/payment-status', (req: any, res: any) => orderController.getPaymentStatus(req, res));

/**
 * @swagger
 * /api/v1/orders/payment:
 *   post:
 *     summary: Process payment for one or more orders
 *     deprecated: true
 *     description: |
 *       **DEPRECATED — do not use for new UI.** Legacy checkout from before the wallet ledger.
 *       It only moves the orders to `processing` and records `transactions` rows; **no money moves**
 *       (no wallet debit, no escrow). Completing it via `POST /orders/payment/{paymentId}/confirm`
 *       marks orders `paid` without any payment being received.
 *
 *       Use instead:
 *       - `POST /orders/{id}/pay` — pay from wallet balance.
 *       - `GET /orders/{id}/payment-qr` — pay by bank transfer (QR); the SePay webhook confirms it.
 *
 *       Body: `orderIds` (non-empty array of the caller's `pending` orders), `paymentMethod` (string).
 *       Returns `transactionId` (the payment group id to pass to `/confirm`), `totalAmount`, `orders`.
 *       Fails (400) if any order is not the caller's, or is not `pending` — the whole batch is rejected.
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderIds
 *               - paymentMethod
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               paymentMethod:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment processed
 *       400:
 *         description: Invalid input
 */
router.post('/payment', dtoValidationMiddleware(ProcessPaymentDto) as any, (req: any, res: any) => orderController.processPayment(req, res));

/**
 * @swagger
 * /api/v1/orders/payment/{paymentId}/confirm:
 *   post:
 *     summary: Confirm a pending payment
 *     deprecated: true
 *     description: |
 *       **DEPRECATED — do not use for new UI.** Legacy checkout from before the wallet ledger.
 *       It only moves the orders to `processing` and records `transactions` rows; **no money moves**
 *       (no wallet debit, no escrow). Completing it via `POST /orders/payment/{paymentId}/confirm`
 *       marks orders `paid` without any payment being received.
 *
 *       Use instead:
 *       - `POST /orders/{id}/pay` — pay from wallet balance.
 *       - `GET /orders/{id}/payment-qr` — pay by bank transfer (QR); the SePay webhook confirms it.
 *
 *       `paymentId` is the `transactionId` returned by `POST /orders/payment`. Marks every order in that
 *       group `paid`. 404 when no `processing` transaction with that id belongs to the caller.
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment confirmed
 *       404:
 *         description: Payment not found
 */
router.post('/payment/:paymentId/confirm', (req: any, res: any) => orderController.confirmPayment(req, res));

/**
 * @swagger
 * /api/v1/orders/{id}/payment-qr:
 *   get:
 *     summary: Generate VietQR code for order payment
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Generates a VietQR code for the buyer to pay for an order via direct bank transfer (QR scan).
 *
 *       **User flow:**
 *       1. FE calls this endpoint to get the QR code and bank details.
 *       2. User scans the QR with their banking app and transfers the exact `amount`.
 *       3. The transfer note is auto-filled with `paymentCode` (format: `BIDY{orderId padded to 3}`).
 *       4. When Sepay detects the transfer, the webhook fires and the order is marked as paid.
 *       5. FE should poll `GET /api/v1/orders/{id}/status` or listen for the `order:paid` WebSocket event.
 *
 *       **Payment flow (pass-through):**
 *       The incoming money first credits the buyer's wallet (`topup_success`), then immediately
 *       debits it (`payment`) and enters escrow (`payment_escrow_in`) — all in one atomic transaction.
 *       This means the wallet transaction history shows a clean money-in / money-out pair.
 *
 *       **Underpaid:** If the user transfers less than `total_amount`, the money is credited to
 *       their wallet but the order is NOT marked as paid. User can then top up more and use
 *       `POST /api/v1/orders/{id}/pay` to complete payment from wallet balance.
 *
 *       **Overpaid:** Full amount is credited to wallet, only `total_amount` is debited.
 *       Surplus stays in the wallet as available balance.
 *
 *       A pending `transactions` row is created for tracking.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *         example: "42"
 *     responses:
 *       200:
 *         description: QR image URL and payment instructions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Payment QR generated
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "42"
 *                     amount:
 *                       type: number
 *                       description: Total amount to pay in VND (integer, no decimals)
 *                       example: 500000
 *                     paymentCode:
 *                       type: string
 *                       description: |
 *                         Transfer note that MUST be included in the bank transfer.
 *                         Format: `BIDY{orderId padded to at least 3 digits}`.
 *                         This is how the webhook identifies which order the payment is for.
 *                       example: "BIDY042"
 *                     qrCodeUrl:
 *                       type: string
 *                       format: uri
 *                       description: VietQR image URL — render as `<img>` for the user to scan
 *                       example: "https://qr.sepay.vn/img?acc=0123456789&bank=MB&amount=500000&des=BIDY042"
 *                     bankInfo:
 *                       type: object
 *                       description: Bank account details for manual transfer (if QR scan is not possible)
 *                       properties:
 *                         bankName:
 *                           type: string
 *                           example: "MB"
 *                         accountNumber:
 *                           type: string
 *                           example: "0123456789"
 *                         accountName:
 *                           type: string
 *                           example: "NGUYEN VAN ADMIN"
 *                     paymentDeadline:
 *                       type: string
 *                       format: date-time
 *                       description: Deadline for payment. After this, the order may be auto-expired.
 *                       example: "2026-09-20T07:00:00.000Z"
 *                     paymentStatus:
 *                       type: string
 *                       description: Current payment status of the order
 *                       example: "pending"
 *       400:
 *         description: Order already paid (`ORDER_ALREADY_PAID`)
 *       403:
 *         description: Forbidden — caller is not the buyer of this order
 *       404:
 *         description: Order not found
 */
router.get('/:id/payment-qr', (req: any, res: any) => orderController.getOrderPaymentQr(req, res));

/**
 * @swagger
 * /api/v1/orders/{id}/status:
 *   get:
 *     summary: Get payment and fulfillment status of a specific order
 *     description: |
 *       Current state of one order, readable by its **buyer or seller** (403 otherwise).
 *       Use it to poll after showing a payment QR (the socket event `order:paid` is the primary signal;
 *       poll this every few seconds as a fallback) and to render the order detail.
 *
 *       Response fields:
 *       - `paymentStatus` — `pending` | `processing` | `paid` | `cancelled` | `refunded` | `expired` | `overdue`; `isPaid` is the boolean shortcut.
 *       - `shippingStatus` — fulfillment state.
 *       - `totalAmount` — number (final price + shipping); `paymentDeadline`.
 *       - `fundStatus` — escrow state: `none` (unpaid) | `held` (paid, money in escrow) |
 *         `released` (seller received payout) | `refunded` (buyer refunded).
 *       - `deliveredAt` — when shipping became `delivered`, `null` before that.
 *         FE should warn when `deliveredAt` is old but `fundStatus` is still `held` (admin has not released).
 *       - `fund_status` / `delivered_at` — snake_case duplicates of the two fields above, kept for compatibility.
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order status returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - status
 *                 - message
 *                 - data
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Trạng thái đơn hàng
 *                 data:
 *                   type: object
 *                   required:
 *                     - orderId
 *                     - paymentStatus
 *                     - shippingStatus
 *                     - totalAmount
 *                     - paymentDeadline
 *                     - isPaid
 *                     - fundStatus
 *                     - deliveredAt
 *                     - fund_status
 *                     - delivered_at
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "42"
 *                     paymentStatus:
 *                       type: string
 *                       example: pending
 *                     shippingStatus:
 *                       type: string
 *                       nullable: true
 *                       example: pending
 *                     totalAmount:
 *                       type: number
 *                       example: 500000
 *                     paymentDeadline:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-09-20T07:00:00.000Z"
 *                     isPaid:
 *                       type: boolean
 *                       example: false
 *                     fundStatus:
 *                       type: string
 *                       enum: [none, held, released, refunded]
 *                       example: none
 *                     deliveredAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: null
 *                     fund_status:
 *                       type: string
 *                       enum: [none, held, released, refunded]
 *                       example: none
 *                     delivered_at:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: null
 *       403:
 *         description: Forbidden - not buyer or seller
 *       404:
 *         description: Order not found
 */
router.get('/:id/status', (req: any, res: any) => orderController.getOrderStatus(req, res));

/**
 * @swagger
 * /api/v1/orders/{id}/pay:
 *   post:
 *     summary: Pay for an order using wallet balance
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Pays for an order by debiting the buyer's wallet balance.
 *       This is the **wallet payment** path — the alternative to QR direct payment.
 *
 *       **Double-entry ledger:**
 *       - Buyer wallet: `payment` (-total_amount)
 *       - Platform wallet: `payment_escrow_in` (+total_amount)
 *
 *       **Preconditions (all checked, failure returns 400/403/404):**
 *       - Caller must be the buyer (`order.buyer_id = current_user`)
 *       - `order.payment_status` must be `pending`
 *       - Current time must be before `payment_deadline`
 *       - Buyer wallet must have sufficient balance (≥ `total_amount`)
 *
 *       **After success:**
 *       - `payment_status` → `paid`
 *       - `fund_status` → `held` (money in escrow until admin releases)
 *       - `payment_channel` → `wallet`
 *       - WebSocket event `order:paid` emitted to buyer and order room
 *
 *       **Idempotent:** If the order was already paid (duplicate click), the ledger's
 *       idempotency key (`order_payment:{orderId}`) prevents double-debiting.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *         example: "42"
 *     responses:
 *       200:
 *         description: Order paid successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Order paid successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "42"
 *                     paymentStatus:
 *                       type: string
 *                       description: New payment status
 *                       example: "paid"
 *                     fundStatus:
 *                       type: string
 *                       description: Escrow status — `held` means money is in platform escrow
 *                       example: "held"
 *                     paymentChannel:
 *                       type: string
 *                       description: How the payment was made
 *                       enum: [wallet, qr_direct]
 *                       example: "wallet"
 *                     totalAmount:
 *                       type: string
 *                       description: Amount debited from wallet (decimal string)
 *                       example: "500000.00"
 *       400:
 *         description: |
 *           Payment not possible. Possible error messages:
 *           - `ORDER_NOT_PAYABLE` — order is not in `pending` payment status
 *           - `ORDER_PAYMENT_DEADLINE_EXPIRED` — payment window has closed
 *           - `INSUFFICIENT_BALANCE` — wallet balance is less than `total_amount`
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — caller is not the buyer of this order (`FORBIDDEN`)
 *       404:
 *         description: |
 *           Not found. Possible errors:
 *           - `ORDER_NOT_FOUND`
 *           - Buyer wallet not found
 */
router.post('/:id/pay', (req: any, res: any) => orderController.payWithWallet(req, res));

export default router;
