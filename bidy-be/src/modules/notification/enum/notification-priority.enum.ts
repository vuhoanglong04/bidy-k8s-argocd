export enum NotificationPriority {
  NORMAL = "normal",
  HIGH = "high",
  // Nothing writes URGENT yet; it exists because GET /notifications/stats already
  // exposes `priorities.urgent` to clients. Drop it here and from the stats
  // response together, or start using it — do not leave the two disagreeing.
  URGENT = "urgent",
}
