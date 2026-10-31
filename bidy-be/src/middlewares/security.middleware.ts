import { rateLimit } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { apiResponse } from '../common/util/api-response';
import redisClient from '../common/redis/redis.client';
import { logger } from '../common/util/logger';

const MINUTE = 60 * 1000;

// Security Headers Middleware
//
// No TLS on this deployment yet — helmet's defaults (HSTS, and CSP's
// upgrade-insecure-requests) both tell the browser to rewrite every request
// to https://, which then hits a closed port 443 and fails outright, e.g.
// swagger-ui's own CSS/JS never loading. Disable both until TLS exists;
// helmet's other defaults (CSP script/style sources, X-Frame-Options, etc.)
// stay on.
export const securityHeaders = helmet({
  hsts: false,
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'upgrade-insecure-requests': null,
    },
  },
});

// Factory for Rate Limit Handlers
const createRateLimitHandler = (message: string) => {
  return (_req: Request, res: Response) => {
    return res.status(429).json(apiResponse('fail', message));
  };
};

/**
 * Rate limiting middleware configurations
 */
export const rateLimiters = {
  general: rateLimit({
    windowMs: 15 * MINUTE,
    // Counted per IP, so a shared dev network puts everyone in one bucket and a
    // couple of machines exhaust the production budget between them. Raised for
    // development the same way `auth` below is, rather than commented out — a
    // disabled limiter reads as working and would ship that way.
    limit: process.env.NODE_ENV === 'development' ? 5000 : 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: createRateLimitHandler('Too many requests, please try again later'),
    skip: (req: Request) => req.headers.upgrade === 'websocket',
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redisClient.call as any)(...args),
      prefix: 'rl:general:',
    }),
  }),

  auth: rateLimit({
    windowMs: process.env.NODE_ENV === 'development' ? 5 * MINUTE : 15 * MINUTE,
    limit: process.env.NODE_ENV === 'development' ? 100 : 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: createRateLimitHandler('Too many authentication attempts, please try again later'),
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redisClient.call as any)(...args),
      prefix: 'rl:auth:',
    }),
  }),

  passwordReset: rateLimit({
    windowMs: 60 * MINUTE,
    limit: 20, // IP-level protection for password reset
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: createRateLimitHandler('Too many password reset attempts, please try again later'),
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redisClient.call as any)(...args),
      prefix: 'rl:password-reset:',
    }),
  }),

  supportChat: rateLimit({
    windowMs: 5 * MINUTE,
    limit: 200,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: createRateLimitHandler('Too many support chat requests, please slow down'),
    skip: (req: Request) => req.headers.upgrade === 'websocket',
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redisClient.call as any)(...args),
      prefix: 'rl:support:',
    }),
  }),

  walletTopup: rateLimit({
    windowMs: 15 * MINUTE,
    limit: process.env.NODE_ENV === 'development' ? 500 : 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: createRateLimitHandler('Too many top-up requests, please try again later'),
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redisClient.call as any)(...args),
      prefix: 'rl:wallet-topup:',
    }),
  }),

  walletWithdrawal: rateLimit({
    windowMs: 15 * MINUTE,
    limit: process.env.NODE_ENV === 'development' ? 500 : 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: createRateLimitHandler('Too many withdrawal requests, please try again later'),
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redisClient.call as any)(...args),
      prefix: 'rl:wallet-withdrawal:',
    }),
  }),
};

/**
 * Request logging middleware for security monitoring
 */
export const securityLogger = (req: Request, _res: Response, next: NextFunction) => {
  // Do not log sensitive headers/data
  const ip = req.ip || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip,
    userAgent,
  });

  next();
};
