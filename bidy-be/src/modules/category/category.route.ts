import express from 'express';
import { AppDataSource } from '../../database/data-source.js';
import { Category } from './category.entity.js';
import { CategoryService } from './category.service.js';
import { CategoryController } from './category.controller.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { CategoryQueryDto } from './dtos/category-query.dto.js';

const router = express.Router();

const categoryRepository = AppDataSource.getRepository(Category);
const categoryService = new CategoryService(categoryRepository);
const categoryController = new CategoryController(categoryService);

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management API
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CategoryWithImage:
 *       type: object
 *       description: >
 *         Image-bearing fields of a category. Reads only ever expose `imageUrl`,
 *         minted per response; the durable `imageFileId` handle is write-only.
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         slug: { type: string }
 *         imageUrl:
 *           type: string
 *           nullable: true
 *           description: >
 *             Presigned URL, valid for 1 hour, or null when the category has no
 *             image. Render it, do not persist it; re-read the category to refresh.
 *         isActive: { type: boolean }
 */

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: Get paginated list of categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: ['name', 'createdAt', 'updatedAt']
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: ['asc', 'desc']
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get(
  '/',
  dtoValidationMiddleware(CategoryQueryDto, 'query'),
  categoryController.getAll,
);

/**
 * @swagger
 * /api/v1/categories/tree:
 *   get:
 *     summary: Get full category tree
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Category tree retrieved successfully
 */
router.get('/tree', categoryController.getTree);

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   get:
 *     summary: Get a single category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   $ref: '#/components/schemas/CategoryWithImage'
 *       404:
 *         description: Category not found
 */
router.get('/:id', categoryController.getById);

/**
 * @swagger
 * /api/v1/categories/{id}/children:
 *   get:
 *     summary: Get direct children of a category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category children retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get('/:id/children', categoryController.getChildren);

export default router;
