"use client";

import React, { useState } from "react";
import {
  CreditCard,
  ArrowUpFromLine,
  Percent,
  Users,
  Calendar,
  RotateCcw,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import { useAdminWalletOverview } from "@/services/admin-wallet";
import { formatCurrency, getValidNumber } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/common/loading";
import AdminPanel from "./AdminPanel";
import StatTile from "./StatTile";

/** Tooltip của recharts dùng token theme */
const chartTooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 0,
  color: "var(--popover-foreground)",
  fontSize: 12,
} as const;

export default function AdminFinanceOverview() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [appliedParams, setAppliedParams] = useState<{
    from?: string;
    to?: string;
  }>({});

  const { data, isLoading, isError, error, refetch } =
    useAdminWalletOverview(appliedParams);

  const handleApplyFilter = () => {
    setAppliedParams({
      from: from || undefined,
      to: to || undefined,
    });
  };

  const handleResetFilter = () => {
    setFrom("");
    setTo("");
    setAppliedParams({});
  };

  const totals = data?.totals;
  const dailySummaries = data?.dailySummaries ?? [];

  // Chuẩn bị dữ liệu cho biểu đồ (đảo ngược để hiển thị theo thứ tự thời gian tăng dần)
  const chartData = [...dailySummaries]
    .reverse()
    .map((item) => ({
      date: item.summaryDate,
      topup: getValidNumber(item.totalTopup),
      payment: getValidNumber(item.totalPayment),
      withdraw: getValidNumber(item.totalWithdraw),
      platformFee: getValidNumber(item.totalPlatformFee),
    }));

  return (
    <div className="flex flex-col gap-5">
      {/* Bộ lọc ngày */}
      <AdminPanel
        title="Bộ lọc thời gian"
        description="Lọc báo cáo tổng hợp tài chính theo khoảng thời gian"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Từ:</span>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 w-36 rounded-none text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Đến:</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 w-36 rounded-none text-xs"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleApplyFilter}
              className="h-9 cursor-pointer rounded-none text-xs font-semibold"
            >
              <Calendar size={14} className="mr-1.5" /> Áp dụng
            </Button>
            {(appliedParams.from || appliedParams.to) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilter}
                className="h-9 cursor-pointer rounded-none text-xs"
              >
                <RotateCcw size={14} className="mr-1.5" /> Đặt lại
              </Button>
            )}
          </div>
        }
      />

      <LoadingState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!data}
        onRetry={refetch}
        emptyMessage="Không có dữ liệu tài chính trong khoảng thời gian này."
      >
        {/* Số liệu tổng quan (Totals) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label="Tổng nạp tiền"
            value={formatCurrency(getValidNumber(totals?.totalTopup))}
            icon={<Wallet size={16} />}
          />
          <StatTile
            label="Tổng thanh toán đơn"
            value={formatCurrency(getValidNumber(totals?.totalPayment))}
            icon={<CreditCard size={16} />}
          />
          <StatTile
            label="Tiền yêu cầu rút"
            value={formatCurrency(getValidNumber(totals?.totalWithdraw))}
            icon={<ArrowUpFromLine size={16} />}
          />
          <StatTile
            label="Doanh thu phí sàn"
            value={formatCurrency(getValidNumber(totals?.totalPlatformFee))}
            icon={<Percent size={16} />}
          />
          <StatTile
            label="Ví có giao dịch (ngày gần nhất)"
            value={getValidNumber(totals?.activeWallets).toLocaleString("vi-VN")}
            icon={<Users size={16} />}
          />
        </div>

        {/* Biểu đồ xu hướng tài chính */}
        {chartData.length > 0 && (
          <AdminPanel
            title="Biến động dòng tiền theo ngày"
            description="Tổng tiền nạp, rút và phí sàn của từng ngày"
          >
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={chartData}
                margin={{ top: 12, right: 12, bottom: 0, left: -8 }}
              >
                <defs>
                  <linearGradient id="colorTopup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPayment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorWithdraw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--warning)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--info)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(val) =>
                    val >= 1_000_000
                      ? `${(val / 1_000_000).toFixed(1)}M`
                      : val >= 1_000
                      ? `${(val / 1_000).toFixed(0)}k`
                      : String(val)
                  }
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  cursor={{ stroke: "var(--border)" }}
                  formatter={(val: number, name: string) => {
                    const labels: Record<string, string> = {
                      topup: "Nạp tiền",
                      payment: "Thanh toán đơn",
                      withdraw: "Rút tiền",
                      platformFee: "Phí sàn",
                    };
                    return [formatCurrency(val), labels[name] || name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      topup: "Nạp tiền",
                      payment: "Thanh toán đơn",
                      withdraw: "Rút tiền",
                      platformFee: "Phí sàn",
                    };
                    return labels[value] || value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="topup"
                  name="topup"
                  stroke="var(--success)"
                  strokeWidth={2}
                  fill="url(#colorTopup)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="payment"
                  name="payment"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#colorPayment)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="withdraw"
                  name="withdraw"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  fill="url(#colorWithdraw)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="platformFee"
                  name="platformFee"
                  stroke="var(--info)"
                  strokeWidth={2}
                  fill="url(#colorFee)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </AdminPanel>
        )}

        {/* Bảng chi tiết tổng kết từng ngày */}
        <AdminPanel
          title="Tổng kết theo ngày"
          description="Số liệu được chốt lúc 8 giờ sáng mỗi ngày"
          flush
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Ngày</TableHead>
                <TableHead className="text-right">Nạp tiền</TableHead>
                <TableHead className="text-right">Thanh toán đơn</TableHead>
                <TableHead className="text-right">Rút tiền</TableHead>
                <TableHead className="text-right">Phí sàn thu</TableHead>
                <TableHead className="pr-5 text-right">Ví hoạt động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailySummaries.length > 0 ? (
                dailySummaries.map((item) => (
                  <TableRow key={item.id || item.summaryDate}>
                    <TableCell className="pl-5 font-mono text-xs font-semibold">
                      {item.summaryDate}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-success">
                      +{formatCurrency(getValidNumber(item.totalTopup))}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-primary">
                      {formatCurrency(getValidNumber(item.totalPayment))}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-warning">
                      -{formatCurrency(getValidNumber(item.totalWithdraw))}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-info">
                      {formatCurrency(getValidNumber(item.totalPlatformFee))}
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums text-muted-foreground">
                      {(item.activeWallets ?? 0).toLocaleString("vi-VN")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    Chưa có dữ liệu tổng kết theo ngày.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </AdminPanel>
      </LoadingState>
    </div>
  );
}
