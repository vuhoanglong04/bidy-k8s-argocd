import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { Product } from './entities/product.entity.js';
// import { ProductImage } from './entities/product-image.entity.js';
import { Category } from '../category/category.entity.js';
import { ProductService } from './product.service.js';
import { ProductController } from './product.controller.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { isAuth } from '../../middlewares/authen.middleware.js';
import upload from '../../middlewares/image-upload.middleware.js';
import { CreateProductDto } from './dtos/create-product.dto.js';
import { UpdateProductDto } from './dtos/update-product.dto.js';
import { ProductQueryDto } from './dtos/product-query.dto.js';
import { ReorderImagesDto } from './dtos/product-image.dto.js';

const router = express.Router();

const productRepository = AppDataSource.getRepository(Product);
// const productImageRepository = AppDataSource.getRepository(ProductImage);
const categoryRepository = AppDataSource.getRepository(Category);

const productService = new ProductService(
  productRepository,
  categoryRepository,
  AppDataSource,
);
const productController = new ProductController(productService);

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product management API
 */

// Public endpoints

/**
 * @swagger
 * components:
 *   schemas:
 *     StoredProductImage:
 *       type: object
 *       description: >
 *         One product image. The bucket is private, so `imageUrl` is minted per
 *         response and expires; `fileId` is the durable handle.
 *       properties:
 *         id:
 *           type: string
 *           description: product_images row id, used by the reorder/primary endpoints.
 *           example: "7"
 *         fileId:
 *           type: string
 *           description: >
 *             Id in the files table. Use GET /api/v1/files/:id/url to re-sign
 *             `imageUrl` once it expires, without refetching the product.
 *           example: "12"
 *         imageUrl:
 *           type: string
 *           description: Presigned URL, valid for 1 hour. Render it, do not persist it.
 *         isPrimary:
 *           type: boolean
 *         displayOrder:
 *           type: integer
 */

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: Get public product list
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: condition
 *         schema:
 *           type: string
 *           enum: [new, like_new, used, refurbished]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get('/products', dtoValidationMiddleware(ProductQueryDto, 'query'), productController.getPublicProducts);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product retrieved successfully
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
 *                     the product payload is returned as-is.
 *                   properties:
 *                     images:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StoredProductImage'
 *                     owner:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         username: { type: string }
 *                         avatarFileId:
 *                           type: string
 *                           nullable: true
 *                           description: Id in the files table; null when the owner has no avatar.
 *                         avatarUrl:
 *                           type: string
 *                           nullable: true
 *                           description: Presigned URL, valid for 1 hour.
 *       404:
 *         description: Product not found
 */
router.get('/products/:id', productController.getProductById);


// Protected endpoints.
//
// Scoped to the two path prefixes this router actually owns rather than applied
// router-wide: this router is mounted on the bare /api/v1 prefix, so a router-wide
// guard also ran for every unmatched path under it — a typo like
// /api/v1/api/v1/categories/tree answered 401 instead of falling through to
// notFoundHandler, reading as "this public route needs a token".
// The public GETs above are registered first and still match ahead of this.
router.use('/products', isAuth);
router.use('/me', isAuth);

// Product CRUD

/**
 * @swagger
 * components:
 *   schemas:
 *     CreatedProduct:
 *       type: object
 *       description: >
 *         The stored product row. `id` is a bigint serialised as a string — always
 *         treat it as a string, never parse it into a JS number.
 *       properties:
 *         id:
 *           type: string
 *           example: "18"
 *         name: { type: string }
 *         slug:
 *           type: string
 *           description: Generated server-side as "<slugified-name>-<id>".
 *         categoryId: { type: string }
 *         ownerId: { type: string }
 *         description: { type: string }
 *         condition:
 *           type: string
 *           enum: [new, like_new, used, refurbished]
 *         status:
 *           type: string
 *           enum: [draft]
 *           description: Always `draft` on creation; nothing else can be returned here.
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductDto'
 *     responses:
 *       201:
 *         description: >
 *           Product created as `draft`. It is invisible everywhere until published
 *           via PATCH /api/v1/products/{id}/status, which first requires at least
 *           one image uploaded through POST /api/v1/products/{id}/images.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string, example: Product created successfully }
 *                 data:
 *                   $ref: '#/components/schemas/CreatedProduct'
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error or invalid category
 */
router.post('/products', dtoValidationMiddleware(CreateProductDto, 'body'), productController.createProduct);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   patch:
 *     summary: Update a product
 *     tags: [Products]
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
 *             $ref: '#/components/schemas/UpdateProductDto'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       403:
 *         description: Forbidden (Not owner or admin)
 *       404:
 *         description: Product not found
 */
router.patch('/products/:id', dtoValidationMiddleware(UpdateProductDto, 'body'), productController.updateProduct);

/**
 * @swagger
 * /api/v1/products/{id}/publish:
 *   post:
 *     summary: Publish a draft product
 *     description: >
 *       A product is created as `draft` and is invisible everywhere until published —
 *       public listings filter on `active`. Publishing requires at least one image,
 *       because a listing with no picture is unsellable.
 *
 *       This replaces PATCH /products/{id}/status. Hiding (`inactive`) and archiving
 *       (`archived`) are gone: they duplicated soft delete, which DELETE
 *       /api/v1/products/{id} already does, and having two ways off the market meant
 *       the live-auction rule had to be enforced in two places. Withdraw a product
 *       with DELETE instead.
 *
 *       Publishing an already-published product succeeds without changing anything.
 *     tags: [Products]
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
 *         description: Product published
 *       403:
 *         description: Forbidden (Not owner or admin)
 *       404:
 *         description: Product not found
 *       422:
 *         description: PRODUCT_NEEDS_IMAGE_TO_PUBLISH
 */
router.post('/products/:id/publish', productController.publishProduct);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   delete:
 *     summary: Soft delete a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Product deleted successfully
 *       403:
 *         description: Forbidden (Not owner or admin)
 */
router.delete('/products/:id', productController.deleteProduct);

/**
 * @swagger
 * components:
 *   schemas:
 *     MyProductListItem:
 *       type: object
 *       description: >
 *         A product in the owner's inventory, with enough auction state for the
 *         list to say what can be done with it next. Only the fields specific to
 *         this endpoint are documented; the rest of the product is returned as-is.
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         status:
 *           type: string
 *           enum: [draft, active]
 *         images:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/StoredProductImage'
 *         latestAuction:
 *           type: object
 *           nullable: true
 *           description: >
 *             The most recent auction on this product, or null if it has never been
 *             listed. A re-listed item has several; this is the one to show.
 *           properties:
 *             id: { type: string }
 *             status:
 *               type: string
 *               enum: [pending, happening, ended, cancelled]
 *             startDate: { type: string, format: date-time }
 *             endDate: { type: string, format: date-time }
 *             currentPrice: { type: number }
 *         hasLiveAuction:
 *           type: boolean
 *           description: True while latestAuction is pending or happening.
 *         canCreateAuction:
 *           type: boolean
 *           description: >
 *             Whether POST /api/v1/auctions would accept this product_id right now
 *             (published, has an image, no live auction). Use it to disable the
 *             action instead of letting the seller fill in a form that is refused.
 */

// My products

/**
 * @swagger
 * /api/v1/me/products:
 *   get:
 *     summary: Get products owned by the current user
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User's products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MyProductListItem'
 */
router.get('/me/products', dtoValidationMiddleware(ProductQueryDto, 'query'), productController.getMyProducts);

// Product Images

/**
 * @swagger
 * /api/v1/products/{id}/images:
 *   post:
 *     summary: Upload multiple images for a product
 *     description: >
 *       Takes up to 10 files in a single request under the repeated field `images`;
 *       there is no per-file endpoint. Each file is max 5 MB and must be one of
 *       image/jpeg, image/png, image/webp, image/gif, image/avif.
 *
 *       New images are appended after the existing ones, and the very first image on
 *       a product with none becomes its primary. The response carries the freshly
 *       signed URLs, so a client can render previews without refetching the product.
 *       Archived products are refused.
 *     tags: [Products]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string, example: Product image(s) uploaded successfully }
 *                 data:
 *                   type: array
 *                   description: The rows just created, in the order the files were sent.
 *                   items:
 *                     $ref: '#/components/schemas/StoredProductImage'
 *       400:
 *         description: No files provided, unsupported type, or over 5 MB
 *       403:
 *         description: Forbidden
 */
router.post(
  '/products/:id/images',
  upload.array('images', 10), // Allow max 10 images
  productController.uploadImages,
);

/**
 * @swagger
 * /api/v1/products/{productId}/images/{imageId}:
 *   delete:
 *     summary: Delete a product image
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Image deleted successfully
 *       403:
 *         description: Forbidden
 */
router.delete('/products/:productId/images/:imageId', productController.deleteImage);

/**
 * @swagger
 * /api/v1/products/{productId}/images/{imageId}/primary:
 *   patch:
 *     summary: Set an image as primary for a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Primary image set successfully
 *       403:
 *         description: Forbidden
 */
router.patch('/products/:productId/images/:imageId/primary', productController.setPrimaryImage);

/**
 * @swagger
 * /api/v1/products/{productId}/images/order:
 *   patch:
 *     summary: Reorder product images
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReorderImagesDto'
 *     responses:
 *       200:
 *         description: Images reordered successfully
 *       403:
 *         description: Forbidden
 *       422:
 *         description: Invalid payload or incomplete image list
 */
router.patch(
  '/products/:productId/images/order',
  dtoValidationMiddleware(ReorderImagesDto, 'body'),
  productController.reorderImages,
);

export default router;
