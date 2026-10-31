import { Response } from 'express';
import { CustomRequest } from '../user/user.controller.js';
import bidHistoryService from './bid-history.service.js';
import { BidHistoryQueryDto } from './dtos/bid-history-query.dto.js';
import { logger } from '../../common/util/logger.js';

/**
 * Get user's bid history with statistics
 */
export const getUserBidHistory = async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.idUser!;
    const query = req.query as unknown as BidHistoryQueryDto;

    const { history, stats, totalItems, page, limit } =
      await bidHistoryService.getUserHistoryWithStats(userId, query);

    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      status: 'success',
      message: 'Bid history retrieved successfully',
      // `stats` stays alongside `history` rather than inside the page: it describes
      // the whole history, so burying it in pagination metadata would misread.
      data: {
        history,
        stats,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching user bid history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch bid history',
      error: error.message,
    });
  }
};

/**
 * Get auction's bid history
 */
export const getAuctionBidHistory = async (req: CustomRequest, res: Response) => {
  try {
    const { auctionId } = req.params;

    const history = await bidHistoryService.getAuctionHistory(auctionId);

    return res.status(200).json({
      status: 'success',
      message: 'Auction bid history retrieved successfully',
      data: {
        history,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching auction bid history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch auction bid history',
      error: error.message,
    });
  }
};