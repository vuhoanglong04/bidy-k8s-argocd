import { Repository } from 'typeorm';
import { User } from './entity/user.entity.js';
import { Auction } from '../auction/entity/auctions.entity.js';
import { AuctionStatus } from '../auction/enum/auction-status.enum.js';
import { fileService } from '../file/file.provider.js';
import { AppError } from '../../middlewares/error.middleware.js';

/** Statuses a storefront shows. `cancelled` is never public. */
export const SELLER_PUBLIC_STATUSES = [
  AuctionStatus.PENDING,
  AuctionStatus.HAPPENING,
  AuctionStatus.ENDED,
] as const;

/**
 * Public storefront for one seller.
 *
 * Everything here is served without a token, so the profile is assembled field by
 * field rather than by trimming a User entity: email and phone live on that entity,
 * and a `select` that forgets one of them leaks it to anyone with a seller id.
 */
export class SellerService {
  constructor(
    private readonly userRepo: Repository<User>,
    private readonly auctionRepo: Repository<Auction>,
  ) {}

  async getPublicProfile(sellerId: string) {
    const seller = await this.userRepo.findOne({
      where: { id: sellerId },
      select: { id: true, username: true, fullname: true, avatarFileId: true, createdAt: true },
      relations: { avatarFile: true },
    });

    if (!seller) throw new AppError('Seller not found', 404);

    return {
      id: seller.id,
      username: seller.username,
      fullname: seller.fullname,
      avatarFileId: seller.avatarFileId ?? null,
      avatarUrl: await fileService.urlOf(seller.avatarFile),
      createdAt: seller.createdAt,
      auctionCounts: await this.countAuctionsByStatus(sellerId),
    };
  }

  /**
   * One grouped-count query, not three. `total` deliberately excludes `cancelled`,
   * so the three tab counts always add up to it — a total that counted hidden
   * auctions would send the reader hunting for rows the storefront never shows.
   */
  private async countAuctionsByStatus(sellerId: string) {
    const rows = await this.auctionRepo
      .createQueryBuilder('auction')
      .innerJoin('auction.product', 'product')
      .select('auction.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('product.owner_id = :sellerId', { sellerId })
      .andWhere('auction.status IN (:...statuses)', { statuses: SELLER_PUBLIC_STATUSES })
      .groupBy('auction.status')
      .getRawMany<{ status: AuctionStatus; count: string }>();

    const countOf = (status: AuctionStatus) =>
      Number(rows.find((row) => row.status === status)?.count ?? 0);

    return {
      pending: countOf(AuctionStatus.PENDING),
      happening: countOf(AuctionStatus.HAPPENING),
      ended: countOf(AuctionStatus.ENDED),
      total: rows.reduce((sum, row) => sum + Number(row.count), 0),
    };
  }

  async assertSellerExists(sellerId: string) {
    const exists = await this.userRepo.exists({ where: { id: sellerId } });
    if (!exists) throw new AppError('Seller not found', 404);
  }
}
