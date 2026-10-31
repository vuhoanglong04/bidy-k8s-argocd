import express from 'express';
import { FileController } from './file.controller.js';
import { fileService } from './file.provider.js';
import { isAuth, attachUserIfAuthenticated } from '../../middlewares/authen.middleware.js';
import upload from '../../middlewares/image-upload.middleware.js';

const router = express.Router();

const fileController = new FileController(fileService);

/**
 * @swagger
 * tags:
 *   name: Files
 *   description: Object-storage uploads. Files are stored privately in R2 and read
 *     back through short-lived presigned URLs; no permanent public URL exists.
 */

/**
 * @swagger
 * /api/v1/files:
 *   post:
 *     summary: Upload a file and register it
 *     description: >
 *       Returns the file id to attach to a product, auction, category, review or
 *       withdrawal proof, plus an already-presigned URL for previewing it. Avatars are not uploaded
 *       here — POST /api/v1/users/avatar uploads and attaches in one step.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               purpose:
 *                 type: string
 *                 enum: [product, auction, category, review, withdrawal_proof]
 *                 default: product
 *                 description: Decides the folder prefix inside the bucket.
 *     responses:
 *       201:
 *         description: File uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "12" }
 *                     url: { type: string, description: Presigned URL }
 *                     originalName: { type: string }
 *                     mimeType: { type: string, example: image/png }
 *                     sizeBytes: { type: integer }
 *                     expiresIn: { type: integer, example: 3600 }
 *       400:
 *         description: No file provided, unsupported type, or invalid purpose
 *       401:
 *         description: Unauthenticated
 */
router.post('/', isAuth as any, upload.single('file'), fileController.upload);

/**
 * @swagger
 * /api/v1/files/{id}/url:
 *   get:
 *     summary: Mint a fresh presigned URL for a stored file
 *     description: >
 *       Authentication is optional but conditional. Product images are readable
 *       anonymously, because they render on public product, auction and category
 *       pages and an expired URL would otherwise be unrecoverable for a logged-out
 *       visitor. Files referenced as withdrawal proofs can only be signed for the
 *       withdrawal request owner or an admin. Every other stored file — avatars,
 *       review media — requires a Bearer token, and is reported as 404 to an
 *       unauthorized or anonymous caller so that a file id never reveals whether it exists.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Presigned URL returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     url: { type: string }
 *                     expiresIn: { type: integer, example: 3600 }
 *       404:
 *         description: File not found, not public for anonymous caller, or caller lacks permission
 */
router.get('/:id/url', attachUserIfAuthenticated as any, fileController.getUrl);

export default router;
