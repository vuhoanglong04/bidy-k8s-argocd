import { IsString, IsNotEmpty } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
