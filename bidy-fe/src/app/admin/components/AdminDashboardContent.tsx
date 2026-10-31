"use client";

import React, { useState } from "react";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import { ArrowUpRight, Gavel, Layers, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  useAdminAuctions,
  useAdminOverviewAuctions,
  useAdminOverviewCategories,
  useAdminOverviewUsers,
  useAdminStatisticAuctions,
  useAdminStatisticUsers,
} from "@/services/admin";
import { formatCurrency, getImageURL, getValidNumber, getValidText } from "@/utils";
import { AdminAuction, AdminStatisticPoint, AdminUser } from "@/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { YearSelect } from "@/app/admin/components/YearSelect";
import AdminPanel from "./AdminPanel";
import StatTile from "./StatTile";
import { AuctionStatusPill, UserStatusPill } from "./StatusPill";

interface AdminDashboardContentProps {
  setTab?: (tab: string) => void;
  setSelectedAuctionId?: (id: string | null) => void;
  setSelectedUserId?: (id: string | null) => void;
  users: AdminUser[];
}

/** Tooltip của recharts, dùng token thay vì style mặc định. */
const chartTooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 0,
  color: "var(--popover-foreground)",
  fontSize: 12,
} as const;

function MonthlyAreaChart({
  data,
  seriesName,
  color,
}: {
  data: AdminStatisticPoint[];
  seriesName: string;
  color: string;
}) {
  const gradientId = `admin-chart-${seriesName.replace(/\s+/g, "-")}`;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: "var(--border)" }} />
        <Area
          type="monotone"
          dataKey="amount"
          name={seriesName}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function AdminDashboardContent({
  setTab,
  setSelectedAuctionId,
  setSelectedUserId,
  users,
}: AdminDashboardContentProps) {
  const { overviewUsers } = useAdminOverviewUsers();
  const { overviewAuctions } = useAdminOverviewAuctions();
  const { overviewCategories } = useAdminOverviewCategories();
  const { auctions: products } = useAdminAuctions({ page: 1, limit: 4 });
  const currentYear = new Date().getFullYear().toString();

  const [yearAuction, setYearAuction] = useState(currentYear);
  const [yearUser, setYearUser] = useState(currentYear);
  const { statisticsAuctions } = useAdminStatisticAuctions(yearAuction);
  const { statisticsUsers } = useAdminStatisticUsers(yearUser);

  const openProduct = (auctionId: string | null) => {
    setSelectedAuctionId?.(auctionId);
    setTab?.("products");
  };

  const openUser = (userId: string | null) => {
    setSelectedUserId?.(userId);
    setTab?.("users");
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Hàng số liệu ---------- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          label="Người dùng"
          value={getValidNumber(overviewUsers?.totalUser).toLocaleString("vi-VN")}
          icon={<Users size={16} />}
          breakdown={[
            {
              label: "Đang hoạt động",
              value: getValidNumber(overviewUsers?.activeUser),
              tone: "success",
            },
            {
              label: "Tạm khoá",
              value: getValidNumber(overviewUsers?.suspendedUser),
              tone: "warning",
            },
          ]}
        />
        <StatTile
          label="Phiên đấu giá"
          value={getValidNumber(overviewAuctions?.totalAuction).toLocaleString("vi-VN")}
          icon={<Gavel size={16} />}
          breakdown={[
            {
              label: "Đang diễn ra",
              value: getValidNumber(overviewAuctions?.happeningAuction),
              tone: "success",
            },
            {
              label: "Đã kết thúc",
              value: getValidNumber(overviewAuctions?.endedAuction),
              tone: "muted",
            },
          ]}
        />
        <StatTile
          label="Danh mục"
          value={getValidNumber(overviewCategories?.totalCategories).toLocaleString(
            "vi-VN"
          )}
          icon={<Layers size={16} />}
          breakdown={[
            {
              label: "Đang hiển thị",
              value: getValidNumber(overviewCategories?.activeCategories),
              tone: "success",
            },
            {
              label: "Đang ẩn",
              value: getValidNumber(overviewCategories?.inactiveCategories),
              tone: "muted",
            },
          ]}
        />
      </div>

      {/* ---------- Biểu đồ ---------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <AdminPanel
          title="Phiên đấu giá theo tháng"
          action={<YearSelect value={yearAuction} onChange={setYearAuction} />}
        >
          <MonthlyAreaChart
            data={statisticsAuctions ?? []}
            seriesName="Phiên đấu giá"
            color="var(--primary)"
          />
        </AdminPanel>

        <AdminPanel
          title="Người dùng mới theo tháng"
          action={<YearSelect value={yearUser} onChange={setYearUser} />}
        >
          <MonthlyAreaChart
            data={statisticsUsers ?? []}
            seriesName="Người dùng"
            color="var(--info)"
          />
        </AdminPanel>
      </div>

      {/* ---------- Hoạt động gần đây ---------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <AdminPanel
          title="Phiên đấu giá gần đây"
          action={
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer text-primary hover:text-primary-hover"
              onClick={() => openProduct(null)}
            >
              Xem tất cả <ArrowUpRight size={14} />
            </Button>
          }
          flush
        >
          {products?.length ? (
            <ul className="divide-y divide-border">
              {products.map((product: AdminAuction) => (
                <li
                  key={product.id}
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-accent"
                  onClick={() => openProduct(product.id)}
                >
                  <div className="relative size-12 shrink-0 overflow-hidden bg-muted">
                    <ImageWithFallback
                      src={getImageURL(product.product?.primaryImage ?? undefined)}
                      alt={getValidText(product.product?.name)}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {getValidText(product.product?.name)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {getValidText(product.category?.name)} ·{" "}
                      {getValidText(product.seller?.fullname)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(product.currentPrice)}
                    </span>
                    <AuctionStatusPill status={product.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Chưa có phiên đấu giá nào.
            </p>
          )}
        </AdminPanel>

        <AdminPanel
          title="Người dùng mới"
          action={
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer text-primary hover:text-primary-hover"
              onClick={() => openUser(null)}
            >
              Xem tất cả <ArrowUpRight size={14} />
            </Button>
          }
          flush
        >
          {users?.length ? (
            <ul className="divide-y divide-border">
              {users.slice(0, 4).map((user: AdminUser) => (
                <li
                  key={user.id}
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-accent"
                  onClick={() => openUser(user.id)}
                >
                  <Avatar className="size-10">
                    <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-accent text-sm font-semibold text-foreground">
                      {getValidText(user.fullname).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {getValidText(user.fullname)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {getValidText(user.email)}
                    </p>
                  </div>
                  <UserStatusPill status={user.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Chưa có người dùng nào.
            </p>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
