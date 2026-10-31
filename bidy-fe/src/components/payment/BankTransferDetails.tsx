"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface BankTransferDetailsProps {
  qrCodeUrl?: string | null;
  bankInfo?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  } | null;
  amount: number | string;
  paymentCode: string;
  amountNote?: React.ReactNode;
  className?: string;
}

export function BankTransferDetails({
  qrCodeUrl,
  bankInfo,
  amount,
  paymentCode,
  amountNote,
  className,
}: BankTransferDetailsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formattedAmount =
    typeof amount === "number"
      ? amount.toLocaleString("vi-VN") + " đ"
      : Number(amount).toLocaleString("vi-VN") + " đ";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Khung QR và Chi tiết chuyển khoản */}
      <div className="flex flex-col md:flex-row items-center gap-6 border border-border bg-card p-4">
        {/* QR Code */}
        {qrCodeUrl && (
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="p-3 border border-border bg-card flex items-center justify-center">
              <Image
                src={qrCodeUrl}
                alt="VietQR Payment"
                width={180}
                height={180}
                className="w-44 h-44 object-contain"
                unoptimized
              />
            </div>
            <span className="text-[11px] text-muted-foreground font-medium text-center">
              Quét bằng ứng dụng Ngân hàng / Ví điện tử
            </span>
          </div>
        )}

        {/* Thông tin chuyển khoản */}
        <div className="flex-1 w-full space-y-2 text-xs">
          {bankInfo?.bankName && (
            <div className="flex items-center justify-between p-2.5 bg-background border border-border">
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Ngân hàng thụ hưởng
                </span>
                <span className="font-semibold text-foreground">
                  {bankInfo.bankName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(bankInfo.bankName || "", "bankName")}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Sao chép tên ngân hàng"
              >
                {copiedKey === "bankName" ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>
          )}

          {bankInfo?.accountNumber && (
            <div className="flex items-center justify-between p-2.5 bg-background border border-border">
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Số tài khoản
                </span>
                <span className="font-mono font-bold text-foreground text-sm tracking-wider">
                  {bankInfo.accountNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopy(bankInfo.accountNumber || "", "accNum")
                }
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Sao chép số tài khoản"
              >
                {copiedKey === "accNum" ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>
          )}

          {bankInfo?.accountName && (
            <div className="flex items-center justify-between p-2.5 bg-background border border-border">
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Chủ tài khoản
                </span>
                <span className="font-semibold text-foreground uppercase">
                  {bankInfo.accountName}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopy(bankInfo.accountName || "", "accName")
                }
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Sao chép tên chủ tài khoản"
              >
                {copiedKey === "accName" ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between p-2.5 bg-background border border-border">
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Số tiền cần chuyển
              </span>
              <span className="font-bold text-primary text-sm">
                {formattedAmount}
              </span>
              {amountNote && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {amountNote}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleCopy(String(amount), "amount")}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Sao chép số tiền"
            >
              {copiedKey === "amount" ? (
                <Check className="size-4 text-success" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-primary/5 border border-primary/30">
            <div>
              <span className="text-primary font-semibold block text-[11px]">
                Nội dung chuyển khoản (Bắt buộc)
              </span>
              <span className="font-mono font-bold text-primary text-sm tracking-wider">
                {paymentCode}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(paymentCode, "code")}
              className="p-1.5 text-primary hover:opacity-80 transition-opacity"
              title="Sao chép nội dung chuyển khoản"
            >
              {copiedKey === "code" ? (
                <Check className="size-4 text-success" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cảnh báo quan trọng */}
      <div className="border border-warning bg-warning/10 p-3.5 text-foreground flex items-start gap-2.5 text-xs">
        <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Lưu ý quan trọng về nội dung chuyển khoản:</p>
          <p className="text-muted-foreground leading-relaxed">
            Nội dung chuyển khoản phải chứa <strong>chính xác mã {paymentCode}</strong>.
            Nếu nhập sai nội dung, hệ thống sẽ không thể tự động nhận diện và cộng tiền vào tài khoản.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BankTransferDetails;
