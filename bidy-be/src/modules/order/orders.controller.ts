import { Request, Response } from 'express';
import { OrderService } from './order.service.js';
import { apiResponse } from '../../common/util/api-response.js';
import { ProcessPaymentDto } from './dtos/process-payment.dto.js';
import { CustomRequest } from '../user/user.controller.js';
import { logger } from '../../common/util/logger.js';

export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  getWonAuctions = async (req: CustomRequest, res: Response) => {
    try {
      const result = await this.orderService.getWonAuctions(req.idUser!);
      return res.status(200).json(apiResponse('success', 'Danh sách đơn hàng thắng đấu giá', result));
    } catch (error: any) {
      logger.error('Error getting won auctions', error);
      return res.status(500).json(apiResponse('error', 'Lỗi khi lấy danh sách đơn hàng'));
    }
  };

  getPaymentStatus = async (req: CustomRequest, res: Response) => {
    try {
      const result = await this.orderService.getPaymentStatus(req.idUser!);
      return res.status(200).json(apiResponse('success', 'Trạng thái thanh toán', result));
    } catch (error: any) {
      logger.error('Error getting payment status', error);
      return res.status(500).json(apiResponse('error', 'Lỗi khi lấy trạng thái thanh toán'));
    }
  };

  processPayment = async (req: CustomRequest<ProcessPaymentDto>, res: Response) => {
    try {
      const { orderIds, paymentMethod } = req.body;
      const result = await this.orderService.processPayment(req.idUser!, orderIds, paymentMethod);
      return res.status(200).json(apiResponse('success', 'Đang xử lý thanh toán', result));
    } catch (error: any) {
      logger.error('Error processing payment', error);

      if (error.message === 'INVALID_ORDER_IDS') {
        return res.status(400).json(apiResponse('fail', 'Vui lòng chọn đơn hàng để thanh toán'));
      }
      if (error.message === 'INVALID_OR_ALREADY_PAID_ORDERS') {
        return res.status(400).json(apiResponse('fail', 'Một số đơn hàng không hợp lệ hoặc đã thanh toán'));
      }

      return res.status(500).json(apiResponse('error', 'Lỗi khi xử lý thanh toán'));
    }
  };

  confirmPayment = async (req: CustomRequest, res: Response) => {
    try {
      const paymentId = String(req.params.paymentId);
      const result = await this.orderService.confirmPayment(req.idUser!, paymentId);
      return res.status(200).json(apiResponse('success', 'Thanh toán thành công', result));
    } catch (error: any) {
      logger.error('Error confirming payment', error);

      if (error.message === 'TRANSACTION_NOT_FOUND') {
        return res.status(404).json(apiResponse('fail', 'Không tìm thấy giao dịch'));
      }

      return res.status(500).json(apiResponse('error', 'Lỗi khi xác nhận thanh toán'));
    }
  };

  getOrderPaymentQr = async (req: CustomRequest, res: Response) => {
    try {
      const orderId = String(req.params.id);
      const result = await this.orderService.getOrderPaymentQr(req.idUser!, orderId);
      return res.status(200).json(apiResponse('success', 'Thông tin mã QR thanh toán', result));
    } catch (error: any) {
      logger.error('Error generating payment QR', error);

      if (error.message === 'ORDER_NOT_FOUND') {
        return res.status(404).json(apiResponse('fail', 'Không tìm thấy đơn hàng'));
      }
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json(apiResponse('fail', 'Bạn không có quyền thanh toán đơn hàng này'));
      }
      if (error.message === 'ORDER_ALREADY_PAID') {
        return res.status(400).json(apiResponse('fail', 'Đơn hàng này đã được thanh toán'));
      }

      return res.status(500).json(apiResponse('error', 'Lỗi khi tạo mã QR thanh toán'));
    }
  };

  getOrderStatus = async (req: CustomRequest, res: Response) => {
    try {
      const orderId = String(req.params.id);
      const result = await this.orderService.getOrderStatus(req.idUser!, orderId);
      return res.status(200).json(apiResponse('success', 'Trạng thái đơn hàng', result));
    } catch (error: any) {
      logger.error('Error getting order status', error);

      if (error.message === 'ORDER_NOT_FOUND') {
        return res.status(404).json(apiResponse('fail', 'Không tìm thấy đơn hàng'));
      }
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json(apiResponse('fail', 'Bạn không có quyền xem đơn hàng này'));
      }

      return res.status(500).json(apiResponse('error', 'Lỗi khi lấy trạng thái đơn hàng'));
    }
  };

  handleSepayWebhook = async (req: Request, res: Response) => {
    try {
      const result = await this.orderService.processSepayWebhook(req.body);
      return res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error handling SePay webhook', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  payWithWallet = async (req: CustomRequest, res: Response) => {
    try {
      const orderId = String(req.params.id);
      const userId = req.idUser;
      if (!userId) {
        return res.status(401).json(apiResponse('fail', 'Unauthorized'));
      }
      const result = await this.orderService.payWithWallet(userId, orderId);
      return res.status(200).json(apiResponse('success', 'Thanh toán đơn hàng thành công', result));
    } catch (error: any) {
      logger.error('Error paying order with wallet', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message || 'Lỗi khi thanh toán đơn hàng'));
    }
  };
}
