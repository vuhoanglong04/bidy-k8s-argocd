import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ProductCondition } from '../enums/product-condition.enum.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateProductDto:
 *       type: object
 *       required:
 *         - name
 *         - categoryId
 *         - condition
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the product
 *         categoryId:
 *           type: string
 *           description: Category ID for the product
 *         description:
 *           type: string
 *           description: Detailed description of the product
 *         condition:
 *           type: string
 *           enum: [new, like_new, used, refurbished]
 *           description: Condition of the product
 */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProductCondition)
  @IsNotEmpty()
  condition!: ProductCondition;
}
