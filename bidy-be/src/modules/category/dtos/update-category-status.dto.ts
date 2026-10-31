import { IsBoolean, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCategoryStatusDto {
  @IsBoolean({ message: 'isActive must be a boolean value' })
  @IsNotEmpty({ message: 'isActive is required' })
  @Type(() => Boolean)
  isActive!: boolean;
}
