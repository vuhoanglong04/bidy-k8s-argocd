import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFieldsToBidHistory1785652007306 implements MigrationInterface {
    name = 'AddFieldsToBidHistory1785652007306'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bid_history" ADD "position" integer`);
        await queryRunner.query(`ALTER TABLE "bid_history" ADD "metadata" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bid_history" DROP COLUMN "metadata"`);
        await queryRunner.query(`ALTER TABLE "bid_history" DROP COLUMN "position"`);
    }

}
