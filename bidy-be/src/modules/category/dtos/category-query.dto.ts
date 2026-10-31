import { IsOptional, IsString, IsIn, Matches } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @swagger
 * components:
 *   schemas:
 *     CategoryQueryDto:
 *       type: object
 *       properties:
 *         page:
 *           type: number
 *           description: Page number for pagination
 *         limit:
 *           type: number
 *           description: Number of items per page
 *         parentId:
 *           type: string
 *           description: Filter by parent category ID
 *         search:
 *           type: string
 *           description: Search categories by name
 *         isActive:
 *           type: string
 *           enum: ['true', 'false']
 *           description: Filter by active status
 *         sortBy:
 *           type: string
 *           enum: ['name', 'createdAt', 'updatedAt']
 *           description: Sort field
 *         sortOrder:
 *           type: string
 *           enum: ['asc', 'desc']
 *           description: Sort order
 */
export class CategoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'parentId must be a valid numeric ID' })
  parentId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'], { message: 'isActive must be true or false' })
  isActive?: string;

  @IsOptional()
  @IsString()
  @IsIn(['name', 'createdAt', 'updatedAt'], { message: 'sortBy must be one of: name, createdAt, updatedAt' })
  sortBy?: 'name' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'sortOrder must be asc or desc' })
  sortOrder?: 'asc' | 'desc';
}
