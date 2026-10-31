import express from 'express';
import { getCurrentTime } from './time.controller.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Time
 *   description: Server time synchronisation API
 */

/**
 * @swagger
 * /api/v1/time/current:
 *   get:
 *     summary: Get the current server time (Asia/Ho_Chi_Minh)
 *     tags: [Time]
 *     responses:
 *       200:
 *         description: Server time returned
 */
router.get('/current', getCurrentTime);

export default router;
