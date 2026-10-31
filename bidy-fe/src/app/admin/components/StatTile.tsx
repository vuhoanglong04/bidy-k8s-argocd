import React from "react";

import { cn } from "@/lib/utils";

interface StatTileBreakdown {
  label: string;
  value: React.ReactNode;
  /** Chấm màu trạng thái đứng trước label. */
  tone?: "success" | "warning" | "destructive" | "info" | "muted";
}

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  breakdown?: StatTileBreakdown[];
  className?: string;
}

const dotToneClass: Record<NonNullable<StatTileBreakdown["tone"]>, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground",
};

/**
 * Ô số liệu của dashboard: một con số lớn + các dòng phân rã nhỏ bên dưới.
 */
export default function StatTile({
  label,
  value,
  icon,
  breakdown,
  className,
}: StatTileProps) {
  return (
    <div className={cn("border border-border bg-background p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {icon && (
          <span className="flex size-8 items-center justify-center bg-accent text-foreground-secondary">
            {icon}
          </span>
        )}
      </div>

      <div className="mt-3 text-3xl leading-none font-bold tabular-nums text-foreground">
        {value}
      </div>

      {breakdown && breakdown.length > 0 && (
        <dl className="mt-4 space-y-1.5 border-t border-border pt-3">
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    dotToneClass[item.tone ?? "muted"]
                  )}
                  aria-hidden
                />
                {item.label}
              </dt>
              <dd className="text-sm font-medium tabular-nums text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export type { StatTileProps, StatTileBreakdown };
