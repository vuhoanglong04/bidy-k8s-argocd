import { IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AuctionBidDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount!: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isAuto?: boolean;

  /** Ceiling for proxy bidding. Required when isAuto is true. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  limitBid?: number;
}
