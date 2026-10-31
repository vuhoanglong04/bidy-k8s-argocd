import express from 'express';
import { rateLimiters } from '../../middlewares/security.middleware';
import { isAdmin } from '../../middlewares/authen.middleware';
import { dtoValidationMiddleware } from '../../middlewares/dto-validation.middleware';
import { AdminUserController } from './admin-user.controller';
import {
  SearchUserDTO,
  UpdateUserProfileDTO,
  ChangeRoleDTO,
  SuspendUserDTO,
  BanUserDTO,
} from './dtos/admin-user.dto';

const router = express.Router();
const adminUserController = new AdminUserController();

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get list of users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search by username, email, or exact ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: locked
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: created_from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 */
router.get(
  '/',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(SearchUserDTO, 'query'),
  adminUserController.getUsers
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get user details (Admin only)
 *     tags: [Admin]
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
 *         description: User details retrieved
 *       404:
 *         description: User not found
 */
router.get(
  '/:id',
  rateLimiters.general,
  isAdmin,
  adminUserController.getUserDetail
);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   patch:
 *     summary: Update user profile (Admin only)
 *     tags: [Admin]
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
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               fullname:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.patch(
  '/:id',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(UpdateUserProfileDTO, 'body'),
  adminUserController.updateProfile
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/role:
 *   patch:
 *     summary: Change user role (Admin only)
 *     tags: [Admin]
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
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role changed
 */
router.patch(
  '/:id/role',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(ChangeRoleDTO, 'body'),
  adminUserController.changeRole
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/suspend:
 *   post:
 *     summary: Suspend user (Admin only)
 *     tags: [Admin]
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
 *               reason:
 *                 type: string
 *               until:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: User suspended
 */
router.post(
  '/:id/suspend',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(SuspendUserDTO, 'body'),
  adminUserController.suspendUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/activate:
 *   post:
 *     summary: Activate user (Admin only)
 *     tags: [Admin]
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
 *         description: User activated
 */
router.post(
  '/:id/activate',
  rateLimiters.general,
  isAdmin,
  adminUserController.activateUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/ban:
 *   post:
 *     summary: Ban user (Admin only)
 *     tags: [Admin]
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User banned
 */
router.post(
  '/:id/ban',
  rateLimiters.general,
  isAdmin,
  dtoValidationMiddleware(BanUserDTO, 'body'),
  adminUserController.banUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/unlock:
 *   post:
 *     summary: Unlock user account (Admin only)
 *     tags: [Admin]
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
 *         description: User account unlocked
 */
router.post(
  '/:id/unlock',
  rateLimiters.general,
  isAdmin,
  adminUserController.unlockUser
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/revoke-sessions:
 *   post:
 *     summary: Revoke all sessions for a user (Admin only)
 *     tags: [Admin]
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
 *         description: Sessions revoked
 */
router.post(
  '/:id/revoke-sessions',
  rateLimiters.general,
  isAdmin,
  adminUserController.revokeSessions
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/force-password-reset:
 *   post:
 *     summary: Force user to reset password (Admin only)
 *     tags: [Admin]
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
 *         description: Password reset forced
 */
router.post(
  '/:id/force-password-reset',
  rateLimiters.general,
  isAdmin,
  adminUserController.forcePasswordReset
);

/**
 * @swagger
 * /api/v1/admin/users/{id}/audit-logs:
 *   get:
 *     summary: Get audit logs for a user (Admin only)
 *     tags: [Admin]
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
 *         description: Audit logs retrieved
 */
router.get(
  '/:id/audit-logs',
  rateLimiters.general,
  isAdmin,
  adminUserController.getAuditLogs
);

export default router;
