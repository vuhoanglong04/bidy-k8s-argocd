import { IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuctionStatus } from '../enum/auction-status.enum.js';

/** Whitelist of sortable columns — never let a raw query value reach the order clause. */
export const AUCTION_SORT_FIELDS = ['endDate', 'createdAt', 'currentPrice', 'bidderCount', 'totalBids'] as const;

export type AuctionSortField = (typeof AUCTION_SORT_FIELDS)[number];

/**
 * @swagger
 * components:
 *   schemas:
 *     AuctionQueryDto:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           minimum: 1
 *           description: Page number for pagination
 *         limit:
 *           type: integer
 *           minimum: 1
 *           description: Number of items per page
 *         status:
 *           type: string
 *           enum: [pending, happening, ended, cancelled]
 *           description: Filter by auction status. Omit to list every status.
 *         sortBy:
 *           type: string
 *           enum: [endDate, createdAt, currentPrice, bidderCount, totalBids]
 *           description: >
 *             Sort field. Omit to keep the status-aware default: ended auctions
 *             newest-first, live and upcoming ones closing-soonest-first.
 *         sortOrder:
 *           type: string
 *           enum: [asc, desc]
 *           description: Sort order. Defaults to desc when sortBy is given.
 */
export class AuctionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsEnum(AuctionStatus)
  status?: AuctionStatus;

  @IsOptional()
  @IsIn(AUCTION_SORT_FIELDS, { message: `sortBy must be one of: ${AUCTION_SORT_FIELDS.join(', ')}` })
  sortBy?: AuctionSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'sortOrder must be asc or desc' })
  sortOrder?: 'asc' | 'desc';
}
