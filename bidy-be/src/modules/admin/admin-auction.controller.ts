import { Request, Response } from 'express';
import { AdminAuctionService } from './admin-auction.service.js';
import { AdminAuctionQueryDto } from './dtos/admin-auction.dto.js';
import { apiResponse, paginatedResponse } from '../../common/util/api-response.js';
import { logger } from '../../common/util/logger.js';

export class AdminAuctionController {
  private readonly adminAuctionService = new AdminAuctionService();

  /**
   * Stable, machine-readable reasons a cancel can fail. Clients map these to their own
   * copy, so a code is part of the API: add to this table, never rename an entry.
   */
  private static readonly CANCEL_ERRORS: Record<string, { status: number; message: string }> = {
    AUCTION_NOT_FOUND: { status: 404, message: 'Auction not found' },
    AUCTION_NOT_CANCELLABLE: { status: 409, message: 'Only pending or happening auctions can be cancelled' },
  };

  public getAuctions = async (req: Request, res: Response) => {
    try {
      const query = req.query as unknown as AdminAuctionQueryDto;
      const { items, totalItems, page, limit } = await this.adminAuctionService.findAuctions(query);
      return res
        .status(200)
        .json(paginatedResponse('Auctions retrieved successfully.', items, page, limit, totalItems));
    } catch (error: any) {
      logger.error('Error in admin getAuctions', error);
      return res.status(500).json(apiResponse('error', 'Internal server error'));
    }
  };

  public cancelAuction = async (req: Request, res: Response) => {
    try {
      const data = await this.adminAuctionService.cancelAuction(String(req.params.id));
      return res.status(200).json(apiResponse('success', 'Auction cancelled.', data));
    } catch (error: any) {
      const known = AdminAuctionController.CANCEL_ERRORS[error.message];
      if (known) {
        return res.status(known.status).json(apiResponse('fail', known.message, error.message));
      }

      logger.error('Error in admin cancelAuction', error);
      return res.status(500).json(apiResponse('error', 'Internal server error'));
    }
  };
}
