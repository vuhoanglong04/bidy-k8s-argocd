"use client";

import * as React from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import AuthField, { type AuthFieldProps } from "./AuthField";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<AuthFieldProps, "type" | "adornment"> & {
  /** Current value, needed only to draw the strength meter or match state. */
  value?: string;
  /** Draws the four-rule strength meter under the field. */
  showStrength?: boolean;
  /** When set, the field reports whether it matches this password. */
  matchAgainst?: string;
};

const RULES = [
  { key: "length", label: "Ít nhất 8 ký tự", test: (v: string) => v.length >= 8 },
  { key: "uppercase", label: "Chữ hoa", test: (v: string) => /[A-Z]/.test(v) },
  { key: "lowercase", label: "Chữ thường", test: (v: string) => /[a-z]/.test(v) },
  { key: "number", label: "Chữ số", test: (v: string) => /\d/.test(v) },
] as const;

const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ value = "", showStrength, matchAgainst, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    const passed = RULES.filter((r) => r.test(value)).length;
    const matches = matchAgainst !== undefined && value.length > 0
      ? value === matchAgainst
      : undefined;

    return (
      <div className="space-y-2">
        <AuthField
          {...props}
          ref={ref}
          disabled={disabled}
          type={visible ? "text" : "password"}
          adornment={
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              disabled={disabled}
              tabIndex={-1}
              aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="rounded-sm p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />

        {showStrength && value.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex gap-1" aria-hidden>
              {RULES.map((rule, i) => (
                <div
                  key={rule.key}
                  className={cn(
                    "h-0.5 flex-1 rounded-full transition-colors",
                    i < passed
                      ? passed === 4
                        ? "bg-green-500"
                        : passed >= 2
                          ? "bg-accent"
                          : "bg-primary"
                      : "bg-border"
                  )}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {RULES.map((rule) => {
                const ok = rule.test(value);
                return (
                  <li
                    key={rule.key}
                    className={cn(
                      "flex items-center gap-1 text-[11px]",
                      ok ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
                    )}
                  >
                    {ok ? <Check className="size-3" /> : <X className="size-3" />}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {matches !== undefined && !props.error && (
          <p
            className={cn(
              "flex items-center gap-1 text-[11px]",
              matches ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
            )}
          >
            {matches ? <Check className="size-3" /> : <X className="size-3" />}
            {matches ? "Mật khẩu khớp" : "Mật khẩu chưa khớp"}
          </p>
        )}
      </div>
    );
  }
);
PasswordField.displayName = "PasswordField";

export default PasswordField;
