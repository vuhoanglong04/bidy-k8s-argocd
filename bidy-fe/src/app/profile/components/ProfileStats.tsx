import React from "react";
import { UserStats } from "@/types";
import { formatVietnameseProductCount } from "@/utils";

interface ProfileStatsProps {
  isSeller: boolean;
  stats: UserStats;
}

interface StatCell {
  label: string;
  value: string;
}

/**
 * Dải số liệu thống kê hoạt động của người dùng.
 * Các ô chia nhau bằng đường kẻ mảnh, không khe hở — đọc như một bảng.
 */
const ProfileStats: React.FC<Readonly<ProfileStatsProps>> = ({
  isSeller,
  stats,
}) => {
  const cells: StatCell[] = isSeller
    ? [
        {
          label: "Đã bán",
          value: formatVietnameseProductCount(stats?.sell?.soldAmount),
        },
        {
          label: "Đang bán",
          value: formatVietnameseProductCount(stats?.sell?.sellingAmount),
        },
        {
          label: "Sắp bán",
          value: formatVietnameseProductCount(stats?.sell?.willSellAmount),
        },
      ]
    : [
        {
          label: "Đã mua",
          value: formatVietnameseProductCount(stats?.buy?.boughtAmount),
        },
        {
          label: "Đang đấu giá",
          value: formatVietnameseProductCount(stats?.buy?.biddingAmount),
        },
        {
          label: "Đang theo dõi",
          value: formatVietnameseProductCount(stats?.buy?.followAmount),
        },
      ];

  return (
    <section
      aria-label="Thống kê"
      className="grid grid-cols-1 border border-border bg-card sm:grid-cols-3"
    >
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={`p-6 ${
            index < cells.length - 1 ? "border-b border-border sm:border-b-0" : ""
          } ${index > 0 ? "sm:border-l sm:border-border" : ""}`}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-foreground-secondary">
            {cell.label}
          </p>
          <p className="mt-2 text-3xl font-bold leading-tight text-foreground tabular-nums">
            {cell.value}
          </p>
        </div>
      ))}
    </section>
  );
};

export default ProfileStats;
