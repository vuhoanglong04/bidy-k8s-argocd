"use client";

import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateTimeFieldProps {
  /** `null` nghĩa là chưa chọn. */
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Không cho chọn ngày trước mốc này. */
  minDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
}

const toTimeString = (date: Date) => format(date, "HH:mm");

/**
 * Chọn ngày (popover + lịch) và giờ (input `time`) trong một field.
 *
 * Tách ngày và giờ ra hai control vì lịch không diễn tả được giờ, còn gõ tay cả
 * chuỗi ngày giờ thì dễ sai định dạng. Không dùng icon — nhãn đều là chữ.
 */
export default function DateTimeField({
  value,
  onChange,
  minDate,
  placeholder = "Chọn ngày",
  disabled = false,
  invalid = false,
  id,
  className,
}: Readonly<DateTimeFieldProps>) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectDate = (selected: Date | undefined) => {
    if (!selected) {
      onChange(null);
      return;
    }

    // Giữ nguyên giờ đang có; chưa chọn giờ thì mặc định 09:00 cho đỡ rơi vào
    // nửa đêm ngoài ý muốn.
    const next = new Date(selected);
    next.setHours(value?.getHours() ?? 9, value?.getMinutes() ?? 0, 0, 0);
    onChange(next);
    setIsOpen(false);
  };

  const handleChangeTime = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [hours, minutes] = event.target.value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;

    const next = new Date(value ?? new Date());
    next.setHours(hours, minutes, 0, 0);
    onChange(next);
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            className={cn(
              "h-9 min-w-48 flex-1 border px-3 text-left text-sm transition-colors",
              invalid ? "border-destructive" : "border-border",
              disabled
                ? "cursor-not-allowed bg-btn-disabled-bg text-btn-disabled-text"
                : "text-foreground hover:bg-accent"
            )}
          >
            {value
              ? format(value, "EEEE, dd/MM/yyyy", { locale: vi })
              : <span className="text-muted-foreground">{placeholder}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={handleSelectDate}
            defaultMonth={value ?? minDate ?? undefined}
            disabled={minDate ? { before: minDate } : undefined}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      <Input
        type="time"
        aria-label="Giờ"
        className="w-32"
        value={value ? toTimeString(value) : ""}
        onChange={handleChangeTime}
        disabled={disabled || !value}
      />
    </div>
  );
}
