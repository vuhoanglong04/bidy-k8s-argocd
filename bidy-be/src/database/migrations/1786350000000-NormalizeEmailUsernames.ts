import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Rewrites usernames that are email addresses.
 *
 * Registration accepted any string as a username, so users who typed their email
 * into that box had it stored verbatim — and usernames are published (the bidder
 * list on an auction is a public endpoint), which quietly exposed their address.
 * USERNAME_PATTERN now rejects "@" at both write paths; this brings existing rows
 * up to the same rule.
 *
 * The new name is the part before the "@", falling back to a suffixed form when
 * that would collide with an existing username, clash with another row being
 * rewritten in this same pass, or come out too short.
 *
 * Affected users can still sign in: login accepts an email or a username, and the
 * email side is untouched. Anyone who was signing in with the email-shaped
 * username keeps working through the email branch.
 */
export class NormalizeEmailUsernames1786350000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            WITH candidate AS (
                SELECT
                    id,
                    regexp_replace(split_part(username, '@', 1), '[^a-zA-Z0-9._-]', '_', 'g') AS base
                FROM users
                WHERE username LIKE '%@%'
            ),
            resolved AS (
                SELECT
                    c.id,
                    CASE
                        WHEN length(c.base) < 3
                          OR COUNT(*) OVER (PARTITION BY c.base) > 1
                          OR EXISTS (
                              SELECT 1 FROM users u2
                              WHERE u2.username = c.base AND u2.id <> c.id
                          )
                        THEN left(c.base, 40) || '_' || c.id
                        ELSE left(c.base, 50)
                    END AS username
                FROM candidate c
            )
            UPDATE users u
            SET username = r.username
            FROM resolved r
            WHERE u.id = r.id
        `);
    }

    public async down(): Promise<void> {
        // Intentionally not reversible. The original values were email addresses in a
        // public column; restoring them would re-publish the addresses, and the local
        // part alone cannot reconstruct which domain each user had. Rolling back the
        // schema does not require rolling back this normalisation.
    }
}
