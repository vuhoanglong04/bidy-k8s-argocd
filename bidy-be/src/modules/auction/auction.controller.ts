import { Response } from 'express';
import { CustomRequest } from '../user/user.controller.js';
import { AuctionService } from './auction.service.js';
import { apiResponse, paginatedResponse } from '../../common/util/api-response.js';
import { ListingAuctionDto } from './dtos/listing-auction.dto.js';
import { AuctionBidDto } from './dtos/auction-bid.dto.js';
import { EnableAutoBidDto } from './dtos/auto-bid.dto.js';
import { AuctionQueryDto } from './dtos/auction-query.dto.js';
import { AuctionSearchDto } from './dtos/auction-search.dto.js';
import { fileService } from '../file/file.provider.js';
import { logger } from '../../common/util/logger.js';
import auctionWebSocketService from './auction-websocket.service.js';

export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  getProductById = async (req: CustomRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const data = await this.auctionService.getProductById(id);
      if (!data) return res.status(404).json(apiResponse('fail', 'Not found', null));
      return res.status(200).json(apiResponse('success', 'Success', data));
    } catch (error: any) {
      logger.error('Error in getProductById', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  listingAuction = async (req: CustomRequest<ListingAuctionDto>, res: Response) => {
    try {
      const files: Express.Multer.File[] = (req.files as Express.Multer.File[]) || [];
      const productId = (req.body as any).product_id;

      // Rejected before uploading rather than after: an existing product owns its
      // own images through /products/:id/images, and quietly dropping files the
      // seller attached here would leave them wondering where the photos went.
      if (productId && files.length > 0) {
        return res.status(400).json(apiResponse(
          'fail',
          'Images cannot be attached here when product_id is given; manage them via /api/v1/products/:productId/images',
          null,
        ));
      }

      // Registered as `files` rows up front; the service attaches them by id.
      // A failed upload used to be swallowed per file and the listing created
      // anyway, silently missing images the seller believed they had sent.
      const uploaded = await fileService.createManyFromUpload(files, 'auctions', req.idUser!);

      const productData = { ...req.body, images: uploaded.map((file) => file.id) };

      const createdAuction = await this.auctionService.listingAuction(productData, req.idUser!, req.role!);
      return res.status(201).json(apiResponse('success', 'Created successfully', createdAuction));
    } catch (error: any) {
      logger.error('Error in listingAuction', error);
      return res.status(500).json(apiResponse('fail', `Server error: ${error.message}`, null));
    }
  };

  auctionBid = async (req: CustomRequest<AuctionBidDto>, res: Response) => {
    try {
      const id = String(req.params.id);
      const { amount, isAuto, limitBid } = req.body;

      const result = await this.auctionService.auctionBid(id, req.idUser!, Number(amount), { isAuto, limitBid });

      // Announced only once the transaction above has committed. Emitting inside it
      // would let a rolled-back bid reach clients as a real one, and they have no
      // way to take it back.
      const winning = result.autoBid ?? result.bid;
      await auctionWebSocketService.broadcastBidderUpdate(id, {
        userId: String(winning.userId),
        amount: Number(winning.amount),
        at: winning.createdAt,
        isAuto: winning.actionType === 'auto_bid',
      });

      return res.status(200).json(apiResponse('success', 'Bid placed', result));
    } catch (error: any) {
      logger.error('Error in auctionBid', error);
      return res.status(400).json(apiResponse('fail', error.message, null));
    }
  };

  enableAutoBid = async (req: CustomRequest<EnableAutoBidDto>, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = await this.auctionService.enableAutoBid(id, req.idUser!, Number(req.body.limitBid));

      const winning = result.autoBid ?? result.bid;
      await auctionWebSocketService.broadcastBidderUpdate(id, {
        userId: String(winning.userId),
        amount: Number(winning.amount),
        at: winning.createdAt,
        isAuto: winning.actionType === 'auto_bid',
      });

      return res.status(200).json(apiResponse('success', 'Auto-bid enabled', result));
    } catch (error: any) {
      logger.error('Error in enableAutoBid', error);
      return res.status(400).json(apiResponse('fail', error.message, null));
    }
  };

  getAutoBid = async (req: CustomRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = await this.auctionService.getAutoBid(id, req.idUser!);
      return res.status(200).json(apiResponse('success', 'Success', result));
    } catch (error: any) {
      logger.error('Error in getAutoBid', error);
      return res.status(400).json(apiResponse('fail', error.message, null));
    }
  };

  disableAutoBid = async (req: CustomRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = await this.auctionService.disableAutoBid(id, req.idUser!);
      return res.status(200).json(apiResponse('success', 'Auto-bid disabled', result));
    } catch (error: any) {
      logger.error('Error in disableAutoBid', error);
      return res.status(400).json(apiResponse('fail', error.message, null));
    }
  };

  /**
   * Stable, machine-readable reasons a buy-now can fail. Clients map these to their own
   * copy, so a code is part of the API: add to this table, never rename an entry.
   */
  private static readonly BUY_NOW_ERRORS: Record<string, { status: number; message: string }> = {
    AUCTION_NOT_FOUND: { status: 404, message: 'Auction not found' },
    BUY_NOW_NOT_AVAILABLE: { status: 400, message: 'This auction has no buy now price' },
    AUCTION_NOT_ACTIVE: { status: 400, message: 'Auction is not active' },
    SELLER_CANNOT_BUY: { status: 400, message: 'Seller cannot buy their own auction' },
    BUY_NOW_PRICE_EXCEEDED: { status: 409, message: 'Bidding has passed the buy now price' },
    MISSING_SHIPPING_ADDRESS: { status: 400, message: 'A default shipping address is required' },
  };

  buyNow = async (req: CustomRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = await this.auctionService.buyNow(id, req.idUser!);
      return res.status(200).json(apiResponse('success', 'Buy now successful', result));
    } catch (error: any) {
      const known = AuctionController.BUY_NOW_ERRORS[error.message];
      if (known) {
        return res.status(known.status).json(apiResponse('fail', known.message, error.message));
      }

      // Anything unmapped is a fault on our side, not a rejection of the request —
      // reporting it as 400 once hid a broken query as a client error.
      logger.error('Error in buyNow', error);
      return res.status(500).json(apiResponse('error', 'Internal server error'));
    }
  };

  /**
   * Stable, machine-readable reasons a seller's cancel can fail. Clients map these to
   * their own copy, so a code is part of the API: add to this table, never rename one.
   */
  private static readonly CANCEL_ERRORS: Record<string, { status: number; message: string }> = {
    AUCTION_NOT_FOUND: { status: 404, message: 'Auction not found' },
    AUCTION_NOT_CANCELLABLE: { status: 409, message: 'Only pending or happening auctions can be cancelled' },
    AUCTION_HAS_BIDS: { status: 409, message: 'An auction that has bids cannot be cancelled' },
  };

  cancelMyAuction = async (req: CustomRequest, res: Response) => {
    try {
      const result = await this.auctionService.cancelMyAuction(String(req.params.id), req.idUser!);
      return res.status(200).json(apiResponse('success', 'Auction cancelled', result));
    } catch (error: any) {
      const known = AuctionController.CANCEL_ERRORS[error.message];
      if (known) {
        return res.status(known.status).json(apiResponse('fail', known.message, error.message));
      }

      logger.error('Error in cancelMyAuction', error);
      return res.status(500).json(apiResponse('error', 'Internal server error'));
    }
  };

  getProductByCategory = async (req: CustomRequest, res: Response) => {
    try {
      const category = String(req.params.category);
      const { page = 1, limit = 15, ...query } = (res.locals.validatedQuery ?? {}) as AuctionQueryDto;
      const { items, total } = await this.auctionService.getProductByCategory(category, query, page, limit);
      return res.status(200).json(paginatedResponse('Success', items, page, limit, total));
    } catch (error: any) {
      logger.error('Error in getProductByCategory', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  getMyAuction = async (req: CustomRequest, res: Response) => {
    try {
      const pageNumber = Number(req.query.pageNumber) || 1;
      const limitNumber = Number(req.query.limitNumber) || 15;
      const data = await this.auctionService.getMyAuction(req.idUser!, pageNumber, limitNumber);
      return res.status(200).json(apiResponse('success', 'Success', data));
    } catch (error: any) {
      logger.error('Error in getMyAuction', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  // --- Restored Legacy Endpoints ---

  deleteMyAuction = async (req: CustomRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = await this.auctionService.deleteMyAuction(id, req.idUser!);
      if (!result) return res.status(400).json(apiResponse('fail', 'Not found or cannot delete', null));
      return res.status(200).json(apiResponse('success', 'Deleted successfully', result));
    } catch (error: any) {
      logger.error('Error in deleteMyAuction', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  updateProduct = async (req: CustomRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = await this.auctionService.updateProduct(id, req.body, req.idUser!);
      if (!result) return res.status(400).json(apiResponse('fail', 'Not found or cannot update', null));
      return res.status(200).json(apiResponse('success', 'Updated successfully', result));
    } catch (error: any) {
      logger.error('Error in updateProduct', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  viewCart = async (req: CustomRequest, res: Response) => {
    try {
      const data = await this.auctionService.viewCart(req.idUser!);
      return res.status(200).json(apiResponse('success', 'Success', data));
    } catch (error: any) {
      logger.error('Error in viewCart', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  getBidders = async (req: CustomRequest, res: Response) => {
    try {
      const auctionId = String(req.params.auctionId);
      const data = await this.auctionService.getBidders(auctionId);
      return res.status(200).json(apiResponse('success', 'Success', data));
    } catch (error: any) {
      logger.error('Error in getBidders', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  getAuctions = async (_req: CustomRequest, res: Response) => {
    try {
      // dtoValidationMiddleware parks the validated query on res.locals rather than
      // req.query, which Express 5 exposes as a getter-only property.
      const { page = 1, limit = 15, ...query } = (res.locals.validatedQuery ?? {}) as AuctionQueryDto;
      const { items, total } = await this.auctionService.getAuctions(query, page, limit);
      return res.status(200).json(paginatedResponse('Success', items, page, limit, total));
    } catch (error: any) {
      logger.error('Error in getAuctions', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  getProductBySearch = async (req: CustomRequest, res: Response) => {
    try {
      const keyword = String(req.params.keyword);
      const { limit = 10, status } = (res.locals.validatedQuery ?? {}) as AuctionSearchDto;
      const data = await this.auctionService.getProductBySearch(keyword, status, limit);
      return res.status(200).json(apiResponse('success', 'Success', data));
    } catch (error: any) {
      logger.error('Error in getProductBySearch', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  getAuctionUserBought = async (req: CustomRequest, res: Response) => {
    try {
      const userId = req.params.id ? String(req.params.id) : req.idUser!;
      const pageNumber = Number(req.query.pageNumber) || 1;
      const limitNumber = Number(req.query.limitNumber) || 15;
      const data = await this.auctionService.getAuctionUserBought(userId, pageNumber, limitNumber);
      return res.status(200).json(apiResponse('success', 'Success', data));
    } catch (error: any) {
      logger.error('Error in getAuctionUserBought', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  getAuctionUserSold = async (req: CustomRequest, res: Response) => {
    try {
      const userId = req.params.id ? String(req.params.id) : req.idUser!;
      const pageNumber = Number(req.query.pageNumber) || 1;
      const limitNumber = Number(req.query.limitNumber) || 15;
      const data = await this.auctionService.getAuctionUserSold(userId, pageNumber, limitNumber);
      return res.status(200).json(apiResponse('success', 'Success', data));
    } catch (error: any) {
      logger.error('Error in getAuctionUserSold', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };

  getUserAuctionByStatus = async (req: CustomRequest, res: Response) => {
    try {
      const userId = req.params.id ? String(req.params.id) : req.idUser!;
      const status = String(req.params.status);
      const pageNumber = Number(req.query.pageNumber) || 1;
      const limitNumber = Number(req.query.limitNumber) || 15;
      const data = await this.auctionService.getUserAuctionByStatus(userId, status, pageNumber, limitNumber);
      return res.status(200).json(apiResponse('success', 'Success', data));
    } catch (error: any) {
      logger.error('Error in getUserAuctionByStatus', error);
      return res.status(500).json(apiResponse('fail', 'Server error', null));
    }
  };
}
