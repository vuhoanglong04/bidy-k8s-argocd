import { IsString, IsOptional, IsEnum } from 'class-validator';
import { NotificationType } from '../../notification/enum/notification-type.enum.js';

export class CreateTestNotificationDto {
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;
}
