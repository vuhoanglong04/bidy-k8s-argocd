import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every read of a conversation is "this conversation, newest first": the socket
 * history load and the REST message list both filter on conversation_id and order
 * by created_at. The existing single-column index on conversation_id gets Postgres
 * to the right rows but leaves it sorting them all in memory, which grows with the
 * conversation rather than with the page size.
 *
 * DESC matches the socket history query; Postgres can still scan it backwards for
 * the ASC REST query, so one index serves both.
 */
export class AddMessageConversationCreatedAtIndex1786380000000 implements MigrationInterface {
  name = 'AddMessageConversationCreatedAtIndex1786380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
       ON messages (conversation_id, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_conversation_created_at`);
  }
}
