import { Request, Response } from 'express';
import { SellerService, SELLER_PUBLIC_STATUSES } from './seller.service.js';
import { AuctionService } from '../auction/auction.service.js';
import { SellerAuctionQueryDto } from './dtos/seller-auction-query.dto.js';
import { AuctionStatus } from '../auction/enum/auction-status.enum.js';
import { apiResponse, paginatedResponse } from '../../common/util/api-response.js';
import { logger } from '../../common/util/logger.js';

export class SellerController {
  constructor(
    private readonly sellerService: SellerService,
    private readonly auctionService: AuctionService,
  ) {}

  getProfile = async (req: Request, res: Response) => {
    try {
      const data = await this.sellerService.getPublicProfile(String(req.params.sellerId));
      return res.status(200).json(apiResponse('success', 'Seller profile retrieved successfully.', data));
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message, 'SELLER_NOT_FOUND'));
      }
      logger.error('Error in getSellerProfile', error);
      return res.status(500).json(apiResponse('error', 'Internal server error'));
    }
  };

  getAuctions = async (req: Request, res: Response) => {
    try {
      const sellerId = String(req.params.sellerId);
      // A storefront for a seller who does not exist is a 404, not an empty list —
      // an empty page would read as "this seller has nothing", which is a different
      // thing to the visitor.
      await this.sellerService.assertSellerExists(sellerId);

      const query = req.query as unknown as SellerAuctionQueryDto;
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      const { items, total } = await this.auctionService.getAuctions(
        {
          status: query.status,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          sellerId,
          excludeStatuses: [AuctionStatus.CANCELLED],
        },
        page,
        limit,
      );

      return res
        .status(200)
        .json(paginatedResponse('Seller auctions retrieved successfully.', items, page, limit, total));
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message, 'SELLER_NOT_FOUND'));
      }
      logger.error('Error in getSellerAuctions', error);
      return res.status(500).json(apiResponse('error', 'Internal server error'));
    }
  };
}

export { SELLER_PUBLIC_STATUSES };
