import { IsString, IsOptional, MaxLength } from 'class-validator';

export class StartSupportChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;
}
