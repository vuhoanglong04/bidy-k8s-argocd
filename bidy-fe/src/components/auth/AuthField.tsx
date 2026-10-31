"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface AuthFieldProps extends InputProps {
  label: string;
  error?: string;
  /** Renders the required marker; does not imply the HTML attribute. */
  requiredMark?: boolean;
  hint?: string;
  /** Slot rendered inside the field, right-aligned (eye toggles, match ticks). */
  adornment?: React.ReactNode;
}

const AuthField = React.forwardRef<HTMLInputElement, AuthFieldProps>(
  (
    { label, error, requiredMark, hint, adornment, className, id, name, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const fieldId = id ?? `${name ?? "field"}-${generatedId}`;
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;

    return (
      <div className="space-y-2">
        <Label htmlFor={fieldId} className="text-foreground">
          {label}
          {requiredMark && <span className="text-primary ml-0.5">*</span>}
        </Label>

        <div className="relative">
          <Input
            id={fieldId}
            name={name}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? errorId : hint ? hintId : undefined
            }
            className={cn(
              "h-11 text-sm",
              adornment && "pr-11",
              error && "border-red-500 focus-visible:ring-red-500",
              className
            )}
            {...props}
          />
          {adornment && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
              {adornment}
            </div>
          )}
        </div>

        {error ? (
          <p id={errorId} className="text-xs text-red-500">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
AuthField.displayName = "AuthField";

export default AuthField;
