import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MinLength(2, { message: 'Category name must be at least 2 characters' })
  @MaxLength(100, { message: 'Category name must not exceed 100 characters' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'parentId must be a valid numeric ID' })
  parentId?: string | null;

  /** Id from POST /api/v1/files (purpose: category). Null clears the image. */
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'imageFileId must be a valid numeric ID' })
  imageFileId?: string | null;
}
