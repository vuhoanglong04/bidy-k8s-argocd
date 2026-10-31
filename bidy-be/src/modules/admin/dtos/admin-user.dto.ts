import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString, IsInt, Min, IsEmail, IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, UserStatus } from '../../user/enum/user.enum.js';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  USERNAME_RULE_MESSAGE,
} from '../../user/user.constants.js';

export class SearchUserDTO {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  locked?: boolean;

  @IsOptional()
  @IsDateString()
  created_from?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

export class UpdateUserProfileDTO {
  @IsOptional()
  @IsString()
  @MinLength(USERNAME_MIN_LENGTH)
  @MaxLength(USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN, { message: USERNAME_RULE_MESSAGE })
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  fullname?: string;
}

export class ChangeRoleDTO {
  @IsNotEmpty()
  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SuspendUserDTO {
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}

export class BanUserDTO {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
