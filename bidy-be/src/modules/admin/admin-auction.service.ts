import { AppDataSource } from '../../database/data-source.js';
import { Auction } from '../auction/entity/auctions.entity.js';
import { AuctionStatus } from '../auction/enum/auction-status.enum.js';
import { fileService } from '../file/file.provider.js';
import { escapeLike } from '../../common/util/sql-like.js';
import { AdminAuctionQueryDto } from './dtos/admin-auction.dto.js';

/**
 * Back-office listing of every auction, whatever its status.
 *
 * Deliberately not reusing AuctionService.getAuctions: that one feeds public cards
 * and narrows the seller to `{ id, username }` because it is unauthenticated. Admin
 * needs the seller's email to act on a listing, so the two shapes cannot be the same
 * query without leaking PII on the public path.
 */
export class AdminAuctionService {
  private readonly auctionRepository = AppDataSource.getRepository(Auction);

  public async findAuctions(params: AdminAuctionQueryDto) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const qb = this.auctionRepository
      .createQueryBuilder('auction')
      .leftJoin('auction.product', 'product')
      .leftJoin('product.category', 'category')
      .leftJoin('product.owner', 'owner')
      .leftJoin('product.images', 'primaryImage', 'primaryImage.isPrimary = TRUE')
      .leftJoin('primaryImage.file', 'primaryImageFile')
      .select([
        'auction.id',
        'auction.status',
        'auction.startingPrice',
        'auction.currentPrice',
        'auction.buyNowPrice',
        'auction.reservePrice',
        'auction.bidIncrement',
        'auction.quantity',
        'auction.bidderCount',
        'auction.totalBids',
        'auction.startDate',
        'auction.endDate',
        'auction.createdAt',
        'product.id',
        'product.name',
        'category.id',
        'category.name',
        'owner.id',
        'owner.username',
        'owner.fullname',
        'owner.email',
        // Without the join alias itself TypeORM never hydrates product.images, so the
        // file below comes back unreachable and every primaryImage reads as null.
        'primaryImage.id',
        'primaryImageFile.id',
        'primaryImageFile.s3Key',
      ]);

    if (params.status) {
      qb.andWhere('auction.status = :status', { status: params.status });
    }

    if (params.categoryId) {
      qb.andWhere('product.category_id = :categoryId', { categoryId: params.categoryId });
    }

    if (params.sellerId) {
      qb.andWhere('product.owner_id = :sellerId', { sellerId: params.sellerId });
    }

    if (params.search?.trim()) {
      // Binding stops injection but not wildcards — an unescaped '%' would match
      // every product in the table.
      qb.andWhere('product.name ILIKE :search', {
        search: `%${escapeLike(params.search.trim())}%`,
      });
    }

    qb.orderBy(
      `auction.${params.sortBy ?? 'createdAt'}`,
      (params.sortOrder ?? 'desc').toUpperCase() as 'ASC' | 'DESC',
    );

    qb.skip((page - 1) * limit).take(limit);

    const [auctions, totalItems] = await qb.getManyAndCount();

    const primaryImages = await fileService.urlsOf(
      auctions.map((auction) => auction.product?.images?.[0]?.file),
    );

    const items = auctions.map((auction, index) => ({
      id: auction.id,
      status: auction.status,
      startingPrice: Number(auction.startingPrice),
      currentPrice: Number(auction.currentPrice),
      buyNowPrice: auction.buyNowPrice === null ? null : Number(auction.buyNowPrice),
      reservePrice: auction.reservePrice === null ? null : Number(auction.reservePrice),
      bidIncrement: Number(auction.bidIncrement),
      quantity: auction.quantity,
      bidderCount: auction.bidderCount,
      totalBids: auction.totalBids,
      startDate: auction.startDate,
      endDate: auction.endDate,
      createdAt: auction.createdAt,
      product: auction.product
        ? { id: auction.product.id, name: auction.product.name, primaryImage: primaryImages[index] }
        : null,
      category: auction.product?.category
        ? { id: auction.product.category.id, name: auction.product.category.name }
        : null,
      seller: auction.product?.owner
        ? {
            id: auction.product.owner.id,
            username: auction.product.owner.username,
            fullname: auction.product.owner.fullname,
            email: auction.product.owner.email,
          }
        : null,
    }));

    return { items, totalItems, page, limit };
  }

  /**
   * Cancels a live or upcoming auction. Bidding holds no money — escrow only exists
   * once an order is created — so there is nothing to refund here; cancelling is a
   * status change plus the broadcast that tells open clients to stop counting down.
   */
  public async cancelAuction(auctionId: string) {
    const auction = await this.auctionRepository.findOne({ where: { id: auctionId } });
    if (!auction) throw new Error('AUCTION_NOT_FOUND');

    if (auction.status !== AuctionStatus.PENDING && auction.status !== AuctionStatus.HAPPENING) {
      throw new Error('AUCTION_NOT_CANCELLABLE');
    }

    auction.status = AuctionStatus.CANCELLED;
    await this.auctionRepository.save(auction);

    return { id: auction.id, status: auction.status };
  }
}
