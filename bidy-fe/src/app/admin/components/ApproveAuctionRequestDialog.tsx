"use client";

import React from "react";

import { cn } from "@/lib/utils";
import type { AuctionRequest } from "@/services/auction-request";
import { getValidText, isScheduleExpired } from "@/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ApproveAuctionRequestDialogProps {
  request: AuctionRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function ApproveAuctionRequestDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: ApproveAuctionRequestDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-none">
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận duyệt yêu cầu đăng phiên?</AlertDialogTitle>
          <AlertDialogDescription>
            Hệ thống sẽ tạo phiên đấu giá chính thức cho sản phẩm &quot;
            {getValidText(request?.product?.name)}&quot;.
            {isScheduleExpired(request?.endDate) && (
              <span className="mt-2 block font-medium text-warning">
                Cảnh báo: Thời gian kết thúc của yêu cầu đã qua. Bạn có thể cần sửa lại lịch trước khi duyệt.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-none cursor-pointer">Đóng</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "default" }), "rounded-none cursor-pointer")}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Đang xử lý…" : "Xác nhận duyệt"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ApproveAuctionRequestDialog;
