import { Response } from 'express';
import { Request } from 'express';
import { AuctionRequestService } from './auction-request.service.js';
import { CustomRequest } from '../user/user.controller.js';
import {
  AuctionRequestQueryDto,
  CreateAuctionRequestDto,
  RejectAuctionRequestDto,
  UpdateAuctionRequestDto,
} from './dtos/auction-request.dto.js';
import { apiResponse, paginatedResponse } from '../../common/util/api-response.js';
import { notificationService } from '../notification/notification.service.js';
import { logger } from '../../common/util/logger.js';

export class AuctionRequestController {
  constructor(private readonly service: AuctionRequestService) {}

  /**
   * Stable, machine-readable failure reasons. Clients map these to their own copy,
   * so a code is part of the API: add to this table, never rename an entry. The
   * product-side codes are re-thrown by ProductService and land here unchanged,
   * because a seller filing a request needs the same explanation they would get
   * from the product routes.
   */
  private static readonly ERRORS: Record<string, { status: number; message: string }> = {
    REQUEST_NOT_FOUND: { status: 404, message: 'Auction request not found' },
    REQUEST_NOT_PENDING: { status: 409, message: 'Only a pending request can be changed' },
    REQUEST_ALREADY_PENDING: { status: 409, message: 'This product already has a pending request' },
    REQUEST_SCHEDULE_EXPIRED: { status: 409, message: 'The requested schedule has already passed' },
    INVALID_DATE_RANGE: { status: 400, message: 'endDate must be after startDate' },
  };

  private static fail(res: Response, error: any) {
    const known = AuctionRequestController.ERRORS[error.message];
    if (known) {
      return res.status(known.status).json(apiResponse('fail', known.message, error.message));
    }

    // ProductService throws AppError for the product rules (not published, no image,
    // already on the block, not yours) — those carry their own status and message.
    if (error.statusCode) {
      return res.status(error.statusCode).json(apiResponse('fail', error.message, error.errorCode));
    }

    logger.error('Error in auction request', error);
    return res.status(500).json(apiResponse('error', 'Internal server error'));
  }

  create = async (req: CustomRequest<CreateAuctionRequestDto>, res: Response) => {
    try {
      const request = await this.service.create(req.idUser!, req.role!, req.body);
      return res.status(201).json(apiResponse('success', 'Auction request submitted', request));
    } catch (error: any) {
      return AuctionRequestController.fail(res, error);
    }
  };

  findMine = async (req: CustomRequest, res: Response) => {
    try {
      const query = req.query as unknown as AuctionRequestQueryDto;
      const { items, totalItems, page, limit } = await this.service.findMine(req.idUser!, query);
      return res
        .status(200)
        .json(paginatedResponse('Auction requests retrieved', items, page, limit, totalItems));
    } catch (error: any) {
      return AuctionRequestController.fail(res, error);
    }
  };

  findOne = async (req: CustomRequest, res: Response) => {
    try {
      // Admins read any request; a seller only their own, and someone else's reads
      // as not-found rather than forbidden.
      const requesterId = req.role === 'admin' ? undefined : req.idUser!;
      const request = await this.service.getOne(String(req.params.id), requesterId);
      return res.status(200).json(apiResponse('success', 'Auction request retrieved', request));
    } catch (error: any) {
      return AuctionRequestController.fail(res, error);
    }
  };

  update = async (req: CustomRequest<UpdateAuctionRequestDto>, res: Response) => {
    try {
      const request = await this.service.update(String(req.params.id), req.body, req.idUser!);
      return res.status(200).json(apiResponse('success', 'Auction request updated', request));
    } catch (error: any) {
      return AuctionRequestController.fail(res, error);
    }
  };

  cancel = async (req: CustomRequest, res: Response) => {
    try {
      const result = await this.service.cancel(String(req.params.id), req.idUser!);
      return res.status(200).json(apiResponse('success', 'Auction request withdrawn', result));
    } catch (error: any) {
      return AuctionRequestController.fail(res, error);
    }
  };

  // --- Admin ---

  findForAdmin = async (req: Request, res: Response) => {
    try {
      const query = req.query as unknown as AuctionRequestQueryDto;
      const { items, totalItems, page, limit } = await this.service.findForAdmin(query);
      return res
        .status(200)
        .json(paginatedResponse('Auction requests retrieved', items, page, limit, totalItems));
    } catch (error: any) {
      return AuctionRequestController.fail(res, error);
    }
  };

  adminUpdate = async (req: CustomRequest<UpdateAuctionRequestDto>, res: Response) => {
    try {
      const request = await this.service.update(String(req.params.id), req.body);
      return res.status(200).json(apiResponse('success', 'Auction request updated', request));
    } catch (error: any) {
      return AuctionRequestController.fail(res, error);
    }
  };

  approve = async (req: CustomRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = await this.service.approve(id, req.idUser!);

      // The decision is committed above, so a notification failure must not fail the
      // approval — the seller would be told "approve failed" for an auction that is
      // now live.
      try {
        const request = await this.service.findById(id);
        await notificationService
          .createAuctionRequestNotifications()
          .approved(request.sellerId, request.product?.name ?? 'Sản phẩm', result.auctionId, req.idUser!);
      } catch (notifyError: any) {
        logger.warn('[AuctionRequest] approved but notification failed: ' + notifyError.message);
      }

      return res.status(200).json(apiResponse('success', 'Auction request approved', result));
    } catch (error: any) {
      return AuctionRequestController.fail(res, error);
    }
  };

  reject = async (req: CustomRequest<RejectAuctionRequestDto>, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = await this.service.reject(id, req.idUser!, req.body.reason);

      try {
        const request = await this.service.findById(id);
        await notificationService
          .createAuctionRequestNotifications()
          .rejected(request.sellerId, request.product?.name ?? 'Sản phẩm', req.body.reason, req.idUser!);
      } catch (notifyError: any) {
        logger.warn('[AuctionRequest] rejected but notification failed: ' + notifyError.message);
      }

      return res.status(200).json(apiResponse('success', 'Auction request rejected', result));
    } catch (error: any) {
      return AuctionRequestController.fail(res, error);
    }
  };
}
