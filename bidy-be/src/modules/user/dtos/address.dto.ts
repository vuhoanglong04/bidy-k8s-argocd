import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, ValidateIf } from 'class-validator';

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateAddressDto:
 *       type: object
 *       required: [street, city, state]
 *       properties:
 *         street:
 *           type: string
 *           maxLength: 255
 *           example: 12 Nguyễn Huệ
 *         city:
 *           type: string
 *           maxLength: 100
 *           example: Hồ Chí Minh
 *         state:
 *           type: string
 *           maxLength: 100
 *           example: Quận 1
 *         zipCode:
 *           type: string
 *           nullable: true
 *           maxLength: 20
 *           example: "700000"
 *         isDefault:
 *           type: boolean
 *           description: >
 *             Promotes this address to the user's default, demoting the previous one.
 *             The first address a user creates becomes the default regardless.
 *           example: true
 */
export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  street!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state!: string;

  // Explicit null clears the stored value; the column is nullable.
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(20)
  @IsOptional()
  zipCode?: string | null;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateAddressDto:
 *       type: object
 *       description: Every field is optional; only the ones supplied are written.
 *       properties:
 *         street:
 *           type: string
 *           maxLength: 255
 *         city:
 *           type: string
 *           maxLength: 100
 *         state:
 *           type: string
 *           maxLength: 100
 *         zipCode:
 *           type: string
 *           nullable: true
 *           maxLength: 20
 *         isDefault:
 *           type: boolean
 *           description: Only `true` is meaningful — a user always keeps exactly one default.
 */
export class UpdateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  street?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  city?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  state?: string;

  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(20)
  @IsOptional()
  zipCode?: string | null;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
