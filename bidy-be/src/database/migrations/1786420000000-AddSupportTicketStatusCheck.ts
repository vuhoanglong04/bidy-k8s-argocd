import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * support_tickets.status was a free-form varchar, so updateChatStatus accepted any
 * string at all. That is worse than untidy: uq_support_tickets_user_open is a partial
 * index keyed on `status = 'open'`, and GET /support-chat/my-chat only looks for 'open'.
 * A single typo from the admin panel therefore hid the ticket from its own user AND
 * released the one-open-ticket-per-user constraint, letting them open a second.
 *
 * Validation now exists in three places, deliberately: the DTO rejects bad input on the
 * REST route, the service rejects it for the socket event that never passes through
 * Express middleware, and this constraint catches anything writing the column directly.
 * Follows chk_products_condition from CreateProductTables.
 */
export class AddSupportTicketStatusCheck1786420000000 implements MigrationInterface {
  name = 'AddSupportTicketStatusCheck1786420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Any row already holding a status outside the vocabulary would make the constraint
    // fail to apply. Those rows are the exact corruption this migration exists to stop,
    // and 'closed' is the honest reading of them: they are not open, and no code path
    // treats them as anything else.
    await queryRunner.query(`
      UPDATE support_tickets
      SET status = 'closed', updated_at = NOW()
      WHERE status NOT IN ('open', 'in_progress', 'resolved', 'closed')
    `);

    await queryRunner.query(`
      ALTER TABLE support_tickets
      ADD CONSTRAINT chk_support_tickets_status
      CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The normalisation in up() is not reversible — a status coerced to 'closed' cannot
    // be told from one that was already closed. Dropping the constraint restores the
    // old permissive schema only.
    await queryRunner.query(
      `ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS chk_support_tickets_status`,
    );
  }
}
