"use client";

import { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

/** Inline problem notice. States what happened; never apologises. */
export default function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
