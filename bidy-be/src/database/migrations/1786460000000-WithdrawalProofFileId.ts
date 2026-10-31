import { MigrationInterface, QueryRunner } from 'typeorm';

export class WithdrawalProofFileId1786460000000 implements MigrationInterface {
  name = 'WithdrawalProofFileId1786460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet_withdrawal_requests" DROP COLUMN IF EXISTS "proof_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_withdrawal_requests" ADD COLUMN IF NOT EXISTS "proof_file_id" bigint NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "wallet_withdrawal_requests"
      ADD CONSTRAINT "FK_wallet_withdrawal_requests_proof_file_id"
      FOREIGN KEY ("proof_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet_withdrawal_requests" DROP CONSTRAINT IF EXISTS "FK_wallet_withdrawal_requests_proof_file_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_withdrawal_requests" DROP COLUMN IF EXISTS "proof_file_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_withdrawal_requests" ADD COLUMN IF NOT EXISTS "proof_url" character varying(1024)`,
    );
  }
}
