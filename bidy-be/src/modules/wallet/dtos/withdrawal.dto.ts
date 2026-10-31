import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateWithdrawalDto:
 *       type: object
 *       required:
 *         - amount
 *       properties:
 *         amount:
 *           type: string
 *           description: Amount to withdraw in VND decimal string (pays out 100%, no fee)
 *           example: "500000.00"
 *         bankAccountNo:
 *           type: string
 *           description: Destination bank account number
 *           example: "0123456789"
 *         bank_account_no:
 *           type: string
 *           description: Alias for bankAccountNo
 *           example: "0123456789"
 *         bankAccountName:
 *           type: string
 *           description: Bank account holder name
 *           example: "NGUYEN VAN A"
 *         bank_account_name:
 *           type: string
 *           description: Alias for bankAccountName
 *           example: "NGUYEN VAN A"
 *         bankCode:
 *           type: string
 *           description: Bank code (e.g. MB, VCB, TCB)
 *           example: "MB"
 *         bank_code:
 *           type: string
 *           description: Alias for bankCode
 *           example: "MB"
 */
export class CreateWithdrawalDto {
  @IsNotEmpty({ message: 'amount is required' })
  amount!: string | number;

  @IsOptional()
  @IsString({ message: 'bankAccountNo must be a string' })
  bankAccountNo?: string;

  @IsOptional()
  @IsString({ message: 'bank_account_no must be a string' })
  bank_account_no?: string;

  @IsOptional()
  @IsString({ message: 'bankAccountName must be a string' })
  bankAccountName?: string;

  @IsOptional()
  @IsString({ message: 'bank_account_name must be a string' })
  bank_account_name?: string;

  @IsOptional()
  @IsString({ message: 'bankCode must be a string' })
  bankCode?: string;

  @IsOptional()
  @IsString({ message: 'bank_code must be a string' })
  bank_code?: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     ListWithdrawalsDto:
 *       type: object
 *       properties:
 *         cursor:
 *           type: string
 *           description: Cursor for pagination
 *         limit:
 *           type: number
 *           description: Number of items to return
 *           example: 20
 */
export class ListWithdrawalsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminListWithdrawalsDto:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, rejected, cancelled]
 *           description: Filter by request status
 *         overdue:
 *           type: string
 *           description: Filter for pending/processing requests exceeding 10-day deadline (true/false)
 *           example: "true"
 *         cursor:
 *           type: string
 *           description: Cursor for pagination
 *         limit:
 *           type: number
 *           description: Number of items to return
 *           example: 20
 */
export class AdminListWithdrawalsDto {
  @IsOptional()
  @IsString()
  status?: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';

  @IsOptional()
  overdue?: string | boolean;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CompleteWithdrawalDto:
 *       type: object
 *       required:
 *         - proof_file_id
 *       properties:
 *         proof_file_id:
 *           type: string
 *           description: File ID of the bank transfer receipt uploaded via file module
 *           example: "12"
 *         proofFileId:
 *           type: string
 *           description: Alias for proof_file_id
 *           example: "12"
 */
export class CompleteWithdrawalDto {
  @IsOptional()
  @IsString({ message: 'proof_file_id must be a string' })
  @Matches(/^\d+$/, { message: 'proof_file_id must be a valid numeric ID' })
  proof_file_id?: string;

  @IsOptional()
  @IsString({ message: 'proofFileId must be a string' })
  @Matches(/^\d+$/, { message: 'proofFileId must be a valid numeric ID' })
  proofFileId?: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     RejectWithdrawalDto:
 *       type: object
 *       properties:
 *         reject_reason:
 *           type: string
 *           description: Reason for rejection
 *           example: "Invalid bank account details"
 *         rejectReason:
 *           type: string
 *           description: Alias for reject_reason
 *           example: "Invalid bank account details"
 */
export class RejectWithdrawalDto {
  @IsOptional()
  @IsString({ message: 'reject_reason must be a string' })
  reject_reason?: string;

  @IsOptional()
  @IsString({ message: 'rejectReason must be a string' })
  rejectReason?: string;
}
