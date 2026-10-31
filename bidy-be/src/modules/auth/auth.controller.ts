import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { apiResponse } from '../../common/util/api-response';
import { AuthRequest } from '../../middlewares/authen.middleware.js';
import { logger } from '../../common/util/logger.js';
import { AUTH_MESSAGE } from '../../common/messages/auth/auth.message.js';

/**
 * Stable codes for the ways a refresh can fail, keyed by the message the service
 * throws rather than by a copy of its wording — change the text in AUTH_MESSAGE and
 * this map follows, because both sides read the same constant.
 *
 * The client has to tell "your token aged out, sign in again" apart from "this
 * account is gone, stop retrying", and matching English prose to do it breaks
 * silently the first time the wording is edited or translated.
 */
const REFRESH_ERROR_CODES: Record<string, string> = {
    [AUTH_MESSAGE.ACCOUNT_NOT_AVAILABLE]: 'ACCOUNT_NOT_AVAILABLE',
    [AUTH_MESSAGE.REFRESH_TOKEN_REVOKED_OR_INVALID]: 'REFRESH_TOKEN_INVALID',
    [AUTH_MESSAGE.USER_NOT_FOUND]: 'USER_NOT_FOUND',
};

export class AuthController {
    constructor(private readonly authService: AuthService) { }

    login = async (req: Request, res: Response) => {
        try {
            const result = await this.authService.login(req.body);
            return res.status(200).json(
                apiResponse('success', 'Login successful', result)
            );
        } catch (error: any) {
            return res.status(401).json(
                apiResponse('fail', error.message)
            );
        }
    };

    register = async (req: Request, res: Response) => {
        try {
            const result = await this.authService.register(req.body);
            return res.status(201).json(
                apiResponse('success', result.message)
            );
        } catch (error: any) {
            if (error.message === AUTH_MESSAGE.EMAIL_EXISTS) {
                return res.status(409).json(apiResponse('fail', AUTH_MESSAGE.EMAIL_ALREADY_EXISTS));
            }
            if (error.message === AUTH_MESSAGE.USERNAME_EXISTS) {
                return res.status(409).json(apiResponse('fail', AUTH_MESSAGE.USERNAME_ALREADY_EXISTS));
            }

            // Anything else here is unexpected (DB, SMTP): log it, don't hand the
            // raw driver message to the client.
            logger.error('Error registering user', error);
            return res.status(500).json(
                apiResponse('error', AUTH_MESSAGE.SYSTEM_ERROR)
            );
        }
    };

    refresh = async (req: Request, res: Response) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json(apiResponse('fail', 'Refresh token required'));
            }
            const result = await this.authService.refresh(refreshToken);
            return res.status(200).json(
                apiResponse('success', 'Token refreshed', result)
            );
        } catch (error: any) {
            return res.status(401).json(
                apiResponse('fail', error.message, REFRESH_ERROR_CODES[error.message] ?? 'REFRESH_FAILED')
            );
        }
    };

    logout = async (req: Request, res: Response) => {
        try {
            // Identity comes from the verified access token only. Reading it from the
            // body let anyone end anyone else's session by guessing a sequential id.
            const userId = (req as AuthRequest).idUser;
            const deviceId = req.body.deviceId;
            if (!userId || !deviceId) {
                return res.status(400).json(apiResponse('fail', 'Device ID required'));
            }
            await this.authService.logout(userId, deviceId);
            return res.status(200).json(apiResponse('success', 'Logged out successfully'));
        } catch (error: any) {
            return res.status(400).json(apiResponse('fail', error.message));
        }
    };

    logoutAll = async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthRequest).idUser;
            if (!userId) {
                return res.status(401).json(apiResponse('fail', 'Authentication required'));
            }
            await this.authService.logoutAll(userId);
            return res.status(200).json(apiResponse('success', 'Logged out from all devices'));
        } catch (error: any) {
            return res.status(400).json(apiResponse('fail', error.message));
        }
    };

    forgotPassword = async (req: Request, res: Response) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json(apiResponse('fail', 'Email required'));
            }
            const result = await this.authService.forgotPassword(email);
            return res.status(200).json(apiResponse('success', result.message));
        } catch (error: any) {
            return res.status(400).json(apiResponse('fail', error.message));
        }
    };

    resetPassword = async (req: Request, res: Response) => {
        try {
            const { userId, token, newPassword } = req.body;
            if (!userId || !token || !newPassword) {
                return res.status(400).json(apiResponse('fail', 'Missing parameters'));
            }
            const result = await this.authService.resetPassword(userId, token, newPassword);
            return res.status(200).json(apiResponse('success', result.message));
        } catch (error: any) {
            return res.status(400).json(apiResponse('fail', error.message));
        }
    };

    verifyEmail = async (req: Request, res: Response) => {
        try {
            const { userId, token } = req.query;
            if (!userId || !token) {
                return res.status(400).json(apiResponse('fail', 'Missing parameters'));
            }
            const result = await this.authService.verifyEmail(userId as string, token as string);
            return res.status(200).json(apiResponse('success', result.message));
        } catch (error: any) {
            return res.status(400).json(apiResponse('fail', error.message));
        }
    };

    resendVerify = async (req: Request, res: Response) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json(apiResponse('fail', 'Email required'));
            }
            const result = await this.authService.resendVerify(email);
            return res.status(200).json(apiResponse('success', result.message));
        } catch (error: any) {
            return res.status(400).json(apiResponse('fail', error.message));
        }
    };
}