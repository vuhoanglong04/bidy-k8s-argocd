/**
 * Escapes the LIKE/ILIKE wildcards in a user-supplied search term.
 *
 * Parameter binding stops injection but does not stop `%` and `_` from being read
 * as wildcards, so an unescaped one-character search matches every row.
 */
export function escapeLike(str: string): string {
  return str.replace(/[\\%_]/g, String.raw`\$&`);
}
