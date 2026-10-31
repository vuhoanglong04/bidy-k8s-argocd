import { IsNotEmpty } from 'class-validator';

export class TopupDto {
  @IsNotEmpty({ message: 'Amount is required' })
  amount!: string | number;
}
