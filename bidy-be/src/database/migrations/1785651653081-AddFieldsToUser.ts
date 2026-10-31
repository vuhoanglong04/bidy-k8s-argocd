import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFieldsToUser1785651653081 implements MigrationInterface {
    name = 'AddFieldsToUser1785651653081'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "full_name" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "identity" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "passwordResetToken" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "passwordResetExpires" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetExpires"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetToken"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "identity"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "full_name"`);
    }

}
