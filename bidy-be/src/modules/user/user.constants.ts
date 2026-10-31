/**
 * What a username may contain.
 *
 * Deliberately excludes "@" so a username can never be an email address. Usernames
 * are shown publicly — the bidder list on an auction is open to anyone — while an
 * email is private, and registration used to accept one as the other, quietly
 * publishing the address of anyone who typed it into the wrong box.
 *
 * Kept beside the entity because both registration and the admin profile update
 * write this column and must agree; a rule enforced on only one of them is no rule.
 */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;

export const USERNAME_RULE_MESSAGE =
  'Username may only contain letters, numbers, dot, underscore and hyphen — an email address is not a valid username';
