import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminUserManagement1786271000000 implements MigrationInterface {
  name = 'AdminUserManagement1786271000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new tracking columns to the users table
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_until" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status_reason" character varying(500)`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_required" boolean NOT NULL DEFAULT false`
    );

    // 2. Create the admin_audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
        "id" BIGSERIAL NOT NULL,
        "admin_id" bigint NOT NULL,
        "target_user_id" bigint,
        "action" character varying(100) NOT NULL,
        "reason" text,
        "old_values" jsonb,
        "new_values" jsonb,
        "metadata" jsonb,
        "ip_address" character varying(45),
        "user_agent" character varying(1024),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Indexes for admin_audit_logs
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_admin_id" ON "admin_audit_logs" ("admin_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_target_user_id" ON "admin_audit_logs" ("target_user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_action" ON "admin_audit_logs" ("action")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_created_at" ON "admin_audit_logs" ("created_at")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_target_user_created" ON "admin_audit_logs" ("target_user_id", "created_at")`
    );

    // Foreign Keys for admin_audit_logs
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" DROP CONSTRAINT IF EXISTS "FK_admin_audit_logs_admin"`
    );
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "FK_admin_audit_logs_admin" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );

    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" DROP CONSTRAINT IF EXISTS "FK_admin_audit_logs_target"`
    );
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "FK_admin_audit_logs_target" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );

    // 3. Create user_sessions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" bigint NOT NULL,
        "refresh_token_hash" character varying(255) NOT NULL,
        "ip_address" character varying(45),
        "user_agent" character varying(1024),
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_sessions" PRIMARY KEY ("id")
      )
    `);

    // Indexes for user_sessions
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_session_user_id" ON "user_sessions" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_session_expires_at" ON "user_sessions" ("expires_at")`
    );

    // Foreign Keys for user_sessions
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT IF EXISTS "FK_user_sessions_user"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_user_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop user_sessions
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT IF EXISTS "FK_user_sessions_user"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sessions"`);

    // 2. Drop admin_audit_logs
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" DROP CONSTRAINT IF EXISTS "FK_admin_audit_logs_target"`
    );
    await queryRunner.query(
      `ALTER TABLE "admin_audit_logs" DROP CONSTRAINT IF EXISTS "FK_admin_audit_logs_admin"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);

    // 3. Remove new columns from users
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_required"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "status_reason"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "suspended_until"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "locked_until"`
    );
  }
}
