import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retires the `inactive` and `archived` product statuses.
 *
 * Both duplicated soft delete, which DELETE /api/v1/products/{id} already does, and
 * having two ways to take a product off the market meant the "cannot withdraw a
 * product carrying a live auction" rule had to be enforced on two separate doors —
 * it was enforced on one.
 *
 * The two existing statuses are NOT mapped the same way, because they meant
 * different things to the seller who set them:
 *
 *  - `inactive` was "hidden for now". The seller still wants the product, so it goes
 *    back to `draft` and they can publish it again. Soft-deleting these would throw
 *    away products people intend to sell.
 *  - `archived` was terminal — the seller was done with it. That is what soft delete
 *    means now, so those rows get a `deleted_at`.
 *
 * `updated_at` is used as the deletion timestamp rather than now(): it is when the
 * seller actually archived the product, and stamping every one of them with the
 * migration's own clock would lose that.
 */
export class RetireProductInactiveArchived1786470000000 implements MigrationInterface {
  name = 'RetireProductInactiveArchived1786470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Archived first: an archived row must not be caught by the inactive rule below.
    await queryRunner.query(`
      UPDATE "products"
      SET "deleted_at" = COALESCE("updated_at", now()), "status" = 'draft'
      WHERE "status" = 'archived' AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "products"
      SET "status" = 'draft'
      WHERE "status" = 'inactive'
    `);

    // Anything still holding a retired value would be unreadable by the entity, so
    // fail loudly here rather than at the first query that touches such a row.
    const stragglers = await queryRunner.query(`
      SELECT COUNT(*)::int AS count FROM "products" WHERE "status" NOT IN ('draft', 'active')
    `);
    if (stragglers[0]?.count > 0) {
      throw new Error(
        `RetireProductInactiveArchived: ${stragglers[0].count} products still carry a retired status`,
      );
    }
  }

  /**
   * Irreversible by design: once `inactive` and `archived` have collapsed into
   * `draft` and `deleted_at`, nothing in the row says which it used to be. Restoring
   * the column values would be a guess, and a guess that silently republished
   * products their owners had archived. Restore from a backup instead.
   */
  public async down(): Promise<void> {
    throw new Error(
      'RetireProductInactiveArchived cannot be reverted: the original status is not recoverable from the migrated rows.',
    );
  }
}
