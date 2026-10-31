export enum NotificationType {
  AUCTION_STARTED = "auction_started",
  AUCTION_ENDING_SOON = "auction_ending_soon",
  AUCTION_WON = "auction_won",
  AUCTION_LOST = "auction_lost",
  NEW_BID = "new_bid",
  BID_OUTBID = "bid_outbid",
  PAYMENT_REMINDER = "payment_reminder",
  // Locked/unlocked is the payment-overdue lock the deadline job applies and lifts.
  // Suspended/banned is an admin decision and a different thing to the reader, so it
  // is a different type rather than a reuse of the same one.
  ACCOUNT_LOCKED = "account_locked",
  ACCOUNT_UNLOCKED = "account_unlocked",
  ACCOUNT_SUSPENDED = "account_suspended",
  ACCOUNT_BANNED = "account_banned",
  // An admin's ruling on a seller's request to list a product. Approved carries the
  // auction id so the client can jump straight to the live listing; rejected carries
  // the reason, which is the whole point of telling them.
  AUCTION_REQUEST_APPROVED = "auction_request_approved",
  AUCTION_REQUEST_REJECTED = "auction_request_rejected",
  SYSTEM_MAINTENANCE = "system_maintenance",
  PAYMENT_RELEASED = "payment_released",
  WITHDRAWAL_COMPLETED = "withdrawal_completed",
  WITHDRAWAL_REJECTED = "withdrawal_rejected",
  TOPUP_SUCCESS = "topup_success",
  WITHDRAWAL_SLA_OVERDUE = "withdrawal_sla_overdue",
  WALLET_RECONCILIATION_FAILED = "wallet_reconciliation_failed",
}
