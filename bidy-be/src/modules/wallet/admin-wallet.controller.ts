import { Response } from 'express';
import { WalletService } from './wallet.service.js';
import { AuthRequest } from '../../middlewares/authen.middleware.js';
import { apiResponse } from '../../common/util/api-response.js';

export class AdminWalletController {
  constructor(private readonly walletService: WalletService) {}

  adjustment = async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.idUser;
      if (!adminId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const result = await this.walletService.adjustBalance(adminId, req.body);
      return res.status(200).json(
        apiResponse('success', 'Adjustment recorded successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  processWithdrawal = async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.idUser;
      if (!adminId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const id = String(req.params.id);
      const result = await this.walletService.processWithdrawal(adminId, id);
      return res.status(200).json(
        apiResponse('success', 'Withdrawal request moved to processing', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  completeWithdrawal = async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.idUser;
      if (!adminId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const id = String(req.params.id);
      const result = await this.walletService.completeWithdrawal(adminId, id, req.body);
      return res.status(200).json(
        apiResponse('success', 'Withdrawal completed successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  rejectWithdrawal = async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.idUser;
      if (!adminId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const id = String(req.params.id);
      const result = await this.walletService.rejectWithdrawal(adminId, id, req.body);
      return res.status(200).json(
        apiResponse('success', 'Withdrawal rejected successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  listWithdrawals = async (req: AuthRequest, res: Response) => {
    try {
      const { status, overdue, cursor, limit } = req.query;
      const result = await this.walletService.listAdminWithdrawals({
        status: status as any,
        overdue: overdue as any,
        cursor: cursor as string | undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return res.status(200).json(
        apiResponse('success', 'Withdrawals retrieved successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getOverview = async (req: AuthRequest, res: Response) => {
    try {
      const { from, to, limit } = req.query;
      const result = await this.walletService.getAdminOverview({
        from: from as string | undefined,
        to: to as string | undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return res.status(200).json(
        apiResponse('success', 'Wallet overview retrieved successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getEscrow = async (req: AuthRequest, res: Response) => {
    try {
      const { cursor, limit } = req.query;
      const result = await this.walletService.getAdminEscrow({
        cursor: cursor as string | undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return res.status(200).json(
        apiResponse('success', 'Escrow report retrieved successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };
}
