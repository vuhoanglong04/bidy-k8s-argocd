import { IsString, IsNotEmpty, IsNumber, IsInt, IsOptional, Min, Max, IsEnum, Matches, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCondition } from '../../product/enums/product-condition.enum.js';

export class ListingAuctionDto {
  /**
   * Auction a product the seller already owns, curated under /me/products.
   *
   * When present it is the only source of product data: name, category, condition,
   * description and images all come from the product, and sending any of them here
   * is refused with 400 rather than dropped — a field the caller sent expecting it
   * to apply must never vanish silently. Omit product_id to keep the one-shot path
   * where this form carries the product itself.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'product_id must be a valid numeric ID' })
  product_id?: string;

  // Required only when creating the product inline: with product_id the product
  // already exists, and demanding its name again is what caused duplicate entry.
  @ValidateIf((dto) => !dto.product_id)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateIf((dto) => !dto.product_id)
  @IsString()
  @IsNotEmpty()
  category_id!: string;

  @IsString()
  @IsOptional()
  description?: string;

  // Bound to the ProductCondition enum rather than a hand-written list: the literal
  // array here had drifted and was missing `like_new`, so a product created with
  // that condition could not be auctioned through the inline path at all.
  @IsString()
  @IsOptional()
  @IsEnum(ProductCondition)
  condition?: ProductCondition;

  /**
   * Units of the product sold in this auction. Defaults to 1.
   *
   * The lot goes to a single winner, so every price below is for the whole lot
   * rather than per unit. Integer because half an item is not a thing to sell.
   */
  @IsOptional()
  @IsInt({ message: 'quantity must be a whole number' })
  @Min(1, { message: 'quantity must be at least 1' })
  @Type(() => Number)
  quantity?: number;

  @IsNumber()
  @Min(0)
  @Max(9999999999.99, { message: "$property must not exceed 9999999999.99 (DECIMAL(12,2))" })
  @Type(() => Number)
  starting_price!: number;

  @IsNumber()
  @Min(0)
  @Max(9999999999.99, { message: "$property must not exceed 9999999999.99 (DECIMAL(12,2))" })
  @IsOptional()
  @Type(() => Number)
  buy_now_price?: number;

  @IsNumber()
  @Min(0)
  @Max(9999999999.99, { message: "$property must not exceed 9999999999.99 (DECIMAL(12,2))" })
  @IsOptional()
  @Type(() => Number)
  reserve_price?: number;

  @IsNumber()
  @Min(0)
  @Max(9999999999.99, { message: "$property must not exceed 9999999999.99 (DECIMAL(12,2))" })
  @IsOptional()
  @Type(() => Number)
  bid_increment?: number;

  // The service defaults start_date to now, and derives end_date from durationDays
  // (7 days if absent) — so both dates are genuinely optional here. Declaring them
  // as required would reject the "duration" mode the create form offers.
  @IsString()
  @IsOptional()
  start_date?: string;

  @IsString()
  @IsOptional()
  end_date?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  durationDays?: number;
}
