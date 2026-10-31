import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuctionRequestStatus } from '../enum/auction-request-status.enum.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateAuctionRequestDto:
 *       type: object
 *       required: [productId, startingPrice, startDate, endDate]
 *       properties:
 *         productId: { type: string, example: "17" }
 *         quantity:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           description: >
 *             Units sold as one lot to a single winner, so every price below is for
 *             the whole lot, not per unit.
 *         startingPrice: { type: number, minimum: 0 }
 *         buyNowPrice: { type: number, nullable: true }
 *         reservePrice: { type: number, nullable: true }
 *         bidIncrement: { type: number, minimum: 0 }
 *         startDate: { type: string, format: date-time }
 *         endDate: { type: string, format: date-time }
 */
export class CreateAuctionRequestDto {
  @IsNumberString({}, { message: 'productId must be a numeric id' })
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  startingPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  buyNowPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reservePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bidIncrement?: number;

  @IsISO8601({}, { message: 'startDate must be an ISO 8601 date-time' })
  startDate!: string;

  @IsISO8601({}, { message: 'endDate must be an ISO 8601 date-time' })
  endDate!: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateAuctionRequestDto:
 *       type: object
 *       description: >
 *         Every field optional; only what you send is changed. The product cannot be
 *         swapped — withdraw the request and file a new one instead.
 *       properties:
 *         quantity: { type: integer, minimum: 1 }
 *         startingPrice: { type: number, minimum: 0 }
 *         buyNowPrice: { type: number, nullable: true }
 *         reservePrice: { type: number, nullable: true }
 *         bidIncrement: { type: number, minimum: 0 }
 *         startDate: { type: string, format: date-time }
 *         endDate: { type: string, format: date-time }
 */
export class UpdateAuctionRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  startingPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  buyNowPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reservePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bidIncrement?: number;

  @IsOptional()
  @IsISO8601({}, { message: 'startDate must be an ISO 8601 date-time' })
  startDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endDate must be an ISO 8601 date-time' })
  endDate?: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     RejectAuctionRequestDto:
 *       type: object
 *       required: [reason]
 *       properties:
 *         reason:
 *           type: string
 *           minLength: 1
 *           maxLength: 500
 *           description: Shown to the seller, so it has to say something useful.
 */
export class RejectAuctionRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'reason is required when rejecting a request' })
  @MaxLength(500)
  reason!: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     AuctionRequestQueryDto:
 *       type: object
 *       properties:
 *         page: { type: integer, minimum: 1 }
 *         limit: { type: integer, minimum: 1, maximum: 100 }
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected, cancelled]
 *         search:
 *           type: string
 *           description: Admin listing only — matches the product name.
 */
export class AuctionRequestQueryDto {
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
  @IsEnum(AuctionRequestStatus, {
    message: 'status must be one of: pending, approved, rejected, cancelled',
  })
  status?: AuctionRequestStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
