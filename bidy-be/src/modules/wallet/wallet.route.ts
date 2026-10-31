import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { Wallet } from './entity/wallet.entity.js';
import { Transaction } from '../order/entity/transaction.entity.js';
import { WalletService } from './wallet.service.js';
import { WalletController } from './wallet.controller.js';
import { isAuth } from '../../middlewares/authen.middleware.js';
import { rateLimiters } from '../../middlewares/security.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { TopupDto } from './dtos/topup.dto.js';
import { CreateWithdrawalDto } from './dtos/withdrawal.dto.js';

const router = express.Router();

const walletRepository = AppDataSource.getRepository(Wallet);
const transactionRepository = AppDataSource.getRepository(Transaction);
const walletService = new WalletService(walletRepository, transactionRepository);
const walletController = new WalletController(walletService);

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: |
 *     User wallet API — view balance, top up via bank transfer, withdraw funds, and view transaction history.
 *
 *     All monetary values are returned as **decimal strings** with exactly 2 decimal places (e.g. `"500000.00"`).
 *     Never parse them as floating point; use string-based or integer arithmetic.
 *
 *     Every response is wrapped in the standard envelope:
 *     ```json
 *     { "status": "success" | "fail" | "error", "message": "...", "data": { ... } }
 *     ```
 *     On errors, `data` is absent and `error_code` may be present instead.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Wallet:
 *       type: object
 *       description: The user's wallet. Every registered user has exactly one wallet.
 *       properties:
 *         id:
 *           type: string
 *           description: Wallet ID (bigint as string)
 *           example: "42"
 *         userId:
 *           type: string
 *           description: Owner user ID
 *           example: "7"
 *         balance:
 *           type: string
 *           description: |
 *             Current available balance in VND, decimal(14,2) as string.
 *             This is a cached value; the source of truth is `SUM(wallet_ledger.amount)`.
 *             Pending withdrawal holds have already been subtracted.
 *           example: "1250000.00"
 *         status:
 *           type: string
 *           enum: [active, locked]
 *           description: |
 *             `active` — normal operations allowed.
 *             `locked` — wallet frozen (fraud/dispute). All debit and credit operations will be rejected with 403.
 *           example: "active"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-01-15T08:30:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-09-18T07:00:00.000Z"
 *
 *     LedgerEntry:
 *       type: object
 *       description: |
 *         A single append-only ledger entry recording a balance movement.
 *         Positive amount = credit (money in), negative = debit (money out), zero = book-closing marker.
 *       properties:
 *         id:
 *           type: string
 *           description: Ledger entry ID
 *           example: "128"
 *         walletId:
 *           type: string
 *           example: "42"
 *         type:
 *           type: string
 *           description: |
 *             Ledger entry type. Determines the nature of the movement:
 *             - `topup_success` — Bank transfer confirmed via Sepay webhook (+)
 *             - `payment` — Buyer pays for an order (−)
 *             - `payment_escrow_in` — Money enters platform escrow (+)
 *             - `payment_release` — Seller receives payout after 5% fee (+)
 *             - `payment_escrow_out` — Money leaves platform escrow (−)
 *             - `platform_fee` — 5% commission retained by platform (+)
 *             - `payment_refund` — Buyer refunded before release (+)
 *             - `withdraw_hold` — Balance held when withdrawal requested (−)
 *             - `withdraw_success` — Withdrawal completed, book closed (0)
 *             - `withdraw_failed` — Withdrawal rejected, hold refunded (+)
 *             - `withdraw_cancelled` — User cancelled withdrawal, hold refunded (+)
 *             - `adjustment` — Manual admin reconciliation (±)
 *           enum:
 *             - topup_success
 *             - payment
 *             - payment_escrow_in
 *             - payment_release
 *             - payment_escrow_out
 *             - platform_fee
 *             - payment_refund
 *             - withdraw_hold
 *             - withdraw_success
 *             - withdraw_failed
 *             - withdraw_cancelled
 *             - adjustment
 *           example: "topup_success"
 *         amount:
 *           type: string
 *           description: |
 *             Signed decimal amount. Positive = credit, negative = debit, zero = marker.
 *             Always a string with 2 decimal places.
 *           example: "500000.00"
 *         balanceAfter:
 *           type: string
 *           description: Wallet balance snapshot immediately after this entry was posted
 *           example: "1500000.00"
 *         referenceType:
 *           type: string
 *           nullable: true
 *           description: |
 *             What entity this entry references:
 *             `sepay_webhook`, `order`, `withdrawal_request`, `wallet_adjustment`
 *           example: "sepay_webhook"
 *         referenceId:
 *           type: string
 *           nullable: true
 *           description: ID of the referenced entity (polymorphic FK)
 *           example: "55"
 *         idempotencyKey:
 *           type: string
 *           description: |
 *             Unique key ensuring this entry is written at most once.
 *             Format: `{type}:{reference_id}` (e.g. `sepay:TX123`, `order_payment:42`).
 *           example: "sepay:TX88804"
 *         metadata:
 *           type: object
 *           nullable: true
 *           description: Extra context — admin_id, reject_reason, fee_rate, bank_reference, etc.
 *           example: { "bank_reference": "FT24010112345" }
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-09-18T07:00:00.000Z"
 *
 *     CursorPaginatedLedger:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LedgerEntry'
 *         nextCursor:
 *           type: string
 *           nullable: true
 *           description: |
 *             Opaque base64-encoded cursor for the next page. Pass this as `?cursor=` to fetch more.
 *             `null` when there are no more results.
 *           example: "MjAyNi0wOS0xOFQwNzowMDowMC4wMDBaXzEyOA=="
 *
 *     TopupResponse:
 *       type: object
 *       description: Instructions for the user to complete a bank transfer top-up
 *       properties:
 *         transactionId:
 *           type: string
 *           description: ID of the pending Transaction row created for tracking
 *           example: "88"
 *         walletId:
 *           type: string
 *           example: "42"
 *         amount:
 *           type: string
 *           description: Canonical amount to transfer
 *           example: "500000.00"
 *         paymentCode:
 *           type: string
 *           description: |
 *             Transfer note the user MUST include in their bank transfer.
 *             Format: `BIDYTOPUP{transactionId padded to 3 digits}` (e.g. `BIDYTOPUP088`).
 *             The Sepay webhook matches this code to credit the correct wallet.
 *           example: "BIDYTOPUP088"
 *         qrCodeUrl:
 *           type: string
 *           format: uri
 *           description: VietQR image URL — display this as a scannable QR code
 *           example: "https://qr.sepay.vn/img?acc=0123456789&bank=MB&amount=500000&des=BIDYTOPUP088"
 *         bankInfo:
 *           type: object
 *           description: Bank account details for manual transfer
 *           properties:
 *             bankName:
 *               type: string
 *               description: Bank name (e.g. MB, VCB, TCB)
 *               example: "MB"
 *             accountNumber:
 *               type: string
 *               example: "0123456789"
 *             accountName:
 *               type: string
 *               example: "NGUYEN VAN ADMIN"
 *
 *     UserSummary:
 *       type: object
 *       description: Aggregated financial summary grouped by ledger entry type
 *       properties:
 *         walletId:
 *           type: string
 *           example: "42"
 *         balance:
 *           type: string
 *           description: Current wallet balance
 *           example: "1250000.00"
 *         status:
 *           type: string
 *           enum: [active, locked]
 *           example: "active"
 *         byType:
 *           type: object
 *           description: |
 *             Map of ledger type → { totalAmount, count }.
 *             Only types that have at least one entry are included.
 *           additionalProperties:
 *             type: object
 *             properties:
 *               totalAmount:
 *                 type: string
 *                 description: Sum of all amounts for this type (signed)
 *                 example: "2000000.00"
 *               count:
 *                 type: number
 *                 description: Number of entries of this type
 *                 example: 5
 *           example:
 *             topup_success: { totalAmount: "2000000.00", count: 3 }
 *             payment: { totalAmount: "-750000.00", count: 2 }
 *             withdraw_hold: { totalAmount: "-200000.00", count: 1 }
 *
 *     WithdrawalRequest:
 *       type: object
 *       description: A request to withdraw funds from the wallet to a bank account
 *       properties:
 *         id:
 *           type: string
 *           description: Withdrawal request ID
 *           example: "15"
 *         walletId:
 *           type: string
 *           example: "42"
 *         userId:
 *           type: string
 *           example: "7"
 *         amount:
 *           type: string
 *           description: |
 *             Amount to withdraw. This is the **exact** amount that will be bank-transferred.
 *             No fees are deducted at withdrawal — the 5% platform fee was already collected at escrow release.
 *           example: "500000.00"
 *         bankAccountNo:
 *           type: string
 *           description: Destination bank account number
 *           example: "0123456789"
 *         bankAccountName:
 *           type: string
 *           description: Account holder name (as registered with the bank)
 *           example: "NGUYEN VAN A"
 *         bankCode:
 *           type: string
 *           description: Bank code identifier
 *           example: "MB"
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, rejected, cancelled]
 *           description: |
 *             Lifecycle:
 *             - `pending` — Created, balance already held. User may cancel.
 *             - `processing` — Admin acknowledged, preparing bank transfer. User can no longer cancel.
 *             - `completed` — Admin confirmed bank transfer done (proof_file_id attached).
 *             - `rejected` — Admin rejected. Full amount refunded to wallet.
 *             - `cancelled` — User cancelled. Full amount refunded to wallet.
 *           example: "pending"
 *         cancelledBy:
 *           type: string
 *           nullable: true
 *           enum: [user, admin]
 *           description: Who initiated the cancellation. Null if not cancelled.
 *           example: null
 *         deadlineAt:
 *           type: string
 *           format: date-time
 *           description: |
 *             SLA deadline = created_at + 10 days. Admin should process before this date.
 *             Exceeding this triggers hourly cron alerts but does NOT auto-cancel.
 *           example: "2026-09-28T07:00:00.000Z"
 *         adminId:
 *           type: string
 *           nullable: true
 *           description: Admin who processed/completed/rejected this request
 *           example: null
 *         proofFileId:
 *           type: string
 *           nullable: true
 *           description: File ID of the bank transfer receipt (uploaded via file module). Present only when completed.
 *           example: "12"
 *         proofUrl:
 *           type: string
 *           nullable: true
 *           description: Fresh presigned URL of the bank transfer receipt. Minted on read via FileService. Present only when completed.
 *           example: null
 *         rejectReason:
 *           type: string
 *           nullable: true
 *           description: Reason provided by admin when rejecting
 *           example: null
 *         processedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp when admin processed/completed/rejected
 *           example: null
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-09-18T07:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-09-18T07:00:00.000Z"
 *
 *     CursorPaginatedWithdrawals:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/WithdrawalRequest'
 *         nextCursor:
 *           type: string
 *           nullable: true
 *           description: Opaque cursor for the next page. `null` = no more results.
 *           example: "15"
 */

/**
 * @swagger
 * /api/v1/wallet:
 *   get:
 *     summary: Get current user's wallet
 *     description: |
 *       Returns the authenticated user's wallet with current balance and status.
 *       Every registered user has exactly one wallet, created automatically at registration.
 *
 *       The `balance` field reflects the **available** balance: pending withdrawal holds
 *       have already been subtracted. To see the full breakdown, use `GET /api/v1/wallet/summary`.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet retrieved successfully
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
 *                   example: Wallet retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Wallet'
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 *       404:
 *         description: Wallet not found (should not happen for registered users)
 */
router.get('/', isAuth as any, walletController.getMyWallet);

/**
 * @swagger
 * /api/v1/wallet/me:
 *   get:
 *     summary: Get current user's wallet (alias)
 *     description: Alias for `GET /api/v1/wallet`. Identical behavior.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet retrieved successfully
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
 *                   example: Wallet retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Wallet'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Wallet not found
 */
router.get('/me', isAuth as any, walletController.getMyWallet);

/**
 * @swagger
 * /api/v1/wallet/transactions:
 *   get:
 *     summary: Get transaction history (cursor-paginated)
 *     description: |
 *       Returns the authenticated user's ledger entries in reverse chronological order.
 *       Uses **cursor-based pagination** (never OFFSET) for consistent results under concurrent writes.
 *
 *       Each entry includes `balanceAfter` — the wallet balance snapshot right after that entry was posted.
 *       This lets the FE render a running balance column without recalculating.
 *
 *       **Cursor format:** The `nextCursor` value is an opaque base64 string. Pass it back as-is in `?cursor=`.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum:
 *             - topup_success
 *             - payment
 *             - payment_escrow_in
 *             - payment_release
 *             - payment_escrow_out
 *             - platform_fee
 *             - payment_refund
 *             - withdraw_hold
 *             - withdraw_success
 *             - withdraw_failed
 *             - withdraw_cancelled
 *             - adjustment
 *         description: Filter by ledger entry type. Omit to return all types.
 *         example: topup_success
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter entries created on or after this timestamp (ISO 8601)
 *         example: "2026-09-01T00:00:00.000Z"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter entries created on or before this timestamp (ISO 8601)
 *         example: "2026-09-30T23:59:59.999Z"
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Opaque pagination cursor from a previous response's `nextCursor`
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of entries to return per page
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
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
 *                   example: Transactions retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/CursorPaginatedLedger'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Wallet not found
 */
router.get('/transactions', isAuth as any, walletController.getTransactions);

/**
 * @swagger
 * /api/v1/wallet/summary:
 *   get:
 *     summary: Get financial summary grouped by entry type
 *     description: |
 *       Aggregates the authenticated user's ledger into `SUM(amount)` and `COUNT` per ledger type.
 *       Useful for displaying a dashboard breakdown:
 *       - Total deposited (`topup_success`)
 *       - Total spent (`payment` — values are negative)
 *       - Total earned (`payment_release`)
 *       - Total withdrawn (`withdraw_hold` — values are negative)
 *       - etc.
 *
 *       Optional date filters narrow the aggregation window.
 *       Only types with at least one entry in the range are included in `byType`.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Aggregate entries created on or after this timestamp
 *         example: "2026-09-01T00:00:00.000Z"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Aggregate entries created on or before this timestamp
 *         example: "2026-09-30T23:59:59.999Z"
 *     responses:
 *       200:
 *         description: Summary retrieved successfully
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
 *                   example: Wallet summary retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/UserSummary'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Wallet not found
 */
router.get('/summary', isAuth as any, walletController.getSummary);

/**
 * @swagger
 * /api/v1/wallet/topup:
 *   post:
 *     summary: Initiate a wallet top-up via bank transfer
 *     description: |
 *       Creates a pending transaction and returns QR code + bank transfer instructions.
 *
 *       **User flow:**
 *       1. Call this endpoint with the desired amount.
 *       2. Display the returned `qrCodeUrl` as a scannable QR image, or show `bankInfo` for manual transfer.
 *       3. User transfers money to the displayed bank account with the exact `paymentCode` as the transfer note.
 *       4. Sepay detects the incoming transfer and fires a webhook to the backend.
 *       5. The backend credits the wallet automatically. Poll `GET /api/v1/wallet` to see the updated balance,
 *          or listen to the `wallet:topup_success` WebSocket event (room `user_<id>`, payload `{ transactionId, walletId, amount }`).
 *
 *       **Important:**
 *       - The transfer note MUST contain the `paymentCode` exactly. If the user types it wrong,
 *         the money lands in the admin bank account but the wallet is not credited automatically.
 *         Admin must then reconcile manually via the adjustment endpoint.
 *       - The amount credited is always taken from the actual bank transfer amount (Sepay payload),
 *         never from what the user requested here.
 *
 *       **Rate limited** to prevent abuse.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                 description: |
 *                   Amount to top up in VND. Accepts a decimal string (e.g. `"500000.00"`) or number.
 *                   Must be strictly positive.
 *                 example: "500000.00"
 *     responses:
 *       200:
 *         description: Top-up QR code and payment instructions generated
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
 *                   example: Top-up instructions generated successfully
 *                 data:
 *                   $ref: '#/components/schemas/TopupResponse'
 *       400:
 *         description: |
 *           Validation error. Possible messages:
 *           - `Amount is required`
 *           - `Top-up amount must be strictly positive`
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Wallet is locked (`WALLET_LOCKED`)
 *       429:
 *         description: Too many requests — rate limit exceeded
 */
router.post(
  '/topup',
  rateLimiters.walletTopup,
  isAuth as any,
  dtoValidationMiddleware(TopupDto),
  walletController.topup,
);

/**
 * @swagger
 * /api/v1/wallet/withdrawals:
 *   post:
 *     summary: Create a withdrawal request
 *     description: |
 *       Requests a withdrawal of funds from the wallet to an external bank account.
 *
 *       **Key behaviors:**
 *       - The requested amount is **debited immediately** (`withdraw_hold`) so it cannot be spent elsewhere.
 *       - The user will receive **exactly 100%** of the requested amount. No fees are deducted at withdrawal —
 *         the 5% platform fee was already collected when escrow was released to the seller.
 *       - Each user may have **at most one open request** (status `pending` or `processing`) at a time.
 *         Attempting to create a second request returns `WITHDRAWAL_ALREADY_PENDING`.
 *       - The SLA deadline is **10 calendar days** from creation (`deadlineAt`). Admin is alerted hourly
 *         for overdue requests but they are NOT auto-cancelled.
 *       - The platform wallet (system account) is blocked from creating withdrawal requests.
 *
 *       **Admin workflow after creation:**
 *       1. Admin lists pending requests via `GET /api/v1/admin/wallet/withdrawals?status=pending`
 *       2. Admin marks as processing: `PATCH .../process`
 *       3. Admin transfers money via bank app, uploads receipt
 *       4. Admin confirms: `POST .../complete` with `proof_file_id`
 *       — or rejects: `POST .../reject` with `reject_reason`
 *
 *       **Rate limited** to prevent abuse.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - bankAccountNo
 *               - bankAccountName
 *               - bankCode
 *             properties:
 *               amount:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                 description: Amount to withdraw in VND. Must be strictly positive and ≤ available balance.
 *                 example: "500000.00"
 *               bankAccountNo:
 *                 type: string
 *                 description: Destination bank account number
 *                 example: "0123456789"
 *               bank_account_no:
 *                 type: string
 *                 description: Alias for `bankAccountNo` (snake_case)
 *               bankAccountName:
 *                 type: string
 *                 description: Account holder name as registered with the bank
 *                 example: "NGUYEN VAN A"
 *               bank_account_name:
 *                 type: string
 *                 description: Alias for `bankAccountName` (snake_case)
 *               bankCode:
 *                 type: string
 *                 description: Bank code (e.g. MB, VCB, TCB, BIDV, ACB)
 *                 example: "MB"
 *               bank_code:
 *                 type: string
 *                 description: Alias for `bankCode` (snake_case)
 *     responses:
 *       201:
 *         description: Withdrawal request created, balance debited
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
 *                   example: Withdrawal request created successfully
 *                 data:
 *                   $ref: '#/components/schemas/WithdrawalRequest'
 *       400:
 *         description: |
 *           Validation or business logic error. Possible messages:
 *           - `amount is required`
 *           - `Withdrawal amount must be strictly positive`
 *           - `bankAccountNo, bankAccountName, and bankCode are required`
 *           - `WITHDRAWAL_ALREADY_PENDING` — user already has an open request
 *           - `INSUFFICIENT_BALANCE` — not enough available balance
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: |
 *           Forbidden. Possible causes:
 *           - `WALLET_LOCKED` — wallet is frozen
 *           - `Platform wallet may not create a withdrawal request`
 *       429:
 *         description: Too many requests — rate limit exceeded
 */
router.post(
  '/withdrawals',
  rateLimiters.walletWithdrawal,
  isAuth as any,
  dtoValidationMiddleware(CreateWithdrawalDto),
  walletController.createWithdrawal,
);

/**
 * @swagger
 * /api/v1/wallet/withdrawals:
 *   get:
 *     summary: List my withdrawal requests (cursor-paginated)
 *     description: |
 *       Returns the authenticated user's withdrawal requests in reverse chronological order.
 *       Includes requests in all statuses (pending, processing, completed, rejected, cancelled).
 *
 *       **Status meaning for the UI:**
 *       - `pending` — money is already held (deducted from balance). User may cancel via `DELETE /withdrawals/{id}`.
 *       - `processing` — admin is transferring; cancel is no longer allowed (hide the cancel button).
 *       - `completed` — transferred; `proofUrl` holds the bank receipt image.
 *       - `rejected` — full amount returned to the wallet; show `rejectReason`.
 *       - `cancelled` — user cancelled; full amount returned to the wallet.
 *
 *       Show `deadlineAt` (10-day SLA) on open requests. Only one request can be open
 *       (`pending`/`processing`) at a time, so disable "Rút tiền" while one exists.
 *
 *       Pagination: pass the returned `nextCursor` as `cursor`; `nextCursor = null` means last page.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Opaque pagination cursor from a previous response
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Withdrawal requests retrieved
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
 *                   example: Withdrawals retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/CursorPaginatedWithdrawals'
 *       401:
 *         description: Unauthorized
 */
router.get('/withdrawals', isAuth as any, walletController.getMyWithdrawals);

/**
 * @swagger
 * /api/v1/wallet/withdrawals/{id}:
 *   delete:
 *     summary: Cancel a pending withdrawal request
 *     description: |
 *       Cancels a withdrawal request and **refunds 100%** of the held amount back to the wallet.
 *
 *       **Rules:**
 *       - Only the owner of the request may cancel it.
 *       - Only requests with status `pending` can be cancelled.
 *       - Once status is `processing`, the admin may have already initiated a bank transfer,
 *         so cancellation is blocked. The user must contact admin directly.
 *       - Replaying a cancel on an already-cancelled request is **idempotent** — returns the
 *         cancelled request without error and without moving money again.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Withdrawal request ID
 *         example: "15"
 *     responses:
 *       200:
 *         description: Withdrawal cancelled, funds refunded to wallet
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
 *                   example: Withdrawal request cancelled successfully
 *                 data:
 *                   $ref: '#/components/schemas/WithdrawalRequest'
 *       400:
 *         description: |
 *           Cannot cancel. Possible messages:
 *           - `Cannot cancel withdrawal with status "processing"` (or completed/rejected)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — not the owner of this request
 *       404:
 *         description: Withdrawal request not found
 */
router.delete('/withdrawals/:id', isAuth as any, walletController.cancelWithdrawal);

export default router;
