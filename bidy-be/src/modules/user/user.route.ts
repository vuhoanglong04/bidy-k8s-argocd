import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { User } from './entity/user.entity.js';
import { Wishlist } from './entity/wishlist.entity.js';
import { Auction } from '../auction/entity/auctions.entity.js';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { BcryptService } from '../auth/bcrypt.service.js';
import { isAuth } from '../../middlewares/authen.middleware.js';
import { rateLimiters } from '../../middlewares/security.middleware.js';
import { validationMiddlewares } from '../../middlewares/validation.middleware.js';
import upload from '../../middlewares/image-upload.middleware.js';
import supportController from './user.support.controller.js';
import productGridController from '../chat/product-grid.controller.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { ProductGridMessageDto } from './dtos/product-grid-message.dto.js';
import { CreateAddressDto, UpdateAddressDto } from './dtos/address.dto.js';
import { Address } from '../../common/entity/address.entity.js';

const router = express.Router();

const userService = new UserService(
  AppDataSource.getRepository(User),
  AppDataSource.getRepository(Wishlist),
  AppDataSource.getRepository(Auction),
  new BcryptService(),
  AppDataSource.getRepository(Address),
);
const userController = new UserController(userService);

// ===== PUBLIC =====

/**
 * @swagger
 * /api/v1/users/check:
 *   post:
 *     summary: Check whether a username, email or phone is already taken
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Check completed
 */
router.post('/check', (req: any, res: any) => userController.checkUser(req, res));

// ===== AUTHENTICATED =====
router.use(isAuth as any);

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Profile returned
 *       404:
 *         description: User not found
 */
router.get('/profile', (req: any, res: any) => userController.viewProfile(req, res));

/**
 * @swagger
 * /api/v1/users/stats:
 *   get:
 *     summary: Get the authenticated user's auction statistics
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Statistics returned
 */
router.get('/stats', (req: any, res: any) => userController.getUserStats(req, res));

/**
 * @swagger
 * /api/v1/users/update:
 *   patch:
 *     summary: Update the authenticated user's profile
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Profile updated
 *       409:
 *         description: Email or phone already in use
 */
router.patch('/update', (req: any, res: any) => userController.userUpdate(req, res));

/**
 * @swagger
 * /api/v1/users/changePassword:
 *   put:
 *     summary: Change the authenticated user's password
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Old password incorrect
 */
router.put('/changePassword',
  rateLimiters.auth,
  validationMiddlewares.validateChangePassword as any,
  (req: any, res: any) => userController.changePassword(req, res),
);

/**
 * @swagger
 * /api/v1/users/avatar:
 *   post:
 *     summary: Upload a new avatar for the authenticated user
 *     description: >
 *       Uploads to object storage and attaches the result to the caller in one
 *       step, replacing any previous avatar and deleting the superseded object.
 *       Avatars do not go through POST /api/v1/files.
 *       The returned URL is presigned and expires in one hour — render it, do not
 *       persist it. Re-read the profile to obtain a fresh one.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: >
 *                   Image file, max 5 MB. Allowed types: image/jpeg, image/png,
 *                   image/webp, image/gif, image/avif.
 *     responses:
 *       200:
 *         description: Avatar updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string, example: Cập nhật ảnh đại diện thành công }
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatar:
 *                       type: string
 *                       description: Presigned URL, valid for 1 hour
 *       400:
 *         description: No file provided, or the file exceeds 5 MB / is not an allowed image type
 *       401:
 *         description: Unauthenticated
 *       404:
 *         description: User not found
 */
router.post('/avatar',
  upload.single('avatar'),
  (req: any, res: any) => userController.updateAvatar(req, res),
);

// ===== WISHLIST =====

/**
 * @swagger
 * /api/v1/users/wishlist:
 *   get:
 *     summary: List the authenticated user's wishlist
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Wishlist returned
 *       400:
 *         description: Invalid pagination parameters
 *       500:
 *         description: Internal server error
 */
router.get('/wishlist',
  validationMiddlewares.validatePagination as any,
  (req: any, res: any) => userController.wishlist(req, res),
);

/**
 * @swagger
 * /api/v1/users/wishlist/add/{id}:
 *   post:
 *     summary: Add an item to the authenticated user's wishlist
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Added to wishlist
 *       400:
 *         description: Missing auction id
 *       409:
 *         description: Auction already in wishlist
 *       500:
 *         description: Internal server error
 */
router.post('/wishlist/add/:id', (req: any, res: any) => userController.addWishlist(req, res));

/**
 * @swagger
 * /api/v1/users/wishlist/removeAll:
 *   delete:
 *     summary: Remove all items from the authenticated user's wishlist
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wishlist cleared
 *       500:
 *         description: Internal server error
 */
router.delete('/wishlist/removeAll', (req: any, res: any) => userController.removeAllWishlist(req, res));

/**
 * @swagger
 * /api/v1/users/wishlist/remove/{id}:
 *   delete:
 *     summary: Remove an item from the authenticated user's wishlist
 *     tags: [User]
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
 *         description: Removed from wishlist
 *       400:
 *         description: Missing auction id
 *       500:
 *         description: Internal server error
 */
router.delete('/wishlist/remove/:id', (req: any, res: any) => userController.removeWishlist(req, res));

// ===== ADDRESSES =====

/**
 * @swagger
 * /api/v1/users/addresses:
 *   get:
 *     summary: List the authenticated user's shipping addresses
 *     description: Ordered with the default first. A user with any address always has exactly one default.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addresses returned
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Add a shipping address
 *     description: The first address a user creates becomes their default automatically.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAddressDto'
 *     responses:
 *       201:
 *         description: Address created
 *       400:
 *         description: Validation failed
 *       500:
 *         description: Internal server error
 */
router.get('/addresses', (req: any, res: any) => userController.listAddresses(req, res));
router.post('/addresses',
  dtoValidationMiddleware(CreateAddressDto) as any,
  (req: any, res: any) => userController.createAddress(req, res),
);

/**
 * @swagger
 * /api/v1/users/addresses/{id}:
 *   patch:
 *     summary: Update one of the authenticated user's addresses
 *     tags: [User]
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
 *             $ref: '#/components/schemas/UpdateAddressDto'
 *     responses:
 *       200:
 *         description: Address updated
 *       400:
 *         description: Validation failed
 *       404:
 *         description: Address not found (error_code ADDRESS_NOT_FOUND)
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete one of the authenticated user's addresses
 *     description: >
 *       Deleting the default promotes the oldest remaining address in its place.
 *       An address already attached to an order cannot be deleted.
 *     tags: [User]
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
 *         description: Address deleted
 *       404:
 *         description: Address not found (error_code ADDRESS_NOT_FOUND)
 *       409:
 *         description: Address is attached to an order (error_code ADDRESS_IN_USE)
 *       500:
 *         description: Internal server error
 */
router.patch('/addresses/:id',
  dtoValidationMiddleware(UpdateAddressDto) as any,
  (req: any, res: any) => userController.updateAddress(req, res),
);
router.delete('/addresses/:id', (req: any, res: any) => userController.removeAddress(req, res));

/**
 * @swagger
 * /api/v1/users/addresses/{id}/default:
 *   patch:
 *     summary: Make one of the authenticated user's addresses the default
 *     description: Demotes the previous default in the same transaction.
 *     tags: [User]
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
 *         description: Default address updated
 *       404:
 *         description: Address not found (error_code ADDRESS_NOT_FOUND)
 *       500:
 *         description: Internal server error
 */
router.patch('/addresses/:id/default', (req: any, res: any) => userController.setDefaultAddress(req, res));

// ===== SUPPORT CHAT =====

/**
 * @swagger
 * /api/v1/users/support/chat:
 *   post:
 *     summary: Start a support chat for the authenticated user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support chat started
 */
router.post('/support/chat', (req: any, res: any) => supportController.startSupportChat(req, res));

/**
 * @swagger
 * /api/v1/users/support/chat:
 *   get:
 *     summary: Get the authenticated user's support chat
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support chat returned
 *       404:
 *         description: No support chat found
 */
router.get('/support/chat', (req: any, res: any) => supportController.getMyChat(req, res));

/**
 * @swagger
 * /api/v1/users/support/messages:
 *   post:
 *     summary: Send a message in the authenticated user's support chat
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Message sent
 */
router.post('/support/messages', (req: any, res: any) => supportController.sendMessage(req, res));

/**
 * @swagger
 * /api/v1/users/support/chat/{chatId}/messages:
 *   get:
 *     summary: Get a page of messages for a support chat
 *     description: >
 *       Page 1 is the MOST RECENT messages, page 2 the ones before those — built for
 *       a chat that opens at the latest message and loads older history as it
 *       scrolls up. Within a page the rows are oldest-first, so render them top to
 *       bottom without reversing. `hasMore` says whether an older page exists.
 *
 *       Each row carries `senderType` ('user' | 'admin'), derived server-side from
 *       the ticket owner. Do not infer the side by comparing ids on the client: that
 *       gets it wrong as soon as a second admin replies to a ticket the first one is
 *       looking at.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 1 is the most recent page; higher numbers go further back.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 20
 *     responses:
 *       200:
 *         description: A page of messages, oldest-first within the page
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
 *                     messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           content: { type: string }
 *                           senderType:
 *                             type: string
 *                             enum: [user, admin]
 *                             description: Derived from the ticket owner, server-side.
 *                           sender: { type: object }
 *                           createdAt: { type: string, format: date-time }
 *                     totalPages: { type: integer }
 *                     currentPage: { type: integer }
 *                     totalMessages: { type: integer }
 *                     hasMore:
 *                       type: boolean
 *                       description: True when an older page exists.
 *       404:
 *         description: Chat not found, or not owned by the caller
 */
router.get('/support/chat/:chatId/messages', (req: any, res: any) => supportController.getChatMessages(req, res));

/**
 * @swagger
 * /api/v1/users/support/chat/{chatId}/read:
 *   patch:
 *     summary: Mark messages in a support chat as read
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 *       404:
 *         description: Chat not found
 */
router.patch('/support/chat/:chatId/read', (req: any, res: any) => supportController.markMessagesAsRead(req, res));

/**
 * @swagger
 * /api/v1/users/support/messages/product-grid:
 *   post:
 *     summary: Send a product grid message in a support chat
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *               - productIds
 *             properties:
 *               chatId:
 *                 type: string
 *               productIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               message:
 *                 type: string
 *               gridConfig:
 *                 type: object
 *     responses:
 *       200:
 *         description: Message sent
 *       400:
 *         description: Invalid input
 */
router.post('/support/messages/product-grid',
  dtoValidationMiddleware(ProductGridMessageDto) as any,
  (req: any, res: any) => productGridController.sendProductGridMessage(req, res),
);

/**
 * @swagger
 * /api/v1/users/support/products/batch:
 *   get:
 *     summary: Get a batch of products by ids for support chat product grids
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Products returned
 */
router.get('/support/products/batch', (req: any, res: any) => productGridController.getBatchProducts(req, res));

export default router;
