import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { Order } from './entity/order.entity.js';
import { OrderService } from './order.service.js';
import { AdminOrderController } from './admin-order.controller.js';
import { isAdmin } from '../../middlewares/authen.middleware.js';

const router = express.Router();

const orderRepository = AppDataSource.getRepository(Order);
const orderService = new OrderService(orderRepository, AppDataSource);
const adminOrderController = new AdminOrderController(orderService);

/**
 * @swagger
 * tags:
 *   name: Admin Orders
 *   description: |
 *     Admin order and escrow management API.
 *     All endpoints require `isAdmin` middleware (Bearer token from an account with `role = 'admin'`).
 */

/**
 * @swagger
 * /api/v1/admin/orders/{id}/release:
 *   post:
 *     summary: Release escrow payment to seller (Admin only)
 *     tags: [Admin Orders]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Releases funds from escrow to the seller's wallet, deducting the 5% platform fee.
 *       **This is the only way money leaves escrow.** There is no auto-release cron.
 *
 *       **Fee calculation:**
 *       - `platform_fee = ROUND(final_price × 0.05, 2)` — calculated on `final_price` only, NOT including `shipping_fee`
 *       - `seller_payout = final_price + shipping_fee − platform_fee` — seller receives shipping fee in full
 *
 *       **Double-entry ledger (3 legs):**
 *       1. Platform wallet: `payment_escrow_out` (−total_amount) — money leaves escrow
 *       2. Seller wallet: `payment_release` (+seller_payout) — seller receives net amount
 *       3. Platform wallet: `platform_fee` (+platform_fee) — platform keeps commission
 *
 *       **Preconditions:**
 *       - `fund_status` must be `held`. Releasing an already-released order returns 400.
 *       - Seller must have a wallet.
 *
 *       **After success:**
 *       - `fund_status` → `released`
 *       - `platform_fee`, `seller_payout`, `fee_rate`, `released_at`, `released_by` are snapshotted on the order
 *       - Seller receives a `PAYMENT_RELEASED` notification
 *       - WebSocket event `payment:released` emitted to seller
 *
 *       **Idempotent:** If release was already done, the `fund_status = 'held'` check prevents double-release.
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
 *         description: Escrow released to seller
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
 *                   example: Escrow released successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "42"
 *                     fundStatus:
 *                       type: string
 *                       example: "released"
 *                     platformFee:
 *                       type: string
 *                       description: 5% commission taken from `final_price`
 *                       example: "25000.00"
 *                     sellerPayout:
 *                       type: string
 *                       description: Net amount credited to seller (final_price + shipping_fee − platformFee)
 *                       example: "505000.00"
 *                     feeRate:
 *                       type: string
 *                       description: Fee rate applied (snapshotted for audit)
 *                       example: "0.0500"
 *                     releasedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Timestamp of the release
 *                       example: "2026-09-18T07:00:00.000Z"
 *                     releasedBy:
 *                       type: string
 *                       description: Admin user ID who performed the release
 *                       example: "3"
 *       400:
 *         description: |
 *           Invalid state. Possible messages:
 *           - `Order fund status must be 'held' to release` — order already released, refunded, or not yet paid
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: |
 *           Not found. Possible errors:
 *           - `ORDER_NOT_FOUND`
 *           - `SELLER_WALLET_NOT_FOUND` — seller doesn't have a wallet
 */
router.post(
  '/:id/release',
  isAdmin as any,
  adminOrderController.release,
);

/**
 * @swagger
 * /api/v1/admin/orders/{id}/refund:
 *   post:
 *     summary: Refund escrow payment to buyer (Admin only)
 *     tags: [Admin Orders]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Refunds the full escrow amount back to the buyer's wallet.
 *       Used when an order is cancelled or has issues **before** escrow was released to seller.
 *
 *       **Important: No refund is possible after release.**
 *       Once `fund_status = 'released'`, the money is in the seller's wallet and cannot be clawed back.
 *       This is a deliberate design decision — no post-release disputes are handled by the platform.
 *
 *       **Double-entry ledger (2 legs):**
 *       1. Platform wallet: `payment_escrow_out` (−total_amount) — money leaves escrow
 *       2. Buyer wallet: `payment_refund` (+total_amount) — full amount returned to buyer
 *
 *       **Preconditions:**
 *       - `fund_status` must be `held`. Refunding an already-released/refunded order returns 400.
 *
 *       **After success:**
 *       - `payment_status` → `refunded`
 *       - `fund_status` → `refunded`
 *       - WebSocket event `order:refunded` emitted to buyer and order room
 *
 *       **Note:** The `PaymentDeadlineService` also calls this internally when an order expires
 *       while funds are in escrow, to prevent money from being stranded.
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
 *         description: Order refunded, full amount returned to buyer wallet
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
 *                   example: Order refunded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       example: "42"
 *                     paymentStatus:
 *                       type: string
 *                       example: "refunded"
 *                     fundStatus:
 *                       type: string
 *                       example: "refunded"
 *                     totalAmount:
 *                       type: string
 *                       description: Amount refunded to buyer wallet
 *                       example: "500000.00"
 *       400:
 *         description: |
 *           Invalid state. Possible messages:
 *           - `Order fund status must be 'held' to refund` — order already released, refunded, or not yet paid
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: |
 *           Not found. Possible errors:
 *           - `ORDER_NOT_FOUND`
 *           - Buyer wallet not found
 */
router.post(
  '/:id/refund',
  isAdmin as any,
  adminOrderController.refund,
);

export default router;
