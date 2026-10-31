import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateReviewReplyDto:
 *       type: object
 *       required:
 *         - comment
 *       properties:
 *         comment:
 *           type: string
 *           maxLength: 2000
 *           description: The reviewed seller's public reply. One reply per review.
 *           example: "Thanks for your feedback — glad the item arrived safely!"
 */
export class CreateReviewReplyDto {
  @IsString()
  @IsNotEmpty({ message: 'comment is required' })
  @MaxLength(2000, { message: 'comment must not exceed 2000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  comment!: string;
}
