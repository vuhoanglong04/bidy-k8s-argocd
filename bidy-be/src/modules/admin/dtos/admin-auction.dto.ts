import { IsEnum, IsIn, IsInt, IsNumberString, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuctionStatus } from '../../auction/enum/auction-status.enum.js';

/** Whitelist of sortable columns — never let a raw query value reach the order clause. */
export const ADMIN_AUCTION_SORT_FIELDS = [
  'createdAt',
  'startDate',
  'endDate',
  'currentPrice',
  'startingPrice',
  'bidderCount',
  'totalBids',
] as const;

export type AdminAuctionSortField = (typeof ADMIN_AUCTION_SORT_FIELDS)[number];

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminAuctionQueryDto:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           minimum: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         search:
 *           type: string
 *           description: Matches the product name, case-insensitively. Wildcards are escaped.
 *         status:
 *           type: string
 *           enum: [pending, happening, ended, cancelled]
 *         categoryId:
 *           type: string
 *         sellerId:
 *           type: string
 *         sortBy:
 *           type: string
 *           enum: [createdAt, startDate, endDate, currentPrice, startingPrice, bidderCount, totalBids]
 *         sortOrder:
 *           type: string
 *           enum: [asc, desc]
 */
export class AdminAuctionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AuctionStatus)
  status?: AuctionStatus;

  @IsOptional()
  @IsNumberString({}, { message: 'categoryId must be a numeric id' })
  categoryId?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'sellerId must be a numeric id' })
  sellerId?: string;

  @IsOptional()
  @IsIn(ADMIN_AUCTION_SORT_FIELDS, {
    message: `sortBy must be one of: ${ADMIN_AUCTION_SORT_FIELDS.join(', ')}`,
  })
  sortBy?: AdminAuctionSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'sortOrder must be asc or desc' })
  sortOrder?: 'asc' | 'desc';
}

/**
 * @swagger
 * components:
 *   schemas:
 *     StatisticsYearDto:
 *       type: object
 *       properties:
 *         year:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *           description: Calendar year to report on. Defaults to the current year.
 */
export class StatisticsYearDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
