import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFieldsToNotification1785651823369 implements MigrationInterface {
    name = 'AddFieldsToNotification1785651823369'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" ADD "category" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "priority" character varying(20) NOT NULL DEFAULT 'normal'`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "actionUrl" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "relatedData" jsonb`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "channels" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "channels"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "relatedData"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "actionUrl"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "priority"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "category"`);
    }

}
