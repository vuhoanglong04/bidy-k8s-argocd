"use client";

import React, { useState, useEffect } from "react";

import type { AuctionRequest } from "@/services/auction-request";
import { getValidText } from "@/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface RejectAuctionRequestDialogProps {
  request: AuctionRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

export function RejectAuctionRequestDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: RejectAuctionRequestDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !reason.trim()) return;
    onConfirm(reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle>Từ chối yêu cầu đăng phiên</DialogTitle>
          <DialogDescription>
            Vui lòng nhập lý do từ chối yêu cầu &quot;{getValidText(request?.product?.name)}&quot;.
            Người bán sẽ đọc được lý do này để chỉnh sửa và gửi lại.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reject-reason" className="text-xs font-semibold uppercase text-muted-foreground">
              Lý do từ chối <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="reject-reason"
              placeholder="Nhập lý do từ chối cụ thể (ví dụ: Giá khởi điểm chưa hợp lý, hình ảnh chưa rõ ràng...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="rounded-none"
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="rounded-none cursor-pointer"
              disabled={!reason.trim() || isPending}
            >
              {isPending ? "Đang xử lý…" : "Xác nhận từ chối"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default RejectAuctionRequestDialog;
