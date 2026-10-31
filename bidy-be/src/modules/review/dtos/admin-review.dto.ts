import { IsEnum, IsInt, IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReviewStatus } from '../enum/review-status.enum.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminReviewQueryDto:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           minimum: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         status:
 *           type: string
 *           enum: [published, hidden]
 *           description: Omit to list both.
 *         revieweeId:
 *           type: string
 *         reviewerId:
 *           type: string
 */
export class AdminReviewQueryDto {
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
  @IsEnum(ReviewStatus, { message: 'status must be published or hidden' })
  status?: ReviewStatus;

  @IsOptional()
  @IsNumberString({}, { message: 'revieweeId must be a numeric id' })
  revieweeId?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'reviewerId must be a numeric id' })
  reviewerId?: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateReviewStatusDto:
 *       type: object
 *       required: [status]
 *       properties:
 *         status:
 *           type: string
 *           enum: [published, hidden]
 *         reason:
 *           type: string
 *           maxLength: 500
 *           description: Recorded in the admin audit log, not shown to the author.
 */
export class UpdateReviewStatusDto {
  @IsEnum(ReviewStatus, { message: 'status must be published or hidden' })
  status!: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
