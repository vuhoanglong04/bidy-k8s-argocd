"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MoneyInput from "@/components/ui/MoneyInput";
import { BankTransferDetails } from "@/components/payment/BankTransferDetails";
import {
  useCreateWalletTopup,
  getTopupErrorMessage,
  type WalletTopupData,
} from "@/services/wallet";
import { useWalletTopupListener } from "@/hooks/useWalletTopupListener";
import { Spinner } from "@/components/common/loading";
import { toast } from "sonner";

export interface TopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAmount?: number;
  onCredited?: (amount: number) => void;
}

export function TopupDialog({
  open,
  onOpenChange,
  defaultAmount = 0,
  onCredited,
}: TopupDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [rawAmount, setRawAmount] = useState<string>("");
  const [numericAmount, setNumericAmount] = useState<number>(0);
  const [topupData, setTopupData] = useState<WalletTopupData | null>(null);

  const { mutate: createTopup, isPending } = useCreateWalletTopup();

  // Reset state when dialog opens or closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setTopupData(null);
      if (defaultAmount > 0) {
        const initialStr = defaultAmount.toLocaleString("vi-VN").replace(/,/g, ".");
        setRawAmount(initialStr);
        setNumericAmount(defaultAmount);
      } else {
        setRawAmount("");
        setNumericAmount(0);
      }
    } else {
      setStep(1);
      setTopupData(null);
      setRawAmount("");
      setNumericAmount(0);
    }
  }, [open, defaultAmount]);

  // Lắng nghe sự kiện nạp tiền ví thành công
  useWalletTopupListener((payload) => {
    if (open) {
      const creditedAmount = Number(payload.amount);
      toast.success(
        `Đã nạp ${creditedAmount.toLocaleString("vi-VN")} đ vào ví`
      );
      onCredited?.(creditedAmount);
      onOpenChange(false);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      toast.error("Vui lòng nhập số tiền nạp hợp lệ");
      return;
    }

    createTopup(numericAmount, {
      onSuccess: (data) => {
        setTopupData(data);
        setStep(2);
      },
      onError: (error) => {
        const msg = getTopupErrorMessage(error);
        toast.error(msg);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-border bg-card p-6 rounded-none">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold uppercase tracking-tight text-foreground">
            {step === 1 ? "Nạp tiền vào ví Bidy" : "Thông tin chuyển khoản nạp ví"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 1
              ? "Nhập số tiền bạn muốn nạp vào ví thông qua chuyển khoản VietQR tự động."
              : "Quét mã QR hoặc chuyển khoản theo thông tin bên dưới để nạp tiền vào ví."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <label
                htmlFor="topup-amount"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block"
              >
                Số tiền cần nạp
              </label>
              <MoneyInput
                id="topup-amount"
                value={rawAmount}
                onChange={(formatted, numeric) => {
                  setRawAmount(formatted);
                  setNumericAmount(numeric);
                }}
                placeholder="Nhập số tiền"
                suffix="đ"
                disabled={isPending}
                className="rounded-none text-base font-bold"
              />
            </div>

            {/* Quick selection chips */}
            <div className="flex flex-wrap gap-2">
              {[100000, 200000, 500000, 1000000, 2000000, 5000000].map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const str = preset
                        .toLocaleString("vi-VN")
                        .replace(/,/g, ".");
                      setRawAmount(str);
                      setNumericAmount(preset);
                    }}
                    disabled={isPending}
                    className="border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors rounded-none"
                  >
                    +{preset.toLocaleString("vi-VN")} đ
                  </button>
                )
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="rounded-none text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                disabled={isPending || numericAmount <= 0}
                className="rounded-none text-xs font-bold bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" tone="onColor" />
                    Đang tạo mã...
                  </span>
                ) : (
                  "Tạo mã chuyển khoản"
                )}
              </Button>
            </div>
          </form>
        )}

        {step === 2 && topupData && (
          <div className="space-y-4 pt-4">
            <BankTransferDetails
              qrCodeUrl={topupData.qrCodeUrl}
              bankInfo={topupData.bankInfo}
              amount={topupData.amount || numericAmount}
              paymentCode={topupData.paymentCode || ""}
              amountNote="Số tiền được cộng vào ví theo số tiền thực tế bạn chuyển, không theo số đã nhập."
            />

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="rounded-none text-xs"
              >
                Đổi số tiền
              </Button>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-none text-xs font-bold"
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TopupDialog;
