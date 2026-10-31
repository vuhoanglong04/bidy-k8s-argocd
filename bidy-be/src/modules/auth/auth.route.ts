import { rateLimiters } from "../../middlewares/security.middleware";
import express from 'express';
import { AuthController } from './auth.controller';

const router = express.Router();

import { AppDataSource } from '../../database/data-source.js';
import { User } from '../user/entity/user.entity.js';
import { BcryptService } from './bcrypt.service.js';
import { AuthService } from './auth.service.js';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware.js';
import { RegisterDto } from './dtos/auth.dto.js';
import { isAuth } from '../../middlewares/authen.middleware.js';

const userRepository = AppDataSource.getRepository(User);
const bcryptService = new BcryptService();
const authService = new AuthService(userRepository, bcryptService);
const authController = new AuthController(authService);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email or username
 *               password:
 *                 type: string
 *               deviceId:
 *                 type: string
 *                 description: Optional device identifier
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized / Invalid credentials
 */
router.post('/login',
    rateLimiters.auth,
    
    authController.login
);

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - userName
 *               - password
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *               userName:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Invalid input
 */
router.post('/register',
    rateLimiters.general,
    dtoValidationMiddleware(RegisterDto),
    authController.register
);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: >
 *           Token refreshed successfully. The refresh token is rotated, so the
 *           returned `refreshToken` replaces the one that was sent.
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
 *                   example: Token refreshed
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: New access token
 *                     refreshToken:
 *                       type: string
 *                       description: New refresh token, replacing the one sent
 *       400:
 *         description: Invalid input
 *       401:
 *         description: >
 *           Invalid or revoked refresh token. A token rotated away more than
 *           JWT_REFRESH_GRACE_SECONDS ago counts as replay and ends every session
 *           for that user, so clients must not retry this call.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: fail }
 *                 message: { type: string, example: Account is not available }
 *                 error_code:
 *                   type: string
 *                   description: >
 *                     Branch on this, never on `message`, which is prose and may be
 *                     reworded or translated. ACCOUNT_NOT_AVAILABLE means the account
 *                     was suspended or banned and will not become valid again by
 *                     retrying — send the user to the account-locked screen rather
 *                     than the login form.
 *                   enum:
 *                     - ACCOUNT_NOT_AVAILABLE
 *                     - REFRESH_TOKEN_INVALID
 *                     - USER_NOT_FOUND
 *                     - REFRESH_FAILED
 *                   example: ACCOUNT_NOT_AVAILABLE
 */
router.post('/refresh',
    rateLimiters.auth,
    
    authController.refresh
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout from current device
 *     description: >
 *       The user is taken from the access token; `userId` in the body is ignored.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *             properties:
 *               deviceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Missing or invalid access token
 */
router.post('/logout',
    isAuth as any,
    authController.logout
);

/**
 * @swagger
 * /api/v1/auth/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     description: >
 *       The user is taken from the access token; no request body is required.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices
 *       401:
 *         description: Missing or invalid access token
 */
router.post('/logout-all',
    isAuth as any,
    authController.logoutAll
);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset password email sent (if exists)
 *       400:
 *         description: Invalid input
 */
router.post('/forgot-password',
    rateLimiters.passwordReset,
    
    authController.forgotPassword
);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - token
 *               - newPassword
 *             properties:
 *               userId:
 *                 type: string
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password',
    rateLimiters.auth,
    
    authController.resetPassword
);

/**
 * @swagger
 * /api/v1/auth/verify:
 *   get:
 *     summary: Verify email address
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get('/verify',
    
    authController.verifyEmail
);

/**
 * @swagger
 * /api/v1/auth/resend-verify:
 *   post:
 *     summary: Resend verification email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification email resent
 *       400:
 *         description: Account already verified or not found
 */
router.post('/resend-verify',
    rateLimiters.auth,
    
    authController.resendVerify
);

export default router;
