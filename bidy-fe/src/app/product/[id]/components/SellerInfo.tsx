import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "lucide-react";
import type { SellerProfile } from "@/services/seller";

interface SellerInfoProps {
  seller: SellerProfile;
  className?: string;
}

export default function SellerInfo({ seller, className = "" }: SellerInfoProps) {
  const displayName = seller.fullname || seller.username;
  const initial = displayName.charAt(0).toUpperCase();

  const formattedJoinDate = React.useMemo(() => {
    if (!seller.createdAt) return "";
    try {
      const date = new Date(seller.createdAt);
      if (isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("vi-VN", {
        month: "2-digit",
        year: "numeric",
      }).format(date);
    } catch {
      return "";
    }
  }, [seller.createdAt]);

  return (
    <aside className={`w-full flex flex-col gap-4 ${className}`}>
      <div className="bg-card border border-border shadow-sm p-6 flex flex-col items-center text-center gap-4">
        <div className="text-base font-semibold text-foreground w-full pb-3 border-b border-border">
          Thông tin người bán
        </div>

        <Avatar className="size-24 border-2 border-primary">
          <AvatarImage src={seller.avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-muted text-foreground text-xl font-bold">
            {initial}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col items-center gap-1">
          <h2 className="text-lg font-bold text-foreground">{displayName}</h2>
          <span className="text-sm text-foreground-secondary">@{seller.username}</span>
        </div>

        {formattedJoinDate && (
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary mt-1">
            <Calendar className="size-3.5 text-foreground-secondary" />
            <span>Tham gia từ tháng {formattedJoinDate}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
