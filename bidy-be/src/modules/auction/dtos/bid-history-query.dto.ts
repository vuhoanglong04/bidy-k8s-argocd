import { IsEnum, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuctionStatus } from '../enum/auction-status.enum.js';

/**
 * The values bid_history.action_type actually takes, verified against the column.
 * `auto_bid` is written by the proxy-bidding resolver, so a filter list without it
 * makes every proxy bid unreachable — which is how it was first missed here.
 */
export const BID_ACTION_TYPES = ['place_bid', 'auto_bid', 'won', 'lost', 'buy_now'] as const;

export type BidActionType = (typeof BID_ACTION_TYPES)[number];

/**
 * @swagger
 * components:
 *   schemas:
 *     BidHistoryQueryDto:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           minimum: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         actionType:
 *           type: string
 *           enum: [place_bid, auto_bid, won, lost, buy_now]
 *           description: >
 *             Filters on the bid row itself. Not the same axis as `auctionStatus`:
 *             "still running" is a property of the auction, not of the bid.
 *         auctionStatus:
 *           type: string
 *           enum: [pending, happening, ended, cancelled]
 *           description: Pass `happening` for the bids that are still in play.
 *         sortBy:
 *           type: string
 *           enum: [createdAt, amount]
 *           description: >
 *             `position` is not sortable — it is the rank recorded when the row was
 *             written and is nullable, so ordering by it is not stable.
 *         sortOrder:
 *           type: string
 *           enum: [asc, desc]
 *         search:
 *           type: string
 *           description: Matches the product name, case-insensitively. Wildcards are escaped.
 *         dateFrom:
 *           type: string
 *           description: >
 *             ISO 8601 date-time, or a bare `YYYY-MM-DD`. Filters on the BID's
 *             createdAt, not the auction's. Inclusive.
 *           example: "2026-09-01"
 *         dateTo:
 *           type: string
 *           description: >
 *             Same formats as `dateFrom`, and inclusive. A bare date covers the whole
 *             day — `2026-09-20` includes bids placed at 23:59 that day, rather than
 *             cutting off at midnight.
 *           example: "2026-09-20"
 */
export class BidHistoryQueryDto {
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
  @IsIn(BID_ACTION_TYPES, { message: `actionType must be one of: ${BID_ACTION_TYPES.join(', ')}` })
  actionType?: BidActionType;

  @IsOptional()
  @IsEnum(AuctionStatus)
  auctionStatus?: AuctionStatus;

  @IsOptional()
  @IsIn(['createdAt', 'amount'], { message: 'sortBy must be createdAt or amount' })
  sortBy?: 'createdAt' | 'amount';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'sortOrder must be asc or desc' })
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'dateFrom must be an ISO 8601 date or date-time' })
  dateFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'dateTo must be an ISO 8601 date or date-time' })
  dateTo?: string;
}
