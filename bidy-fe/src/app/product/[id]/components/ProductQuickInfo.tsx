"use client";

import {
  Package,
  Building2,
  Star,
  Banknote,
  Zap,
  TrendingUp,
  Info,
} from "lucide-react";
import { PRODUCT_CONDITION, PRODUCT_CONDITION_LABELS } from "@/constants/app.enum";

interface ProductQuickInfoProps {
  category: string;
  brand: string;
  condition: string;
  starterPrice: string;
  quickBuy?: string;
  currentPrice?: string;
}

function formatCurrency(amount: string): string {
  // Giá từ backend là chuỗi decimal ("1550000.00"); không được xoá dấu thập phân.
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "0 VNĐ";
  return Math.round(numericAmount).toLocaleString("vi-VN") + " VNĐ";
}

function InfoRow({
  icon: Icon,
  label,
  value,
  valueColor = "text-foreground",
  isPrice = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | { name?: string; displayName?: string; slug?: string } | null | undefined;
  valueColor?: string;
  isPrice?: boolean;
}) {
  const displayValue = typeof value === "object" && value !== null
    ? (value.name || value.displayName || value.slug || "Chưa phân loại")
    : String(value ?? "");

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <Icon size={16} className="text-foreground-secondary flex-shrink-0" />
        <span className="text-sm text-foreground-secondary truncate">{label}</span>
      </div>
      <span className={`text-sm font-semibold text-right ${valueColor}`}>
        {isPrice ? formatCurrency(displayValue) : displayValue}
      </span>
    </div>
  );
}

export default function ProductQuickInfo({
  category,
  brand,
  condition,
  starterPrice,
  quickBuy,
  currentPrice,
}: Readonly<ProductQuickInfoProps>) {
  // Tô màu theo tình trạng sản phẩm (mới → cũ), không phải trạng thái phiên đấu giá
  const getConditionColor = (value: string): string => {
    switch (value) {
      case PRODUCT_CONDITION_LABELS[PRODUCT_CONDITION.NEW]:
        return "text-success font-bold";
      case PRODUCT_CONDITION_LABELS[PRODUCT_CONDITION.LIKE_NEW]:
        return "text-info font-semibold";
      case PRODUCT_CONDITION_LABELS[PRODUCT_CONDITION.REFURBISHED]:
        return "text-warning font-semibold";
      default:
        return "text-foreground";
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Info size={16} className="text-foreground-secondary" />
        <h2 className="text-xs uppercase tracking-widest font-semibold text-foreground-secondary">
          Thông tin sản phẩm
        </h2>
      </div>

      <div className="flex flex-col">
        <InfoRow icon={Package} label="Phân loại" value={category} />
        <InfoRow icon={Building2} label="Thương hiệu" value={brand} />
        <InfoRow
          icon={Star}
          label="Tình trạng"
          value={condition}
          valueColor={getConditionColor(condition)}
        />
        <InfoRow
          icon={Banknote}
          label="Giá khởi điểm"
          value={starterPrice}
          isPrice
        />
        {quickBuy && (
          <InfoRow
            icon={Zap}
            label="Mua ngay"
            value={quickBuy}
            valueColor="text-warning font-bold"
            isPrice
          />
        )}
        {currentPrice && (
          <InfoRow
            icon={TrendingUp}
            label="Giá hiện tại"
            value={currentPrice}
            valueColor="text-primary font-bold"
            isPrice
          />
        )}
      </div>
    </div>
  );
}
