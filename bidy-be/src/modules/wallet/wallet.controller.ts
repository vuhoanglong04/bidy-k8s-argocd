import { Response } from 'express';
import { WalletService } from './wallet.service.js';
import { AuthRequest } from '../../middlewares/authen.middleware.js';
import { apiResponse } from '../../common/util/api-response.js';

export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  getMyWallet = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.idUser;
      if (!userId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const wallet = await this.walletService.getWalletByUserId(userId);
      return res.status(200).json(
        apiResponse('success', 'Wallet retrieved successfully', wallet),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  topup = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.idUser;
      if (!userId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const { amount } = req.body;
      const amountStr = typeof amount === 'number'
        ? (Number.isFinite(amount) ? amount.toFixed(2) : '')
        : typeof amount === 'string'
        ? amount.trim()
        : '';
      const result = await this.walletService.topup(userId, amountStr);
      return res.status(200).json(
        apiResponse('success', 'Top-up instructions generated successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  createWithdrawal = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.idUser;
      if (!userId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const result = await this.walletService.createWithdrawal(userId, req.body);
      return res.status(201).json(
        apiResponse('success', 'Withdrawal request created successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getMyWithdrawals = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.idUser;
      if (!userId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const { cursor, limit } = req.query;
      const result = await this.walletService.listUserWithdrawals(userId, {
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

  cancelWithdrawal = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.idUser;
      if (!userId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const id = String(req.params.id);
      const result = await this.walletService.cancelWithdrawal(userId, id);
      return res.status(200).json(
        apiResponse('success', 'Withdrawal request cancelled successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getTransactions = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.idUser;
      if (!userId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const { type, from, to, cursor, limit } = req.query;
      const result = await this.walletService.getUserTransactions(userId, {
        type: type as string | undefined,
        from: from as string | undefined,
        to: to as string | undefined,
        cursor: cursor as string | undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return res.status(200).json(
        apiResponse('success', 'Transactions retrieved successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getSummary = async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.idUser;
      if (!userId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }

      const { from, to } = req.query;
      const result = await this.walletService.getUserSummary(userId, {
        from: from as string | undefined,
        to: to as string | undefined,
      });
      return res.status(200).json(
        apiResponse('success', 'Wallet summary retrieved successfully', result),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };
}
