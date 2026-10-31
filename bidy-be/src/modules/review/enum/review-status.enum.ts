/**
 * Reviews are published the moment they are written — there is no pre-moderation
 * queue, because a queue nobody staffs is worse than none. `hidden` is the admin's
 * way to take a bad one down after the fact; every public read filters on
 * `published`, so hiding a review also drops it out of the seller's rating summary.
 */
export enum ReviewStatus {
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
}
