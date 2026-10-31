import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { sepayConfig } from '../config/sepay.config.js';
import { logger } from '../common/util/logger.js';

/**
 * Middleware to verify webhook requests from SePay.
 * Supports both HMAC-SHA256 signature verification and API Key authentication.
 */
export const verifySepayWebhook = (req: Request, res: Response, next: NextFunction) => {
  const { webhookSecret, apiKey } = sepayConfig;

  // If neither is configured, allow in development but log a warning
  if (!webhookSecret && !apiKey) {
    logger.warn('[SePay Webhook] No secret or API key configured. Allowing unverified request.');
    return next();
  }

  // 1. Verify HMAC-SHA256 signature if webhookSecret is configured
  if (webhookSecret) {
    const signature = req.headers['x-sepay-signature'] as string;
    const timestamp = req.headers['x-sepay-timestamp'] as string;

    if (!signature || !timestamp) {
      return res.status(401).json({ success: false, message: 'Missing SePay signature or timestamp headers' });
    }

    const tsNumber = parseInt(timestamp, 10);
    // Reject replay attacks outside 5-minute window (300 seconds)
    if (isNaN(tsNumber) || Math.abs(Math.floor(Date.now() / 1000) - tsNumber) > 300) {
      return res.status(401).json({ success: false, message: 'Request timestamp expired' });
    }

    const rawBody = (req as any).rawBody
      ? (req as any).rawBody.toString('utf8')
      : JSON.stringify(req.body);

    const expected = 'sha256=' + crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      logger.warn('[SePay Webhook] Invalid HMAC signature received');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    return next();
  }

  // 2. Verify API Key if apiKey is configured
  if (apiKey) {
    const authHeader = req.headers['authorization'] as string;
    const expectedAuth = `Apikey ${apiKey}`;

    if (!authHeader || authHeader !== expectedAuth) {
      logger.warn('[SePay Webhook] Invalid API Key received');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    return next();
  }

  next();
};
