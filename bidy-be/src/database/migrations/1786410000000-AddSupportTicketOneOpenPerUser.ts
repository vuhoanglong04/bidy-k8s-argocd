import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "A user has at most one open support ticket" was only ever a service-level rule:
 * startOrGetUserChat did a findOne-then-insert, so two concurrent starts (the REST
 * route and the socket event, or a double-tapped button) both saw no open ticket and
 * both inserted one. The user then has two tickets, and which one they see depends on
 * row order.
 *
 * The rule is an integrity constraint, so it belongs in the database. A partial unique
 * index is the right shape: uniqueness applies only while status = 'open', which leaves
 * a user free to accumulate any number of closed tickets over time. Follows the
 * uq_categories_* partial indexes added in AddCategorySlugAndSoftDelete.
 */
export class AddSupportTicketOneOpenPerUser1786410000000 implements MigrationInterface {
  name = 'AddSupportTicketOneOpenPerUser1786410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Duplicates already in the table would make the index creation fail, so collapse
    // them first: the oldest open ticket per user is the survivor (it holds the start
    // of the conversation), its siblings' messages are moved onto it, and the now-empty
    // siblings are closed rather than deleted — a ticket row is a record that a user
    // asked for help, and dropping it loses that.
    await queryRunner.query(`
      WITH survivors AS (
        SELECT DISTINCT ON (user_id) id, user_id
        FROM support_tickets
        WHERE status = 'open'
        ORDER BY user_id, created_at ASC, id ASC
      ),
      losers AS (
        SELECT t.id, s.id AS survivor_id
        FROM support_tickets t
        JOIN survivors s ON s.user_id = t.user_id
        WHERE t.status = 'open' AND t.id <> s.id
      ),
      moved AS (
        UPDATE support_messages m
        SET ticket_id = l.survivor_id
        FROM losers l
        WHERE m.ticket_id = l.id
        RETURNING 1
      )
      UPDATE support_tickets t
      SET status = 'closed', updated_at = NOW()
      FROM losers l
      WHERE t.id = l.id
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_support_tickets_user_open" ON "support_tickets" ("user_id") WHERE "status" = 'open'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The merge in up() is not reversible — collapsed tickets cannot be told apart
    // afterwards. Dropping the index restores the old (unconstrained) schema only.
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_support_tickets_user_open"`);
  }
}
