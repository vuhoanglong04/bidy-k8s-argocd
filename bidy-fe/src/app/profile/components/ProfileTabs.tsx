import React from "react";
import { cn } from "@/lib/utils";

interface ProfileTabsProps {
  tab: string;
  setTab: (tab: string) => void;
}

const ROLES = [
  { value: "seller", label: "Người bán" },
  { value: "buyer", label: "Người mua" },
] as const;

/** Segmented control chuyển vai trò của trang tổng quan. */
const ProfileTabs: React.FC<Readonly<ProfileTabsProps>> = ({ tab, setTab }) => (
  <div
    role="tablist"
    aria-label="Vai trò"
    className="inline-flex border border-border bg-background p-0.5"
  >
    {ROLES.map((role) => {
      const active = tab === role.value;
      return (
        <button
          key={role.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => setTab(role.value)}
          className={cn(
            "cursor-pointer px-4 py-1.5 text-sm font-medium transition-colors",
            active
              ? "bg-primary text-primary-foreground"
              : "text-foreground-secondary hover:text-foreground"
          )}
        >
          {role.label}
        </button>
      );
    })}
  </div>
);

export default ProfileTabs;
