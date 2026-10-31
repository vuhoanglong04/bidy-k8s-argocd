import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  Matches,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateReviewDto:
 *       type: object
 *       required:
 *         - orderId
 *         - productRating
 *       properties:
 *         orderId:
 *           type: string
 *           description: ID of the delivered order being reviewed. One review per order.
 *           example: "42"
 *         productRating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Rating of the product itself
 *           example: 5
 *         shippingRating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Optional rating of the shipping experience
 *         serviceRating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Optional rating of the seller's service
 *         comment:
 *           type: string
 *           maxLength: 5000
 *           description: Optional free-text review body
 *         isAnonymous:
 *           type: boolean
 *           default: false
 *           description: Hide the reviewer's identity from public listings
 *         mediaFileIds:
 *           type: array
 *           maxItems: 9
 *           items:
 *             type: string
 *           description: >
 *             Ids returned by POST /api/v1/files (purpose: review). The review
 *             response carries presigned URLs for them; no URL is ever stored.
 */
export class CreateReviewDto {
  @IsString()
  @IsNotEmpty({ message: 'orderId is required' })
  @Matches(/^\d+$/, { message: 'orderId must be a valid numeric ID' })
  orderId!: string;

  @Type(() => Number)
  @IsInt({ message: 'productRating must be an integer' })
  @Min(1, { message: 'productRating must be between 1 and 5' })
  @Max(5, { message: 'productRating must be between 1 and 5' })
  productRating!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'shippingRating must be an integer' })
  @Min(1, { message: 'shippingRating must be between 1 and 5' })
  @Max(5, { message: 'shippingRating must be between 1 and 5' })
  shippingRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'serviceRating must be an integer' })
  @Min(1, { message: 'serviceRating must be between 1 and 5' })
  @Max(5, { message: 'serviceRating must be between 1 and 5' })
  serviceRating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'comment must not exceed 5000 characters' })
  comment?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9, { message: 'A review may include at most 9 media items' })
  @Matches(/^\d+$/, { each: true, message: 'each mediaFileId must be a valid numeric ID' })
  mediaFileIds?: string[];
}
