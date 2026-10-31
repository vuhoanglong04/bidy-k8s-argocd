import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuctionStatus } from '../../auction/enum/auction-status.enum.js';
import { AUCTION_SORT_FIELDS, AuctionSortField } from '../../auction/dtos/auction-query.dto.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     SellerAuctionQueryDto:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           minimum: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         status:
 *           type: string
 *           enum: [pending, happening, ended]
 *           description: >
 *             Omit to list every publicly visible auction. `cancelled` is filtered
 *             out server-side and returns nothing even when asked for explicitly.
 *         sortBy:
 *           type: string
 *           enum: [endDate, createdAt, currentPrice, bidderCount, totalBids]
 *         sortOrder:
 *           type: string
 *           enum: [asc, desc]
 */
export class SellerAuctionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
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
