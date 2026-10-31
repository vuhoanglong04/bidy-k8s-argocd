import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { apiResponse } from '../common/util/api-response';


export interface AuthRequest extends Request {
  idUser?: string;
  email?: string;
  role?: string;
}

interface DecodedToken {
  payload: {
    idUser: string;
    email: string;
    role: string;
  };
}

const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
};

export const isAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json(
        apiResponse('fail', 'Authentication required: No token provided', 'TOKEN_MISSING')
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('CRITICAL: JWT_SECRET is not defined in environment variables');
      return res.status(500).json(
        apiResponse('error', 'Internal server error')
      );
    }

    const decoded = jwt.verify(token, secret) as DecodedToken;

    const userData = decoded.payload || (decoded as unknown as DecodedToken['payload']);

    req.idUser = userData.idUser;
    req.email = userData.email;
    req.role = userData.role;

    next();
  } catch (error: any) {
    // The client refreshes only on TOKEN_EXPIRED. Anything else means the token
    // will never become valid, so refreshing would burn the refresh token for
    // nothing — and a rotated-token reuse ends every session on every device.
    const expired = error.name === 'TokenExpiredError';

    return res.status(401).json(
      apiResponse(
        'fail',
        `Authentication failed: ${expired ? 'Token expired' : 'Invalid token'}`,
        expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      )
    );
  }
};

/**
 * Verifies an access token and returns the identity it carries, or null when the
 * token is missing, forged or expired.
 *
 * Shared by the non-rejecting HTTP middleware and the Socket.IO handshake so both
 * transports agree on what a valid token is. `isAuth` keeps its own verify call
 * because it must tell expired apart from invalid for the client's refresh logic.
 */
export const verifyAccessToken = (token: string | null | undefined) => {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;

  try {
    const decoded = jwt.verify(token, secret) as DecodedToken;
    return decoded.payload || (decoded as unknown as DecodedToken['payload']);
  } catch {
    return null;
  }
};

/**
 * Populates the caller's identity when a valid token is present, and does nothing
 * when it is absent or bad — it never rejects.
 *
 * For endpoints serving a mix of public and restricted resources, where whether
 * authentication is required depends on which resource was asked for. The handler
 * decides; this only makes the answer available to it. A handler using this MUST
 * check `req.idUser` itself for anything not public — reaching it is not permission.
 */
export const attachUserIfAuthenticated = (req: AuthRequest, _res: Response, next: NextFunction) => {
  // An expired or forged token leaves the request anonymous rather than failing
  // it: the caller may well be asking for something public.
  const userData = verifyAccessToken(extractToken(req));

  if (userData) {
    req.idUser = userData.idUser;
    req.email = userData.email;
    req.role = userData.role;
  }

  next();
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.role || !allowedRoles.includes(req.role)) {
      return res.status(403).json(
        apiResponse('fail', 'Access denied: Insufficient permissions')
      );
    }
    next();
  };
};

export const requireAdmin = function isAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  return authorizeRoles('admin')(req, res, next);
};

export const isAdmin = [
  isAuth,
  requireAdmin,
];
