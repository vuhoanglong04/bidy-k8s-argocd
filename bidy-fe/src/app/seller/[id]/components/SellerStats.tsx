import React from "react";
import type { SellerAuctionCounts } from "@/services/seller";

interface SellerStatsProps {
  auctionCounts?: SellerAuctionCounts;
}

export default function SellerStats({ auctionCounts }: SellerStatsProps) {
  const happening = auctionCounts?.happening ?? 0;
  const pending = auctionCounts?.pending ?? 0;
  const ended = auctionCounts?.ended ?? 0;

  const stats = [
    {
      label: "Phiên đang diễn ra",
      value: happening,
    },
    {
      label: "Phiên sắp diễn ra",
      value: pending,
    },
    {
      label: "Phiên đã kết thúc",
      value: ended,
    },
  ];

  return (
    <div className="w-full bg-background border border-border shadow-sm p-6 flex flex-col gap-4">
      <div className="text-base font-semibold text-foreground">
        Thống kê
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border shadow-sm flex items-center gap-4 px-6 py-4 min-h-[60px]"
          >
            <span className="text-2xl font-bold text-primary tabular-nums">
              {stat.value}
            </span>
            <span className="text-foreground text-sm font-medium">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
