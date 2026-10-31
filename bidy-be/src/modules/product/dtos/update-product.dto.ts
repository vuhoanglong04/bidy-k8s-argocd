import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProductCondition } from '../enums/product-condition.enum.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateProductDto:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: New name for the product
 *         categoryId:
 *           type: string
 *           description: New category ID for the product
 *         description:
 *           type: string
 *           description: Updated description of the product
 *         condition:
 *           type: string
 *           enum: [new, like_new, used, refurbished]
 *           description: Updated condition of the product
 */
export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProductCondition)
  @IsOptional()
  condition?: ProductCondition;
}
