"use client";

import { DayPicker } from "react-day-picker";
import { vi } from "react-day-picker/locale";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Lịch dựa trên `react-day-picker`, restyle theo convention của dự án:
 * góc vuông, chỉ dùng semantic token, không icon — nút điều hướng là chữ.
 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: Readonly<CalendarProps>) {
  return (
    <DayPicker
      locale={vi}
      showOutsideDays={showOutsideDays}
      className={cn("w-fit", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold capitalize text-foreground",
        nav: "flex items-center justify-between absolute inset-x-0 top-0 h-8 px-0",
        button_previous:
          "h-8 border border-border px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:text-btn-disabled-text",
        button_next:
          "h-8 border border-border px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:text-btn-disabled-text",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "size-9 p-0 text-center text-sm",
        day_button:
          "size-9 font-normal text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        today: "font-semibold text-primary",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary-hover",
        outside: "[&>button]:text-muted-foreground/60",
        disabled: "[&>button]:cursor-not-allowed [&>button]:text-btn-disabled-text",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        // Không dùng icon: nút điều hướng hiển thị bằng chữ.
        Chevron: ({ orientation }) => (
          <span aria-hidden>{orientation === "left" ? "Trước" : "Sau"}</span>
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
