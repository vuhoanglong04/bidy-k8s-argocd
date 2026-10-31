/**
 * Lifecycle of a seller's request to put a product on the block.
 *
 * Deliberately a separate table from `auctions` rather than an extra AuctionStatus:
 * auction statuses are driven by the clock (the lifecycle cron flips
 * pending → happening → ended), so a `pending_approval` auction would be pushed live
 * by that job, and every public query would have to remember to exclude it.
 */
export enum AuctionRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  /** Withdrawn by the seller before anyone reviewed it. */
  CANCELLED = 'cancelled',
}
