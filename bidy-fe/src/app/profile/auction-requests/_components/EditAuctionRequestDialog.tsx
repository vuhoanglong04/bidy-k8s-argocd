"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MoneyInput, { getNumericValue } from "@/components/ui/MoneyInput";
import DateTimeField from "@/components/ui/DateTimeField";
import { Spinner } from "@/components/common/loading";
import { MAX_AUCTION_PRICE } from "@/constants";
import {
  useUpdateAuctionRequest,
  type AuctionRequest,
} from "@/services/auction-request";

interface EditAuctionRequestDialogProps {
  request: AuctionRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditAuctionRequestDialog({
  request,
  open,
  onOpenChange,
}: Readonly<EditAuctionRequestDialogProps>) {
  const updateMutation = useUpdateAuctionRequest();

  const [quantity, setQuantity] = useState("1");
  const [startingPrice, setStartingPrice] = useState("");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [bidIncrement, setBidIncrement] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (request) {
      setQuantity(String(request.quantity ?? 1));
      setStartingPrice(
        request.startingPrice
          ? request.startingPrice.toLocaleString("vi-VN").replace(/,/g, ".")
          : ""
      );
      setBuyNowPrice(
        request.buyNowPrice
          ? request.buyNowPrice.toLocaleString("vi-VN").replace(/,/g, ".")
          : ""
      );
      setBidIncrement(
        request.bidIncrement
          ? request.bidIncrement.toLocaleString("vi-VN").replace(/,/g, ".")
          : ""
      );
      setStartDate(request.startDate ? new Date(request.startDate) : null);
      setEndDate(request.endDate ? new Date(request.endDate) : null);
      setErrors({});
    }
  }, [request]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    const newErrors: Record<string, string> = {};
    const qtyNum = Number(quantity);
    const startNum = getNumericValue(startingPrice);
    const buyNowNum = buyNowPrice ? getNumericValue(buyNowPrice) : undefined;
    const incrementNum = bidIncrement ? getNumericValue(bidIncrement) : undefined;

    if (!Number.isInteger(qtyNum) || qtyNum < 1) {
      newErrors.quantity = "Số lượng phải là số nguyên từ 1 trở lên";
    }
    if (!startNum || startNum <= 0) {
      newErrors.startingPrice = "Vui lòng nhập giá khởi điểm";
    } else if (startNum > MAX_AUCTION_PRICE) {
      newErrors.startingPrice = `Giá khởi điểm không vượt quá ${Math.floor(MAX_AUCTION_PRICE).toLocaleString("vi-VN")} VNĐ`;
    }
    if (buyNowNum !== undefined) {
      if (buyNowNum <= startNum) {
        newErrors.buyNowPrice = "Giá mua ngay phải cao hơn giá khởi điểm";
      } else if (buyNowNum > MAX_AUCTION_PRICE) {
        newErrors.buyNowPrice = `Giá mua ngay không vượt quá ${Math.floor(MAX_AUCTION_PRICE).toLocaleString("vi-VN")} VNĐ`;
      }
    }
    if (incrementNum !== undefined) {
      if (incrementNum <= 0) {
        newErrors.bidIncrement = "Bước giá phải lớn hơn 0";
      } else if (incrementNum > MAX_AUCTION_PRICE) {
        newErrors.bidIncrement = `Bước giá không vượt quá ${Math.floor(MAX_AUCTION_PRICE).toLocaleString("vi-VN")} VNĐ`;
      }
    }
    if (!startDate) {
      newErrors.startDate = "Vui lòng chọn thời gian bắt đầu";
    }
    if (!endDate) {
      newErrors.endDate = "Vui lòng chọn thời gian kết thúc";
    } else if (startDate && endDate.getTime() <= startDate.getTime()) {
      newErrors.endDate = "Thời gian kết thúc phải sau thời gian bắt đầu";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateMutation.mutate(
      {
        id: request.id,
        body: {
          quantity: qtyNum,
          startingPrice: startNum,
          buyNowPrice: buyNowNum ?? null,
          bidIncrement: incrementNum ?? null,
          startDate: startDate!.toISOString(),
          endDate: endDate!.toISOString(),
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa yêu cầu đăng phiên</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin yêu cầu khi còn ở trạng thái chờ duyệt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="req-qty">Số lượng</Label>
            <Input
              id="req-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setErrors((prev) => ({ ...prev, quantity: "" }));
              }}
            />
            {errors.quantity && (
              <p className="text-xs text-destructive">{errors.quantity}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="req-starting-price">Giá khởi điểm</Label>
            <MoneyInput
              id="req-starting-price"
              value={startingPrice}
              onChange={(val) => {
                setStartingPrice(val);
                setErrors((prev) => ({ ...prev, startingPrice: "" }));
              }}
              error={Boolean(errors.startingPrice)}
            />
            {errors.startingPrice && (
              <p className="text-xs text-destructive">{errors.startingPrice}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="req-buynow-price">
              Giá mua ngay <span className="text-xs text-muted-foreground">(tuỳ chọn)</span>
            </Label>
            <MoneyInput
              id="req-buynow-price"
              value={buyNowPrice}
              onChange={(val) => {
                setBuyNowPrice(val);
                setErrors((prev) => ({ ...prev, buyNowPrice: "" }));
              }}
              error={Boolean(errors.buyNowPrice)}
            />
            {errors.buyNowPrice && (
              <p className="text-xs text-destructive">{errors.buyNowPrice}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="req-bid-increment">
              Bước giá <span className="text-xs text-muted-foreground">(tuỳ chọn)</span>
            </Label>
            <MoneyInput
              id="req-bid-increment"
              value={bidIncrement}
              onChange={(val) => {
                setBidIncrement(val);
                setErrors((prev) => ({ ...prev, bidIncrement: "" }));
              }}
              error={Boolean(errors.bidIncrement)}
            />
            {errors.bidIncrement && (
              <p className="text-xs text-destructive">{errors.bidIncrement}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Thời gian bắt đầu</Label>
            <DateTimeField
              value={startDate}
              onChange={(d) => {
                setStartDate(d);
                setErrors((prev) => ({ ...prev, startDate: "" }));
              }}
              invalid={Boolean(errors.startDate)}
            />
            {errors.startDate && (
              <p className="text-xs text-destructive">{errors.startDate}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Thời gian kết thúc</Label>
            <DateTimeField
              value={endDate}
              minDate={startDate ?? undefined}
              onChange={(d) => {
                setEndDate(d);
                setErrors((prev) => ({ ...prev, endDate: "" }));
              }}
              invalid={Boolean(errors.endDate)}
            />
            {errors.endDate && (
              <p className="text-xs text-destructive">{errors.endDate}</p>
            )}
          </div>

          <DialogFooter className="pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center justify-center border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex h-9 items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text"
            >
              {updateMutation.isPending && <Spinner size="xs" tone="onColor" />}
              Lưu thay đổi
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
