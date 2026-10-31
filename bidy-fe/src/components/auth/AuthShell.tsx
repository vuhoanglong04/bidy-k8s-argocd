"use client";

import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  default: "bg-primary/10 text-primary",
  success: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
  danger: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
} as const;

interface AuthShellProps {
  /** Uppercase mono label naming which flow this screen belongs to. */
  eyebrow?: string;
  /** Only pass when the screen really is one step of a multi-step flow. */
  step?: { current: number; total: number };
  title: string;
  description?: ReactNode;
  /** Terminal states (done, link expired) lead with a mark instead of a form. */
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  /** "lg" widens the card for the multi-column register form. */
  size?: "sm" | "lg";
  children: ReactNode;
  /** Sits outside the card, for the "already have an account?" style links. */
  footer?: ReactNode;
}

export default function AuthShell({
  eyebrow,
  step,
  title,
  description,
  icon: Icon,
  tone = "default",
  size = "sm",
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-[calc(100vh-52px)] lg:min-h-[calc(100vh-64px)] flex items-center justify-center bg-background px-4 py-10 sm:py-14">
      <div
        className={cn(
          "w-full animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none",
          size === "lg" ? "max-w-2xl" : "max-w-md"
        )}
      >
        <Card className="overflow-hidden border-border/80 shadow-lg">
          {/* Signature: the lot band — gold fading into the bid red. */}
          <div
            aria-hidden
            className="h-1 w-full bg-gradient-to-r from-accent via-accent to-primary"
          />

          <div className="p-6 sm:p-8">
            {(eyebrow || step) && (
              <div className="flex items-baseline justify-between gap-4 mb-5">
                {eyebrow && (
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {eyebrow}
                  </span>
                )}
                {step && (
                  <span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground tabular-nums">
                    Bước {step.current}/{step.total}
                  </span>
                )}
              </div>
            )}

            {Icon && (
              <div
                className={cn(
                  "mb-5 flex size-12 items-center justify-center rounded-full",
                  TONES[tone]
                )}
              >
                <Icon className="size-6" />
              </div>
            )}

            <div className="mb-7">
              <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-foreground leading-tight">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>

            {children}
          </div>
        </Card>

        {footer && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
