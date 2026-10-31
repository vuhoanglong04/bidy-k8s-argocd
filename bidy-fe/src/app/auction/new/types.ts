/** Giá giữ dạng chuỗi đã format của `MoneyInput`, quy về số khi gửi đi. */
export interface AuctionConfigState {
  productId: string;
  quantity: string;
  startingPrice: string;
  buyNowPrice: string;
  /** Bỏ trống = để backend áp mặc định của nó. */
  bidIncrement: string;
}

export type StartMode = "now" | "scheduled";

export interface AuctionScheduleState {
  startMode: StartMode;
  /** Chỉ dùng khi `startMode === "scheduled"`. */
  startDate: Date | null;
  endDate: Date | null;
}
