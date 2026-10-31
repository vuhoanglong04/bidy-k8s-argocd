import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { Category } from './category.entity.js';
import { CategoryService } from './category.service.js';
import { AdminCategoryController } from './admin-category.controller.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { CreateCategoryDto } from './dtos/create-category.dto.js';
import { UpdateCategoryDto } from './dtos/update-category.dto.js';
import { UpdateCategoryStatusDto } from './dtos/update-category-status.dto.js';
import * as authenMiddleware from '../../middlewares/authen.middleware.js';

const router = express.Router();

const categoryRepository = AppDataSource.getRepository(Category);
const categoryService = new CategoryService(categoryRepository);
const adminCategoryController = new AdminCategoryController(categoryService);

/**
 * @swagger
 * tags:
 *   name: Admin Categories
 *   description: Admin category management API
 */

/**
 * @swagger
 * /api/v1/admin/categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Admin Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 nullable: true
 *               imageFileId:
 *                 type: string
 *                 nullable: true
 *                 description: >
 *                   Id returned by POST /api/v1/files (purpose: category). Send null
 *                   to clear the image. The category response carries a presigned
 *                   `imageUrl` derived from it; no URL is ever stored or accepted.
 *                 example: "42"
 *     responses:
 *       201:
 *         description: Category created successfully
 */
router.post(
  '/',
  authenMiddleware.isAdmin,
  dtoValidationMiddleware(CreateCategoryDto, 'body'),
  adminCategoryController.create,
);

/**
 * @swagger
 * /api/v1/admin/categories/{id}:
 *   patch:
 *     summary: Update an existing category
 *     tags: [Admin Categories]
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
 *             properties:
 *               name:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 nullable: true
 *               imageFileId:
 *                 type: string
 *                 nullable: true
 *                 description: >
 *                   Id returned by POST /api/v1/files (purpose: category). Send null
 *                   to clear the image. The category response carries a presigned
 *                   `imageUrl` derived from it; no URL is ever stored or accepted.
 *                 example: "42"
 *     responses:
 *       200:
 *         description: Category updated successfully
 */
router.patch(
  '/:id',
  authenMiddleware.isAdmin,
  dtoValidationMiddleware(UpdateCategoryDto, 'body'),
  adminCategoryController.update,
);

/**
 * @swagger
 * /api/v1/admin/categories/{id}/status:
 *   patch:
 *     summary: Update category status (active/inactive)
 *     tags: [Admin Categories]
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
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Category status updated successfully
 */
router.patch(
  '/:id/status',
  authenMiddleware.isAdmin,
  dtoValidationMiddleware(UpdateCategoryStatusDto, 'body'),
  adminCategoryController.updateStatus,
);

/**
 * @swagger
 * /api/v1/admin/categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Admin Categories]
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
 *         description: Category deleted successfully
 */
router.delete(
  '/:id',
  authenMiddleware.isAdmin,
  adminCategoryController.delete,
);

export default router;
