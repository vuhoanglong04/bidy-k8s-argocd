"use client";

import { format } from "date-fns";
import { vi } from "date-fns/locale";

import DateTimeField from "@/components/ui/DateTimeField";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { AuctionScheduleState, StartMode } from "@/app/auction/new/types";

interface StepAuctionScheduleProps {
  value: AuctionScheduleState;
  errors: Partial<Record<keyof AuctionScheduleState, string>>;
  onChange: (patch: Partial<AuctionScheduleState>) => void;
  onBack: () => void;
  onContinue: () => void;
}

const START_MODES: ReadonlyArray<{ id: StartMode; label: string; hint: string }> = [
  { id: "now", label: "Đăng luôn", hint: "Phiên mở ngay khi bạn bấm đăng" },
  { id: "scheduled", label: "Hẹn giờ", hint: "Chọn thời điểm phiên bắt đầu" },
];

/** Nhanh chọn thời lượng phiên, tính từ lúc bắt đầu. */
const DURATION_PRESETS: ReadonlyArray<{ label: string; hours: number }> = [
  { label: "1 ngày", hours: 24 },
  { label: "3 ngày", hours: 72 },
  { label: "1 tuần", hours: 168 },
];

export default function StepAuctionSchedule({
  value,
  errors,
  onChange,
  onBack,
  onContinue,
}: Readonly<StepAuctionScheduleProps>) {
  const effectiveStart = value.startMode === "now" ? new Date() : value.startDate;

  const applyDuration = (hours: number) => {
    const base = effectiveStart ?? new Date();
    onChange({ endDate: new Date(base.getTime() + hours * 60 * 60 * 1000) });
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Thời gian</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Phiên mở lúc nào và đóng lúc nào. Sau khi có người đặt giá thì không
          đổi được nữa.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <Label>Bắt đầu</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {START_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={value.startMode === mode.id}
              onClick={() => onChange({ startMode: mode.id })}
              className={cn(
                "flex flex-1 flex-col border px-4 py-3 text-left transition-colors",
                value.startMode === mode.id
                  ? "border-primary bg-accent-subtle"
                  : "border-border hover:bg-accent"
              )}
            >
              <span className="text-sm font-semibold text-foreground">
                {mode.label}
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                {mode.hint}
              </span>
            </button>
          ))}
        </div>

        {value.startMode === "scheduled" && (
          <div className="flex flex-col gap-2">
            <DateTimeField
              id="auction-start"
              value={value.startDate}
              onChange={(next) => onChange({ startDate: next })}
              minDate={new Date()}
              placeholder="Chọn ngày bắt đầu"
              invalid={Boolean(errors.startDate)}
            />
            {errors.startDate && (
              <p className="text-sm text-destructive">{errors.startDate}</p>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <Label htmlFor="auction-end">
          Kết thúc <span className="text-destructive">*</span>
        </Label>

        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyDuration(preset.hours)}
              className="h-9 border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <DateTimeField
          id="auction-end"
          value={value.endDate}
          onChange={(next) => onChange({ endDate: next })}
          minDate={effectiveStart ?? new Date()}
          placeholder="Chọn ngày kết thúc"
          invalid={Boolean(errors.endDate)}
        />
        {errors.endDate && (
          <p className="text-sm text-destructive">{errors.endDate}</p>
        )}

        {effectiveStart && value.endDate && !errors.endDate && (
          <p className="text-xs text-muted-foreground">
            Phiên chạy từ {format(effectiveStart, "HH:mm dd/MM/yyyy", { locale: vi })}
            {" đến "}
            {format(value.endDate, "HH:mm dd/MM/yyyy", { locale: vi })}.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center justify-center border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Quay lại
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex h-10 items-center justify-center bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  );
}
