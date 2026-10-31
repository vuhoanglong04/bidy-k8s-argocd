import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The users table carried a UNIQUE constraint on `fullname`, so the second person
 * to register with a name already in the table was rejected with
 * `duplicate key value violates unique constraint "users_fullname_key"`.
 *
 * Full names are not identifiers — only email and username are, and both already
 * have their own unique constraints. The name also gives it away as hand-written
 * schema rather than entity-derived: TypeORM emits `UQ_<hash>` names, and
 * User.fullname declares no `unique: true`.
 */
export class DropUsersFullnameUnique1786310000000 implements MigrationInterface {
  name = 'DropUsersFullnameUnique1786310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_fullname_key`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restores the previous state, but only succeeds while no two users share a
    // full name — which is exactly the situation this migration exists to allow.
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT users_fullname_key UNIQUE (fullname)`);
  }
}
