import { IsOptional, IsString, IsIn, Matches } from 'class-validator';

/**
 * @swagger
 * components:
 *   schemas:
 *     ReviewQueryDto:
 *       type: object
 *       properties:
 *         page:
 *           type: string
 *           description: 1-based page number
 *           example: "1"
 *         limit:
 *           type: string
 *           description: Page size (max 50)
 *           example: "20"
 *         rating:
 *           type: string
 *           enum: ['1', '2', '3', '4', '5']
 *           description: Filter by exact product rating
 *         sortOrder:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *           description: Sort by creation date
 */
export class ReviewQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'page must be a positive integer' })
  page?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'limit must be a positive integer' })
  limit?: string;

  @IsOptional()
  @IsString()
  @IsIn(['1', '2', '3', '4', '5'], { message: 'rating must be between 1 and 5' })
  rating?: string;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'sortOrder must be asc or desc' })
  sortOrder?: string;
}
