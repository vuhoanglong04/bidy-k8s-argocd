import { Response } from 'express';
import { In } from 'typeorm';
import { CustomRequest } from '../user/user.controller.js';
import { ProductGridMessageDto } from '../user/dtos/product-grid-message.dto.js';
import { fileService } from '../file/file.provider.js';
import { AppDataSource } from '../../database/data-source.js';
import { Auction } from '../auction/entity/auctions.entity.js';
import supportService from '../support-chat/support.service.js';
import { apiResponse } from '../../common/util/api-response.js';
import { logger } from '../../common/util/logger.js';

const MAX_GRID_PRODUCTS = 12;

interface ProductAttachment {
  auctionId: string;
  productId: string;
  productTitle: string;
  productImageFileId: string | null;
  productImage: string | null;
  currentPrice: number;
  auctionStatus: string;
  productUrl: string;
}

/**
 * Snapshot the auctions so the grid renders the same way when the chat is
 * re-opened, even after the auction has moved on or ended.
 */
const buildProductAttachments = async (auctionIds: string[]): Promise<ProductAttachment[]> => {
  // Ids are bigint columns — a non-numeric id would abort the whole query in Postgres.
  const ids = auctionIds.filter((id) => /^\d+$/.test(id));
  if (ids.length === 0) return [];

  const auctions = await AppDataSource.getRepository(Auction).find({
    where: { id: In(ids) },
    relations: { product: { images: { file: true } } },
  });

  return await Promise.all(auctions.map(async (auction) => {
    const images = auction.product?.images ?? [];
    const primary = images.find((img) => img.isPrimary) ?? images[0];

    return {
      auctionId: auction.id,
      productId: auction.productId,
      productTitle: auction.product?.name ?? '',
      productImageFileId: primary?.fileId ?? null,
      productImage: await fileService.urlOf(primary?.file),
      currentPrice: auction.currentPrice,
      auctionStatus: auction.status,
      productUrl: `/auctions/${auction.id}`,
    };
  }));
};

/**
 * Send a product grid message into a support chat
 * POST /api/v1/users/support/messages/product-grid
 */
export const sendProductGridMessage = async (req: CustomRequest<ProductGridMessageDto>, res: Response) => {
  try {
    const { chatId, productIds, message, gridConfig } = req.body;
    const senderId = req.idUser!;

    if (productIds.length > MAX_GRID_PRODUCTS) {
      return res
        .status(400)
        .json(apiResponse('fail', `A product grid may contain at most ${MAX_GRID_PRODUCTS} products`));
    }

    const productAttachments = await buildProductAttachments(productIds);

    if (productAttachments.length === 0) {
      return res.status(404).json(apiResponse('fail', 'No products found'));
    }

    const supportMessage = await supportService.sendMessage({
      ticketId: chatId,
      senderId,
      content: message || '',
      messageType: 'product_grid',
      requesterId: senderId,
      metadata: {
        productAttachments,
        gridConfig: gridConfig ?? { columns: 3, maxItems: 9 },
      },
    });

    return res.status(201).json(apiResponse('success', 'Product grid sent successfully', supportMessage));
  } catch (error: any) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json(apiResponse('fail', 'Support chat not found'));
    }
    logger.error('Error in sendProductGridMessage controller', {
      error: error.message,
      userId: req.idUser,
    });
    return res.status(500).json(apiResponse('fail', 'Failed to send product grid'));
  }
};

/**
 * Get product details in batch
 * GET /api/v1/users/support/products/batch?productIds=id1,id2,id3
 */
export const getBatchProducts = async (req: CustomRequest, res: Response) => {
  try {
    const { productIds } = req.query as { productIds?: string };

    if (!productIds) {
      return res.status(400).json(apiResponse('fail', 'productIds is required'));
    }

    const ids = productIds.split(',').map((id) => id.trim()).filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json(apiResponse('fail', 'productIds is required'));
    }

    const productAttachments = await buildProductAttachments(ids.slice(0, MAX_GRID_PRODUCTS));

    return res.status(200).json(apiResponse('success', 'Products retrieved successfully', productAttachments));
  } catch (error: any) {
    logger.error('Error in getBatchProducts controller', {
      error: error.message,
      userId: req.idUser,
    });
    return res.status(500).json(apiResponse('fail', 'Failed to get products'));
  }
};

export default {
  sendProductGridMessage,
  getBatchProducts,
};
