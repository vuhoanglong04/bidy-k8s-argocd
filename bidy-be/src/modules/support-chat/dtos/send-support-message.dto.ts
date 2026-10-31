import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SendSupportMessageDto {
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsString()
  messageType?: string;

  /**
   * Client-generated id, echoed back untouched in the broadcast so the sender can
   * match the stored message to the bubble it rendered optimistically.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientMessageId?: string;
}
