import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @swagger
 * components:
 *   schemas:
 *     EnableAutoBidDto:
 *       type: object
 *       required: [limitBid]
 *       properties:
 *         limitBid:
 *           type: number
 *           description: >
 *             Ceiling the proxy may bid up to on your behalf. The server picks every
 *             actual bid amount; the step comes from the auction's own bidIncrement.
 *             Kept private to you — other bidders never see it.
 *           example: 500000
 */
export class EnableAutoBidDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  limitBid!: number;
}
