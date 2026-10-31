"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface WizardStep {
  /** Số thứ tự hiển thị, bắt đầu từ 1. */
  id: number;
  title: string;
  hint: string;
}

interface WizardStepperProps {
  steps: readonly WizardStep[];
  currentStep: number;
  /** Các bước đã hoàn tất — hiện dấu tick. */
  completedSteps: readonly number[];
  /**
   * Bước nào bấm vào được. Stepper là điều hướng, không phải cổng gác: sau khi
   * draft đã tạo thì cho nhảy tự do, vì nhiều người muốn ném ảnh vào trước rồi
   * mới viết mô tả.
   */
  isStepReachable: (step: number) => boolean;
  onStepChange: (step: number) => void;
}

export default function WizardStepper({
  steps,
  currentStep,
  completedSteps,
  isStepReachable,
  onStepChange,
}: Readonly<WizardStepperProps>) {
  return (
    <>
      {/* Desktop: cột dọc bên trái */}
      <nav aria-label="Các bước đăng sản phẩm" className="hidden lg:block">
        <ol className="flex flex-col">
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStep;
            const isDone = completedSteps.includes(step.id);
            const reachable = isStepReachable(step.id);
            const isLast = index === steps.length - 1;

            return (
              <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
                {/* Đường nối giữa các mốc */}
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-4 top-8 h-[calc(100%-2rem)] w-px -translate-x-1/2",
                      isDone ? "bg-primary" : "bg-border"
                    )}
                  />
                )}

                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => onStepChange(step.id)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex flex-1 items-start gap-4 text-left",
                    reachable ? "cursor-pointer" : "cursor-not-allowed"
                  )}
                >
                  {/* Mốc tròn — đây là chỗ được phép bo, vì nó vốn là hình tròn */}
                  <span
                    className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                      isDone && "border-primary bg-primary text-primary-foreground",
                      !isDone &&
                        isCurrent &&
                        "border-primary bg-background text-primary",
                      !isDone &&
                        !isCurrent &&
                        "border-border bg-background text-muted-foreground"
                    )}
                  >
                    {isDone ? <Check className="size-4" aria-hidden /> : step.id}
                  </span>

                  <span className="flex flex-col pt-1">
                    <span
                      className={cn(
                        "text-sm font-semibold transition-colors",
                        isCurrent ? "text-foreground" : "text-foreground-secondary"
                      )}
                    >
                      {step.title}
                    </span>
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      {step.hint}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile: sidebar dọc không vừa, rút thành thanh ngang */}
      <div className="lg:hidden">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-secondary">
          Bước {currentStep}/{steps.length}
        </p>
        <p className="mt-1 text-lg font-bold text-foreground">
          {steps.find((step) => step.id === currentStep)?.title}
        </p>
        <div className="mt-3 flex gap-1" aria-hidden>
          {steps.map((step) => (
            <span
              key={step.id}
              className={cn(
                "h-1 flex-1 transition-colors",
                step.id <= currentStep ? "bg-primary" : "bg-border"
              )}
            />
          ))}
        </div>
      </div>
    </>
  );
}
