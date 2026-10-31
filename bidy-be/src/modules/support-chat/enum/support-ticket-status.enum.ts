export enum SupportTicketStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

export const SUPPORT_TICKET_STATUSES = Object.values(SupportTicketStatus);
