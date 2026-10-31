import { Request, Response, NextFunction } from 'express';
import { AdminUserService } from './admin-user.service';
import { apiResponse } from '../../common/util/api-response';
import { SearchUserDTO, UpdateUserProfileDTO, ChangeRoleDTO, SuspendUserDTO, BanUserDTO } from './dtos/admin-user.dto';

export class AdminUserController {
  private readonly adminUserService: AdminUserService;

  constructor() {
    this.adminUserService = new AdminUserService();
  }

  public getUsers = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const dto = req.query as any as SearchUserDTO;
      const result = await this.adminUserService.getUsers(dto);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public getUserDetail = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await this.adminUserService.getUserDetail(id);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') {
        return res.status(404).json(apiResponse('fail', 'User was not found.'));
      }
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public updateProfile = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const dto = req.body as UpdateUserProfileDTO;
      const adminId = (req as any).idUser;
      const result = await this.adminUserService.updateProfile(adminId, id, dto);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') return res.status(404).json(apiResponse('fail', 'User was not found.'));
      if (err.message === 'EMAIL_ALREADY_EXISTS') return res.status(409).json(apiResponse('fail', 'Email is already used by another account.'));
      if (err.message === 'USERNAME_ALREADY_EXISTS') return res.status(409).json(apiResponse('fail', 'Username is already used by another account.'));
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public changeRole = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const dto = req.body as ChangeRoleDTO;
      const adminId = (req as any).idUser;
      const result = await this.adminUserService.changeRole(adminId, id, dto);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') return res.status(404).json(apiResponse('fail', 'User was not found.'));
      if (err.message === 'CANNOT_DEMOTE_LAST_ADMIN') return res.status(403).json(apiResponse('fail', 'Cannot demote the last active admin.'));
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public suspendUser = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const dto = req.body as SuspendUserDTO;
      const adminId = (req as any).idUser;
      const result = await this.adminUserService.suspendUser(adminId, id, dto);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') return res.status(404).json(apiResponse('fail', 'User was not found.'));
      if (err.message === 'USER_ALREADY_BANNED') return res.status(409).json(apiResponse('fail', 'User is already banned.'));
      if (err.message === 'ADMIN_CANNOT_SUSPEND_SELF') return res.status(403).json(apiResponse('fail', 'Admin cannot suspend themselves.'));
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public activateUser = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).idUser;
      const result = await this.adminUserService.activateUser(adminId, id);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') return res.status(404).json(apiResponse('fail', 'User was not found.'));
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public banUser = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const dto = req.body as BanUserDTO;
      const adminId = (req as any).idUser;
      const result = await this.adminUserService.banUser(adminId, id, dto);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') return res.status(404).json(apiResponse('fail', 'User was not found.'));
      if (err.message === 'ADMIN_CANNOT_BAN_SELF') return res.status(403).json(apiResponse('fail', 'Admin cannot ban themselves.'));
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public unlockUser = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).idUser;
      const result = await this.adminUserService.unlockUser(adminId, id);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') return res.status(404).json(apiResponse('fail', 'User was not found.'));
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public revokeSessions = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).idUser;
      const result = await this.adminUserService.revokeSessions(adminId, id);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') return res.status(404).json(apiResponse('fail', 'User was not found.'));
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public forcePasswordReset = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).idUser;
      const result = await this.adminUserService.forcePasswordReset(adminId, id);
      return res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') return res.status(404).json(apiResponse('fail', 'User was not found.'));
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public getAuditLogs = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await this.adminUserService.getAuditLogs(id);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };
}
