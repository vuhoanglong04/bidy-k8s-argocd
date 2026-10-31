"use client";

import React, { useState } from "react";
import {
  DollarSign,
  Layers,
  ArrowUpFromLine,
  SlidersHorizontal,
} from "lucide-react";

import { cn } from "@/lib/utils";
import AdminFinanceOverview from "./AdminFinanceOverview";
import AdminFinanceEscrow from "./AdminFinanceEscrow";
import AdminFinanceWithdrawals from "./AdminFinanceWithdrawals";
import AdminFinanceAdjustment from "./AdminFinanceAdjustment";

export type FinanceSubTab =
  | "overview"
  | "escrow"
  | "withdrawals"
  | "adjustment";

interface FinanceTabItem {
  key: FinanceSubTab;
  label: string;
  icon: React.ReactNode;
}

const FINANCE_TABS: FinanceTabItem[] = [
  {
    key: "overview",
    label: "Tổng quan tài chính",
    icon: <DollarSign size={16} />,
  },
  {
    key: "escrow",
    label: "Tiền tạm giữ",
    icon: <Layers size={16} />,
  },
  {
    key: "withdrawals",
    label: "Yêu cầu rút tiền",
    icon: <ArrowUpFromLine size={16} />,
  },
  {
    key: "adjustment",
    label: "Điều chỉnh số dư",
    icon: <SlidersHorizontal size={16} />,
  },
];

export default function AdminFinanceContent() {
  const [activeSubTab, setActiveSubTab] = useState<FinanceSubTab>("overview");

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-tabs header */}
      <div className="border-b border-border bg-card px-4 pt-2">
        <div
          role="tablist"
          aria-label="Quản lý tài chính sàn"
          className="-mb-px flex flex-wrap gap-2"
        >
          {FINANCE_TABS.map((tabItem) => {
            const isActive = activeSubTab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSubTab(tabItem.key)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tabItem.icon}
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab content */}
      <div className="min-h-[500px]">
        {activeSubTab === "overview" && <AdminFinanceOverview />}
        {activeSubTab === "escrow" && <AdminFinanceEscrow />}
        {activeSubTab === "withdrawals" && <AdminFinanceWithdrawals />}
        {activeSubTab === "adjustment" && <AdminFinanceAdjustment />}
      </div>
    </div>
  );
}
