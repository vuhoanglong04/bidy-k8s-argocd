import { Request, Response, NextFunction } from 'express';
import { apiResponse } from '../common/util/api-response';

import { logger } from '../common/util/logger';

/**
 * Error handling middleware - must be last middleware in the chain
 */
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  // Log error for debugging
  logger.error('Error occurred', err, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((error: any) => error.message).join(', ');
  }

  // Malformed JSON body parsing errors
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON payload';
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409; // Conflict
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Custom operational errors
  if (err.isOperational) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Rate limit error
  if (err.type === 'rate_limit_error') {
    statusCode = 429;
    message = 'Too many requests';
  }

  // Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File size too large';
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = 400;
    message = 'Too many files';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field';
  }

  // Send error response
  return res.status(statusCode).json(
    apiResponse(
      'fail',
      message,
      process.env.NODE_ENV === 'development'
        ? {
            stack: err.stack,
            error: err.message,
          }
        : undefined,
    ),
  );
};

/**
 * 404 Not Found middleware
 */
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  const message = `Route ${req.originalUrl} not found`;
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.status(404).json(
    apiResponse('fail', message),
  );
};

/**
 * Async error wrapper - catches async errors and passes to error handler
 */
// Wrap async/sync route handlers so thrown errors always propagate to Express error handler
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      Promise.resolve(fn(req, res, next)).catch(next);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Operational Error class for custom business logic errors
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
