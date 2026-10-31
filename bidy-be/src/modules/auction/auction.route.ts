import { Router } from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { Auction } from './entity/auctions.entity.js';
import { BidHistory } from './entity/bid-history.entity.js';
import { Product } from '../product/entities/product.entity.js';
import { Order } from '../order/entity/order.entity.js';
import { Category } from '../category/category.entity.js';
import { CategoryService } from '../category/category.service.js';
import { ProductService } from '../product/product.service.js';
import { AuctionService } from './auction.service.js';
import { AuctionController } from './auction.controller.js';
import { isAuth, requireAdmin } from '../../middlewares/authen.middleware.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { ListingAuctionDto } from './dtos/listing-auction.dto.js';
import { AuctionBidDto } from './dtos/auction-bid.dto.js';
import { EnableAutoBidDto } from './dtos/auto-bid.dto.js';
import { AuctionQueryDto } from './dtos/auction-query.dto.js';
import { AuctionSearchDto } from './dtos/auction-search.dto.js';
import { BidHistoryQueryDto } from './dtos/bid-history-query.dto.js';
import upload from '../../middlewares/image-upload.middleware.js';
import * as bidHistoryController from './bid-history.controller.js';

export const auctionRouter = Router();

// Instantiate Service and Controller
const auctionService = new AuctionService(
  AppDataSource,
  AppDataSource.getRepository(Auction),
  AppDataSource.getRepository(BidHistory),
  AppDataSource.getRepository(Product),
  AppDataSource.getRepository(Order),
  new CategoryService(AppDataSource.getRepository(Category)),
  new ProductService(
    AppDataSource.getRepository(Product),
    AppDataSource.getRepository(Category),
    AppDataSource,
  ),
);

const auctionController = new AuctionController(auctionService);

// Public Routes

/**
 * @swagger
 * /api/v1/auctions/search/{keyword}:
 *   get:
 *     summary: Search auctions by keyword (header suggestions)
 *     description: >
 *       Feeds the header search dropdown, so it returns a small capped slice and
 *       has no paging: `total` is there only to offer "see all N results". Matches
 *       the keyword against product name or description, case-insensitively.
 *       Wildcards in the keyword are escaped. Omit `status` to search only auctions
 *       a user can still act on — live and upcoming ones.
 *     tags: [Auction]
 *     parameters:
 *       - in: path
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, happening, ended, cancelled]
 *     responses:
 *       200:
 *         description: Matching auctions returned, soonest-closing first
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
 *                   example: Success
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *                       description: Total matches, which may exceed the returned slice
 *       400:
 *         description: Invalid query parameters
 */
auctionRouter.get(
  '/search/:keyword',
  dtoValidationMiddleware(AuctionSearchDto, 'query') as any,
  (req: any, res: any) => auctionController.getProductBySearch(req, res),
);

/**
 * @swagger
 * /api/v1/auctions/category/{category}:
 *   get:
 *     summary: List auctions in a category subtree, optionally filtered and sorted
 *     description: >
 *       Covers the category and every descendant, so a parent category returns the
 *       auctions of its children. Omit `status` to list every status. Omit `sortBy`
 *       to keep the default: ended auctions newest-first, live and upcoming ones
 *       closing-soonest-first. Returns the same paginated envelope as GET /auctions.
 *     tags: [Auction]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, happening, ended, cancelled]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [endDate, createdAt, currentPrice, bidderCount, totalBids]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Auctions returned
 *       400:
 *         description: Invalid query parameters
 */
auctionRouter.get(
  '/category/:category',
  dtoValidationMiddleware(AuctionQueryDto, 'query') as any,
  (req: any, res: any) => auctionController.getProductByCategory(req, res),
);

/**
 * @swagger
 * /api/v1/auctions:
 *   get:
 *     summary: List auctions, optionally filtered by status
 *     description: >
 *       Replaces the former /auctions/status/ended. Omit `status` to list every
 *       auction; pass one of the AuctionStatus values to filter. Omit `sortBy` to
 *       keep the default: ended auctions newest-first, live and upcoming ones
 *       closing-soonest-first.
 *
 *       Each item carries its `product`, including `product.owner` narrowed to
 *       `{ id, username }` so a card can name the seller without a second call.
 *     tags: [Auction]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, happening, ended, cancelled]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [endDate, createdAt, currentPrice, bidderCount, totalBids]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Paginated auctions returned
 *       400:
 *         description: Invalid query parameters
 */
auctionRouter.get(
  '/',
  dtoValidationMiddleware(AuctionQueryDto, 'query') as any,
  (req: any, res: any) => auctionController.getAuctions(req, res),
);

/**
 * @swagger
 * components:
 *   schemas:
 *     Bidder:
 *       type: object
 *       properties:
 *         userId: { type: string, example: "42" }
 *         userName: { type: string, example: "nguyenvana" }
 *         avatarFileId:
 *           type: string
 *           nullable: true
 *           description: Id in the files table. Re-sign an expired avatarUrl via GET /api/v1/files/:id/url
 *         avatarUrl:
 *           type: string
 *           nullable: true
 *           description: Presigned URL, valid for 1 hour. Render it, do not persist it.
 *         bidCount: { type: integer, example: 3 }
 *         highestAmount: { type: number, example: 250000 }
 *         latestBidTime: { type: string, format: date-time }
 *         rank:
 *           type: integer
 *           description: Sorted server-side, starting at 1. Clients must not re-sort.
 *           example: 1
 *     BidderStats:
 *       type: object
 *       properties:
 *         totalBidders:
 *           type: integer
 *           description: Every distinct bidder — never capped, even when uniqueBidders is.
 *           example: 37
 *         totalBids:
 *           type: integer
 *           description: Every bid row, manual and proxy. Never capped.
 *           example: 128
 *         uniqueBidders:
 *           type: array
 *           description: Leading bidders, capped at 20.
 *           items:
 *             $ref: '#/components/schemas/Bidder'
 *         truncated:
 *           type: boolean
 *           description: True when there are more bidders than uniqueBidders carries.
 *         watcherCount:
 *           type: integer
 *           description: >
 *             People currently viewing the auction, deduped per logged-in user.
 *             Counted in-process, so it is only accurate on a single API instance.
 *           example: 12
 *
 * /api/v1/auctions/{auctionId}/bidders:
 *   get:
 *     summary: Get the list of bidders for an auction
 *     tags: [Auction]
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: >
 *           Bidder statistics, one entry per bidder rather than per bid. The same
 *           payload the `bidderUpdate` socket event pushes, so clients parse one
 *           shape. Works for ended auctions too — it reads bid history, not status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string, example: Success }
 *                 data:
 *                   $ref: '#/components/schemas/BidderStats'
 */
auctionRouter.get('/:auctionId/bidders', (req: any, res: any) => auctionController.getBidders(req, res));

/**
 * @swagger
 * /api/v1/auctions/{auctionId}/bid-history:
 *   get:
 *     summary: Get the bid history for an auction
 *     tags: [Auction]
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bid history returned
 *       404:
 *         description: Auction not found
 */
auctionRouter.get('/:auctionId/bid-history', (req: any, res: any) => bidHistoryController.getAuctionBidHistory(req, res));

/**
 * @swagger
 * /api/v1/auctions/{id}:
 *   get:
 *     summary: Get an auction by id
 *     tags: [Auction]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auction returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   description: >
 *                     Only the image-bearing fields are documented here; the rest of
 *                     the auction payload is returned as-is.
 *                   properties:
 *                     image:
 *                       type: array
 *                       items: { type: string }
 *                       description: >
 *                         Presigned URLs, valid for 1 hour. Render them, do not persist
 *                         them.
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       description: >
 *                         Units sold in this auction, going to one winner. Prices on
 *                         this payload are for the whole lot, not per unit.
 *                       example: 1
 *                     imageFileIds:
 *                       type: array
 *                       items: { type: string }
 *                       description: >
 *                         Ids in the files table, parallel to `image` and in the same
 *                         order. Use GET /api/v1/files/:id/url to re-sign an entry of
 *                         `image` once it expires, without refetching the auction.
 *                       example: ["12", "13"]
 *       404:
 *         description: Auction not found
 */
auctionRouter.get('/:id', (req: any, res: any) => auctionController.getProductById(req, res));

// Protected Routes (Require Authentication)
auctionRouter.use(isAuth as any);

/**
 * @swagger
 * /api/v1/auctions:
 *   post:
 *     summary: Create an auction directly (Admin only)
 *     description: >
 *       ADMIN ONLY. Sellers file an auction request instead
 *       (POST /api/v1/auction-requests) and an admin's approval creates the auction;
 *       a seller calling this gets 403. Admins keep the direct path so they can list
 *       something without queueing a request to themselves.
 *
 *       Two modes.
 *
 *       EXISTING PRODUCT — send `product_id` and only the pricing/schedule fields.
 *       Name, category, condition, description and images all come from the product,
 *       so nothing is re-entered and no duplicate product is created. The product
 *       must be `active`, own at least one image, and have no pending or running
 *       auction.
 *
 *       In this mode `name`, `category_id`, `description`, `condition` and `images`
 *       are all REJECTED with 400 rather than ignored — sending one means you expect
 *       it to apply, and quietly dropping it would leave the seller looking at a
 *       listing that never took their edit. Change them through
 *       PATCH /api/v1/products/:id and /api/v1/products/:productId/images.
 *
 *       INLINE PRODUCT — omit `product_id` and send the product fields plus
 *       `images`. The product is created alongside the auction, already published.
 *
 *       This endpoint is multipart/form-data because of the inline mode; scalar
 *       fields are ordinary form fields.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - starting_price
 *               - start_date
 *               - end_date
 *             properties:
 *               product_id:
 *                 type: string
 *                 description: >
 *                   Auction a product from /api/v1/me/products. When present this is
 *                   the only source of product data: `name`, `category_id`,
 *                   `description`, `condition` and `images` are rejected with 400,
 *                   not ignored. Check `canCreateAuction` on the product before
 *                   offering this action.
 *                 example: "17"
 *               name:
 *                 type: string
 *                 description: Inline mode only. Rejected with 400 alongside product_id.
 *               category_id:
 *                 type: string
 *                 description: Inline mode only. Rejected with 400 alongside product_id.
 *               description:
 *                 type: string
 *                 description: Inline mode only. Rejected with 400 alongside product_id.
 *               condition:
 *                 type: string
 *                 enum: [new, like_new, used, refurbished]
 *                 description: Inline mode only. Rejected with 400 alongside product_id.
 *               images:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: >
 *                   Inline mode only, max 5 MB each. Rejected with 400 when sent
 *                   together with product_id.
 *               starting_price:
 *                 type: number
 *               buy_now_price:
 *                 type: number
 *               reserve_price:
 *                 type: number
 *               bid_increment:
 *                 type: number
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *                 description: >
 *                   Units of the product sold in this auction. The lot goes to a
 *                   single winner, so every price above is for the whole lot, not
 *                   per unit. Valid in both modes — it describes the sale, not the
 *                   product, so it is accepted alongside product_id.
 *                 example: 1
 *               start_date:
 *                 type: string
 *               end_date:
 *                 type: string
 *     responses:
 *       201:
 *         description: Auction created
 *       400:
 *         description: >
 *           Invalid input, or a product-owned field (name, category_id, description,
 *           condition, images) sent alongside product_id
 *       403:
 *         description: >
 *           Caller is not an admin — sellers use POST /api/v1/auction-requests — or
 *           the product belongs to someone else
 *       409:
 *         description: PRODUCT_HAS_LIVE_AUCTION
 *       422:
 *         description: PRODUCT_NOT_AUCTIONABLE (not published, or has no image)
 */
// listingAuction reads req.files, so multer has to run before validation — without
// it a multipart body never gets parsed and every DTO field reads as missing.
auctionRouter.post(
  '/',
  // Admin-only since the approval queue landed: a seller who could still create an
  // auction here would be able to skip review entirely, which would leave the queue
  // enforcing nothing.
  requireAdmin as any,
  upload.array('images', 10),
  dtoValidationMiddleware(ListingAuctionDto) as any,
  (req: any, res: any) => auctionController.listingAuction(req, res),
);

/**
 * @swagger
 * /api/v1/auctions/{id}:
 *   put:
 *     summary: Update an auction owned by the authenticated user
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Every field optional; only what you send is changed.
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               category_id: { type: string }
 *               condition:
 *                 type: string
 *                 enum: [new, like_new, used, refurbished]
 *               starting_price:
 *                 type: number
 *                 description: Also resets current_price, which is safe only while pending.
 *               buy_now_price: { type: number }
 *               reserve_price: { type: number }
 *               bid_increment: { type: number }
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: >
 *                   Units in the lot. Editable only while the auction is still
 *                   pending — once bidding has opened, changing the lot size would
 *                   be a bait-and-switch on everyone who already bid.
 *               start_date: { type: string }
 *               end_date: { type: string }
 *     responses:
 *       200:
 *         description: Auction updated
 *       400:
 *         description: >
 *           Auction is no longer pending, or quantity is not a whole number >= 1
 *       404:
 *         description: Auction not found, or not owned by the caller
 */
auctionRouter.put('/:id', (req: any, res: any) => auctionController.updateProduct(req, res));

/**
 * @swagger
 * /api/v1/auctions/{id}:
 *   delete:
 *     summary: Delete an auction owned by the authenticated user
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auction deleted
 *       404:
 *         description: Auction not found
 */
auctionRouter.delete('/:id', (req: any, res: any) => auctionController.deleteMyAuction(req, res));

/**
 * @swagger
 * /api/v1/auctions/{id}/cancel:
 *   post:
 *     summary: Withdraw your own auction, while it still has no bids
 *     description: >
 *       Bidders commit against the closing time a listing advertised, so a seller
 *       cannot cut a contested auction short — that would hand them the choice of
 *       when to stop the price. Once any bid exists the auction runs to its end, and
 *       this returns 409 `AUCTION_HAS_BIDS`.
 *
 *       With no bids there is nobody to disadvantage, so a seller who listed by
 *       mistake can withdraw. The auction moves to `cancelled` and leaves every
 *       public listing. Nothing is refunded because bidding holds no money — escrow
 *       only exists once an order is created.
 *
 *       Read `totalBids` from the auction payload to decide whether to offer the
 *       action; no extra call is needed. Admins use
 *       PATCH /api/v1/admin/auctions/{id}/cancel instead, which has no bid
 *       precondition.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Auction cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     status: { type: string, example: cancelled }
 *       404:
 *         description: >
 *           Auction not found, or owned by someone else — the two are deliberately
 *           indistinguishable (error_code AUCTION_NOT_FOUND)
 *       409:
 *         description: >
 *           `AUCTION_HAS_BIDS` when anyone has bid, or `AUCTION_NOT_CANCELLABLE`
 *           when the auction already ended or was cancelled
 */
auctionRouter.post('/:id/cancel', (req: any, res: any) => auctionController.cancelMyAuction(req, res));

/**
 * @swagger
 * /api/v1/auctions/{id}/bid:
 *   post:
 *     summary: Place a bid on an auction
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *                 type: number
 *               isAuto:
 *                 type: boolean
 *                 description: Enable proxy (auto) bidding
 *               limitBid:
 *                 type: number
 *                 description: Ceiling for proxy bidding, required when isAuto is true
 *     responses:
 *       200:
 *         description: Bid placed
 *       400:
 *         description: Invalid bid
 *       404:
 *         description: Auction not found
 */
auctionRouter.post('/:id/bid', dtoValidationMiddleware(AuctionBidDto) as any, (req: any, res: any) => auctionController.auctionBid(req, res));

/**
 * @swagger
 * /api/v1/auctions/{id}/auto-bid:
 *   post:
 *     summary: Enable proxy (auto) bidding on an auction
 *     description: >
 *       Send only the ceiling. The server places the opening bid at the current
 *       minimum and raises it automatically when outbid, stopping at the ceiling;
 *       the step comes from the auction's own bidIncrement. Clients must not compute
 *       bid amounts — doing so races whoever bids in between.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EnableAutoBidDto'
 *     responses:
 *       200:
 *         description: Auto-bid enabled and the opening bid placed
 *       400:
 *         description: Ceiling below the current minimum, or auction not biddable
 *   get:
 *     summary: Read your own proxy-bidding state for an auction
 *     description: Returns only the caller's own ceiling — never another bidder's.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auto-bid state returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string, example: Success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     isActive: { type: boolean }
 *                     limitBid: { type: number, nullable: true }
 *                     currentAmount: { type: number }
 *                     minNextBid: { type: number }
 *   delete:
 *     summary: Disable proxy (auto) bidding on an auction for the authenticated user
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auto-bid disabled
 *       404:
 *         description: Auction not found
 */
auctionRouter.post('/:id/auto-bid', dtoValidationMiddleware(EnableAutoBidDto) as any, (req: any, res: any) => auctionController.enableAutoBid(req, res));
auctionRouter.get('/:id/auto-bid', (req: any, res: any) => auctionController.getAutoBid(req, res));
auctionRouter.delete('/:id/auto-bid', (req: any, res: any) => auctionController.disableAutoBid(req, res));

/**
 * @swagger
 * /api/v1/auctions/{id}/buy-now:
 *   post:
 *     summary: Buy an auction immediately at its buy-now price
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Purchase completed, order created
 *       400:
 *         description: >
 *           Rejected with a stable `error_code`: BUY_NOW_NOT_AVAILABLE (no buy-now price),
 *           AUCTION_NOT_ACTIVE (already ended or not started), SELLER_CANNOT_BUY,
 *           or MISSING_SHIPPING_ADDRESS (set one via /api/v1/users/addresses)
 *       401:
 *         description: Unauthenticated
 *       404:
 *         description: Auction not found (error_code AUCTION_NOT_FOUND)
 *       409:
 *         description: Bidding has passed the buy-now price (error_code BUY_NOW_PRICE_EXCEEDED)
 *       500:
 *         description: Internal server error
 */
auctionRouter.post('/:id/buy-now', (req: any, res: any) => auctionController.buyNow(req, res));

/**
 * @swagger
 * /api/v1/auctions/user/bid-history:
 *   get:
 *     summary: Get the authenticated user's bid history, paginated
 *     description: >
 *       `stats` covers the caller's ENTIRE history, not the page — a "won" count that
 *       changed as you paged would not be describing what it claims to. It sits next
 *       to `history` rather than inside `pagination` for the same reason.
 *
 *       `actionType` and `auctionStatus` are separate filters because they are not
 *       the same axis: won/lost/buy_now are values on the bid row, while "still
 *       running" is a property of the auction. A single dropdown in the UI maps
 *       "Đang diễn ra" to `auctionStatus=happening` and the rest to `actionType`.
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *           enum: [place_bid, auto_bid, won, lost, buy_now]
 *       - in: query
 *         name: auctionStatus
 *         schema:
 *           type: string
 *           enum: [pending, happening, ended, cancelled]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, amount]
 *         description: >
 *           `position` is deliberately not sortable — it is the rank recorded when
 *           the row was written and is nullable.
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches the product name, case-insensitively.
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string }
 *         description: >
 *           ISO 8601 date-time or a bare `YYYY-MM-DD`. Filters on the BID's
 *           createdAt, not the auction's. Inclusive.
 *       - in: query
 *         name: dateTo
 *         schema: { type: string }
 *         description: >
 *           Same formats, inclusive. A bare date covers the whole day, so
 *           `2026-09-20` includes bids placed at 23:59 that day.
 *     responses:
 *       200:
 *         description: Bid history returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     history:
 *                       type: array
 *                       items: { type: object }
 *                     stats:
 *                       type: object
 *                       description: Computed over the whole history, not the page.
 *                       properties:
 *                         total: { type: integer }
 *                         won: { type: integer }
 *                         lost: { type: integer }
 *                         active:
 *                           type: integer
 *                           description: Distinct auctions still happening, not bid rows.
 *                         buy_now: { type: integer }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         totalItems: { type: integer }
 *                         totalPages: { type: integer }
 *                         hasNextPage: { type: boolean }
 *                         hasPreviousPage: { type: boolean }
 *       400:
 *         description: Invalid query parameters
 */
auctionRouter.get(
  '/user/bid-history',
  dtoValidationMiddleware(BidHistoryQueryDto, 'query') as any,
  (req: any, res: any) => bidHistoryController.getUserBidHistory(req, res),
);

/**
 * @swagger
 * /api/v1/auctions/user/my-auctions:
 *   get:
 *     summary: List auctions created by the authenticated user
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Auctions returned
 */
auctionRouter.get('/user/my-auctions', (req: any, res: any) => auctionController.getMyAuction(req, res));

/**
 * @swagger
 * /api/v1/auctions/user/cart:
 *   get:
 *     summary: View the authenticated user's cart
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart returned
 */
auctionRouter.get('/user/cart', (req: any, res: any) => auctionController.viewCart(req, res));

/**
 * @swagger
 * /api/v1/auctions/user/bought/{id}:
 *   get:
 *     summary: List auctions bought by the authenticated user
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auctions returned
 */
auctionRouter.get('/user/bought/:id?', (req: any, res: any) => auctionController.getAuctionUserBought(req, res));

/**
 * @swagger
 * /api/v1/auctions/user/sold/{id}:
 *   get:
 *     summary: List auctions sold by the authenticated user
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auctions returned
 */
auctionRouter.get('/user/sold/:id?', (req: any, res: any) => auctionController.getAuctionUserSold(req, res));

/**
 * @swagger
 * /api/v1/auctions/user/status/{status}/{id}:
 *   get:
 *     summary: List the authenticated user's auctions filtered by status
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auctions returned
 */
auctionRouter.get('/user/status/:status/:id?', (req: any, res: any) => auctionController.getUserAuctionByStatus(req, res));

export default auctionRouter;
