import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsReadToSupportMessage1785651337136 implements MigrationInterface {
    name = 'AddIsReadToSupportMessage1785651337136'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "support_messages" ADD "is_read" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "support_messages" DROP COLUMN "is_read"`);
    }

}
