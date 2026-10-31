"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";
import { OrderPaymentPanel } from "./OrderPaymentPanel";
import { getOrderAmount, type OrderItem } from "@/services/orders/orders.service";

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: OrderItem[];
  onPaid?: (paidOrderIds: string[]) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  selectedOrders,
  onPaid,
}: PaymentModalProps) {
  const [isSuccess, setIsSuccess] = useState(false);

  const handlePaid = (paidOrderIds: string[]) => {
    setIsSuccess(true);
    onPaid?.(paidOrderIds);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 2500);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("vi-VN") + " đ";
  };

  const totalSummaryAmount = selectedOrders.reduce(
    (sum, order) => sum + getOrderAmount(order),
    0
  );

  if (isSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md rounded-none border border-border bg-card p-8 text-center space-y-4">
          <div className="size-14 bg-primary/10 text-primary mx-auto flex items-center justify-center rounded-none">
            <CheckCircle2 className="size-8 text-primary animate-bounce" />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Xác nhận thanh toán thành công!
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Đơn hàng đã được ghi nhận thanh toán. Tiền được giữ an toàn tại Bidy (Escrow) cho đến khi bạn nhận hàng và kiểm tra hoàn tất.
          </DialogDescription>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none border border-border bg-card p-6">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg sm:text-xl font-bold uppercase tracking-tight text-foreground">
            Xác nhận thanh toán đơn hàng
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Chọn phương thức thanh toán phù hợp bằng Ví Bidy hoặc Chuyển khoản VietQR
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Order Summary Box */}
          <div className="border border-border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Danh sách đơn hàng ({selectedOrders.length})
              </span>
              <span className="text-xs text-muted-foreground">Miễn phí dịch vụ sàn</span>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {selectedOrders.map((order, index) => (
                <div
                  key={order.id}
                  className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-0"
                >
                  <span className="text-foreground truncate pr-4 text-xs font-medium">
                    {index + 1}. {order.bidId?.name || "Sản phẩm đấu giá"}
                  </span>
                  <span className="font-semibold text-foreground text-xs shrink-0">
                    {formatPrice(getOrderAmount(order))}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-3 flex items-baseline justify-between">
              <span className="text-sm font-bold text-foreground uppercase">
                Tổng giá trị đơn:
              </span>
              <span className="text-lg font-bold text-primary tracking-tight">
                {formatPrice(totalSummaryAmount)}
              </span>
            </div>
          </div>

          {/* Payment Panel */}
          <OrderPaymentPanel
            orders={selectedOrders}
            onPaid={handlePaid}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentModal;