import { IsString, IsOptional, IsEnum, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCondition } from '../enums/product-condition.enum.js';
import { ProductStatus } from '../enums/product-status.enum.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductQueryDto:
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
 *         categoryId:
 *           type: string
 *           description: Filter by category ID
 *         condition:
 *           type: string
 *           enum: [new, like_new, used, refurbished]
 *           description: Filter by product condition
 *         status:
 *           type: string
 *           enum: [draft, active]
 *           description: Filter by product status (usually for /me/products endpoint)
 *         search:
 *           type: string
 *           description: Search term to filter by product name
 *         sortBy:
 *           type: string
 *           enum: [createdAt, updatedAt, name]
 *           description: Field to sort by
 *         sortOrder:
 *           type: string
 *           enum: [asc, desc]
 *           description: Order of sorting
 */
export class ProductQueryDto {
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

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsEnum(ProductCondition)
  @IsOptional()
  condition?: ProductCondition;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name'])
  sortBy?: 'createdAt' | 'updatedAt' | 'name';

  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
