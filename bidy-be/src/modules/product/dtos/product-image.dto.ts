import { IsString, IsInt, Min, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @swagger
 * components:
 *   schemas:
 *     ImageOrderItemDto:
 *       type: object
 *       required:
 *         - id
 *         - displayOrder
 *       properties:
 *         id:
 *           type: string
 *           description: The ID of the image
 *         displayOrder:
 *           type: integer
 *           description: The new display order index (0-based)
 *     ReorderImagesDto:
 *       type: object
 *       required:
 *         - images
 *       properties:
 *         images:
 *           type: array
 *           description: List of images with their new display orders. Must contain all images for the product.
 *           items:
 *             $ref: '#/components/schemas/ImageOrderItemDto'
 */
export class ImageOrderItemDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class ReorderImagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ImageOrderItemDto)
  images!: ImageOrderItemDto[];
}
