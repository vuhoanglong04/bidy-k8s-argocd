import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuctionStatus } from '../enum/auction-status.enum.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     AuctionSearchDto:
 *       type: object
 *       properties:
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 25
 *           default: 10
 *           description: >
 *             Number of suggestions to return. This endpoint feeds the header
 *             search dropdown, so it is deliberately capped and has no paging.
 *         status:
 *           type: string
 *           enum: [pending, happening, ended, cancelled]
 *           description: >
 *             Filter by auction status. Omit to search only auctions a user can
 *             still act on — live and upcoming ones.
 */
export class AuctionSearchDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;

  @IsOptional()
  @IsEnum(AuctionStatus)
  status?: AuctionStatus;
}
