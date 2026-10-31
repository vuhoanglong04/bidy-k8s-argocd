import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty } from 'class-validator';

export class ProcessPaymentDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderIds!: string[];

  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;
}
