import { Response } from 'express';
import { OrderService } from './order.service.js';
import { AuthRequest } from '../../middlewares/authen.middleware.js';
import { apiResponse } from '../../common/util/api-response.js';
import { logger } from '../../common/util/logger.js';

export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  release = async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.idUser;
      if (!adminId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }
      const orderId = String(req.params.id);
      const result = await this.orderService.releaseEscrow(adminId, orderId);
      return res.status(200).json(apiResponse('success', 'Order escrow released successfully', result));
    } catch (error: any) {
      logger.error('Error releasing order escrow', error);
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message || 'Error releasing order escrow'));
    }
  };

  refund = async (req: AuthRequest, res: Response) => {
    try {
      const adminId = req.idUser;
      if (!adminId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }
      const orderId = String(req.params.id);
      const result = await this.orderService.refundOrder(adminId, orderId);
      return res.status(200).json(apiResponse('success', 'Order refunded successfully', result));
    } catch (error: any) {
      logger.error('Error refunding order', error);
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message || 'Error refunding order'));
    }
  };
}
