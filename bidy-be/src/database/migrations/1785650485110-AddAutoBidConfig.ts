import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAutoBidConfig1785650485110 implements MigrationInterface {
    name = 'AddAutoBidConfig1785650485110'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "auto_bid_configs" ("id" BIGSERIAL NOT NULL, "auction_id" bigint NOT NULL, "user_id" bigint NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "limit_bid" numeric(12,2) NOT NULL, "increment_amount" numeric(12,2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a6a2d92f636403a93237356deb9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_810b256e7673de4448e19615e1" ON "auto_bid_configs"  ("auction_id", "user_id") `);
        await queryRunner.query(`ALTER TABLE "auctions" ADD "has_active_auto_bid" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "auto_bid_configs" ADD CONSTRAINT "FK_574eaccb29dc80c2c5628002509" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auto_bid_configs" ADD CONSTRAINT "FK_b4d73995cf6434a405afbfcf4f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auto_bid_configs" DROP CONSTRAINT "FK_b4d73995cf6434a405afbfcf4f4"`);
        await queryRunner.query(`ALTER TABLE "auto_bid_configs" DROP CONSTRAINT "FK_574eaccb29dc80c2c5628002509"`);
        await queryRunner.query(`ALTER TABLE "auctions" DROP COLUMN "has_active_auto_bid"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_810b256e7673de4448e19615e1"`);
        await queryRunner.query(`DROP TABLE "auto_bid_configs"`);
    }

}
