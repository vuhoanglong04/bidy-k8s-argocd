import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty, IsOptional, IsObject } from 'class-validator';

export class ProductGridMessageDto {
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  productIds!: string[];

  @IsString()
  @IsOptional()
  message?: string;

  @IsObject()
  @IsOptional()
  gridConfig?: any;
}
