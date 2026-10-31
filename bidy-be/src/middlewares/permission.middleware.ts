import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../modules/user/enum/user.enum';
import { apiResponse } from '../common/util/api-response';

const rolePermissions: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    'users.read',
    'users.update',
    'users.suspend',
    'users.ban',
    'users.unlock',
    'users.manage_role',
    'users.view_sensitive',
  ],
  [UserRole.USER]: [],
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.role) {
      return res.status(401).json(apiResponse('fail', 'User not authenticated'));
    }

    const permissions = rolePermissions[user.role as UserRole] || [];
    if (!permissions.includes(permission)) {
      return res.status(403).json(apiResponse('fail', `You do not have permission to ${permission}.`));
    }

    next();
  };
};
