import { Repository } from 'typeorm';
import { AppDataSource } from '../../database/data-source';
import { User } from '../user/entity/user.entity';
import { Auction } from '../auction/entity/auctions.entity';
import { Category } from '../category/category.entity';
import { UserStatus } from '../user/enum/user.enum';
import { AuctionStatus } from '../auction/enum/auction-status.enum';

export interface MonthlyCount {
  /** Two-digit month, '01' through '12'. */
  month: string;
  amount: number;
}

/** Each overview is one grouped-count query — never a fetch-then-count in JS. */
export class AdminOverviewService {
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly auctionRepository = AppDataSource.getRepository(Auction);
  private readonly categoryRepository = AppDataSource.getRepository(Category);

  public async getUserOverview() {
    const rows = await this.userRepository
      .createQueryBuilder('user')
      .select('user.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.status')
      .getRawMany<{ status: UserStatus; count: string }>();

    const countOf = (status: UserStatus) =>
      Number(rows.find((row) => row.status === status)?.count ?? 0);

    return {
      totalUser: rows.reduce((total, row) => total + Number(row.count), 0),
      activeUser: countOf(UserStatus.ACTIVE),
      suspendedUser: countOf(UserStatus.SUSPENDED),
    };
  }

  public async getAuctionOverview() {
    const rows = await this.auctionRepository
      .createQueryBuilder('auction')
      .select('auction.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('auction.status')
      .getRawMany<{ status: AuctionStatus; count: string }>();

    const countOf = (status: AuctionStatus) =>
      Number(rows.find((row) => row.status === status)?.count ?? 0);

    return {
      totalAuction: rows.reduce((total, row) => total + Number(row.count), 0),
      happeningAuction: countOf(AuctionStatus.HAPPENING),
      endedAuction: countOf(AuctionStatus.ENDED),
    };
  }

  public async getCategoryOverview() {
    const rows = await this.categoryRepository
      .createQueryBuilder('category')
      .select('category.isActive', 'isActive')
      .addSelect('COUNT(*)', 'count')
      .groupBy('category.isActive')
      .getRawMany<{ isActive: boolean; count: string }>();

    const countOf = (isActive: boolean) =>
      Number(rows.find((row) => row.isActive === isActive)?.count ?? 0);

    return {
      totalCategories: rows.reduce((total, row) => total + Number(row.count), 0),
      activeCategories: countOf(true),
      inactiveCategories: countOf(false),
    };
  }

  /**
   * Twelve rows, always — a month with no rows reads as 0 rather than going missing,
   * because a chart needs a continuous axis. COUNT comes back as a string from
   * Postgres, so every amount is cast before it leaves the service.
   */
  private async countByMonth(
    repository: Repository<Auction | User>,
    alias: string,
    year: number,
  ): Promise<MonthlyCount[]> {
    const rows = await repository
      .createQueryBuilder(alias)
      .select(`EXTRACT(MONTH FROM ${alias}.created_at)`, 'month')
      .addSelect('COUNT(*)', 'count')
      .where(`EXTRACT(YEAR FROM ${alias}.created_at) = :year`, { year })
      .groupBy('month')
      .getRawMany<{ month: string; count: string }>();

    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const row = rows.find((candidate) => Number(candidate.month) === month);
      return {
        month: String(month).padStart(2, '0'),
        amount: Number(row?.count ?? 0),
      };
    });
  }

  public async getAuctionsByMonth(year: number) {
    return this.countByMonth(this.auctionRepository, 'auction', year);
  }

  public async getUsersByMonth(year: number) {
    return this.countByMonth(this.userRepository, 'user', year);
  }
}
