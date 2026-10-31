"use client";

import React, { useState, useEffect } from "react";

import type { AuctionRequest, UpdateAuctionRequestBody } from "@/services/auction-request";
import { getValidText, toInputDateTime } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EditAuctionRequestTermsDialogProps {
  request: AuctionRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (body: UpdateAuctionRequestBody) => void;
  isPending: boolean;
}

export function EditAuctionRequestTermsDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: EditAuctionRequestTermsDialogProps) {
  const [formData, setFormData] = useState<{
    quantity: number;
    startingPrice: number;
    buyNowPrice: string;
    reservePrice: string;
    bidIncrement: string;
    startDate: string;
    endDate: string;
  }>({
    quantity: 1,
    startingPrice: 0,
    buyNowPrice: "",
    reservePrice: "",
    bidIncrement: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (request && open) {
      setFormData({
        quantity: request.quantity ?? 1,
        startingPrice: request.startingPrice ?? 0,
        buyNowPrice:
          request.buyNowPrice !== null && request.buyNowPrice !== undefined
            ? String(request.buyNowPrice)
            : "",
        reservePrice:
          request.reservePrice !== null && request.reservePrice !== undefined
            ? String(request.reservePrice)
            : "",
        bidIncrement:
          request.bidIncrement !== null && request.bidIncrement !== undefined
            ? String(request.bidIncrement)
            : "",
        startDate: toInputDateTime(request.startDate),
        endDate: toInputDateTime(request.endDate),
      });
    }
  }, [request, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    const body: UpdateAuctionRequestBody = {
      quantity: formData.quantity > 0 ? formData.quantity : 1,
      startingPrice: formData.startingPrice,
      buyNowPrice: formData.buyNowPrice.trim() ? Number(formData.buyNowPrice) : null,
      reservePrice: formData.reservePrice.trim() ? Number(formData.reservePrice) : null,
      bidIncrement: formData.bidIncrement.trim() ? Number(formData.bidIncrement) : null,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : request.startDate,
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : request.endDate,
    };

    onConfirm(body);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-none">
        <DialogHeader>
          <DialogTitle>Sửa điều khoản yêu cầu đăng phiên</DialogTitle>
          <DialogDescription>
            Cập nhật giá, số lượng hoặc thời gian của yêu cầu &quot;{getValidText(request?.product?.name)}&quot;
            trước khi duyệt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-quantity" className="text-xs font-semibold uppercase text-muted-foreground">
                Số lượng
              </label>
              <Input
                id="edit-quantity"
                type="number"
                min={1}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="rounded-none"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-startingPrice" className="text-xs font-semibold uppercase text-muted-foreground">
                Giá khởi điểm (VNĐ) <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-startingPrice"
                type="number"
                min={0}
                value={formData.startingPrice}
                onChange={(e) => setFormData({ ...formData, startingPrice: Number(e.target.value) })}
                className="rounded-none"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-buyNowPrice" className="text-xs font-semibold uppercase text-muted-foreground">
                Giá mua ngay (VNĐ)
              </label>
              <Input
                id="edit-buyNowPrice"
                type="number"
                min={0}
                placeholder="Để trống nếu không có"
                value={formData.buyNowPrice}
                onChange={(e) => setFormData({ ...formData, buyNowPrice: e.target.value })}
                className="rounded-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-reservePrice" className="text-xs font-semibold uppercase text-muted-foreground">
                Giá bảo lưu (VNĐ)
              </label>
              <Input
                id="edit-reservePrice"
                type="number"
                min={0}
                placeholder="Để trống nếu không có"
                value={formData.reservePrice}
                onChange={(e) => setFormData({ ...formData, reservePrice: e.target.value })}
                className="rounded-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-bidIncrement" className="text-xs font-semibold uppercase text-muted-foreground">
                Bước giá (VNĐ)
              </label>
              <Input
                id="edit-bidIncrement"
                type="number"
                min={0}
                placeholder="Để trống nếu không có"
                value={formData.bidIncrement}
                onChange={(e) => setFormData({ ...formData, bidIncrement: e.target.value })}
                className="rounded-none"
              />
            </div>
            <div />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-startDate" className="text-xs font-semibold uppercase text-muted-foreground">
                Thời gian bắt đầu <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-startDate"
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="rounded-none"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-endDate" className="text-xs font-semibold uppercase text-muted-foreground">
                Thời gian kết thúc <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-endDate"
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="rounded-none"
                required
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
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
              variant="default"
              className="rounded-none cursor-pointer"
              disabled={isPending}
            >
              {isPending ? "Đang lưu…" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditAuctionRequestTermsDialog;
