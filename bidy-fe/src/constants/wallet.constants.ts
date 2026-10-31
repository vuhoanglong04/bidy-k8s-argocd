export const LEDGER_TYPE_CONFIG: Record<
  string,
  { label: string; description: string }
> = {
  topup_success: {
    label: "Nạp tiền thành công",
    description: "Nạp tiền vào ví qua chuyển khoản ngân hàng",
  },
  payment: {
    label: "Thanh toán đơn hàng",
    description: "Trừ tiền thanh toán đơn hàng",
  },
  payment_escrow_in: {
    label: "Tạm giữ thanh toán",
    description: "Tiền vào ví ký quỹ bảo đảm",
  },
  payment_release: {
    label: "Nhận tiền bán hàng",
    description: "Doanh thu bán hàng sau khi trừ phí",
  },
  payment_escrow_out: {
    label: "Giải phóng tạm giữ",
    description: "Tiền rời khỏi ký quỹ",
  },
  platform_fee: {
    label: "Phí nền tảng",
    description: "Phí dịch vụ nền tảng",
  },
  payment_refund: {
    label: "Hoàn tiền đơn hàng",
    description: "Hoàn trả tiền cho người mua",
  },
  withdraw_hold: {
    label: "Yêu cầu rút tiền",
    description: "Tạm giữ số dư để xử lý rút tiền",
  },
  withdraw_success: {
    label: "Rút tiền thành công",
    description: "Chuyển khoản rút tiền hoàn tất",
  },
  withdraw_failed: {
    label: "Rút tiền thất bại",
    description: "Yêu cầu rút tiền bị từ chối, đã hoàn lại tiền",
  },
  withdraw_cancelled: {
    label: "Huỷ yêu cầu rút tiền",
    description: "Yêu cầu rút tiền đã bị huỷ, đã hoàn lại tiền",
  },
  adjustment: {
    label: "Điều chỉnh số dư",
    description: "Điều chỉnh thủ công từ quản trị viên",
  },
};

export const LEDGER_TYPES = [
  { value: "all", label: "Tất cả loại giao dịch" },
  { value: "topup_success", label: "Nạp tiền thành công" },
  { value: "payment", label: "Thanh toán đơn hàng" },
  { value: "payment_escrow_in", label: "Tạm giữ thanh toán" },
  { value: "payment_release", label: "Nhận tiền bán hàng" },
  { value: "payment_escrow_out", label: "Giải phóng tạm giữ" },
  { value: "platform_fee", label: "Phí nền tảng" },
  { value: "payment_refund", label: "Hoàn tiền đơn hàng" },
  { value: "withdraw_hold", label: "Yêu cầu rút tiền" },
  { value: "withdraw_success", label: "Rút tiền thành công" },
  { value: "withdraw_failed", label: "Rút tiền thất bại" },
  { value: "withdraw_cancelled", label: "Huỷ yêu cầu rút tiền" },
  { value: "adjustment", label: "Điều chỉnh số dư" },
] as const;

export const WITHDRAWAL_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Chờ xử lý",
    className: "border-warning text-warning bg-warning/10",
  },
  processing: {
    label: "Đang xử lý",
    className: "border-info text-info bg-info/10",
  },
  completed: {
    label: "Thành công",
    className: "border-success text-success bg-success/10",
  },
  rejected: {
    label: "Bị từ chối",
    className: "border-destructive text-destructive bg-destructive/10",
  },
  cancelled: {
    label: "Đã huỷ",
    className: "border-border text-muted-foreground bg-muted/40",
  },
};
