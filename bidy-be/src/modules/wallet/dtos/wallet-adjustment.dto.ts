import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class WalletAdjustmentDto {
  @IsNotEmpty({ message: 'walletId is required' })
  @IsString({ message: 'walletId must be a string' })
  walletId!: string;

  @IsNotEmpty({ message: 'amount is required' })
  amount!: string | number;

  @IsNotEmpty({ message: 'reason is required' })
  @IsString({ message: 'reason must be a string' })
  reason!: string;

  @IsOptional()
  @IsString()
  bank_reference?: string;

  @IsOptional()
  @IsString()
  bankTransactionId?: string;

  @IsOptional()
  @IsString()
  bankReference?: string;
}
