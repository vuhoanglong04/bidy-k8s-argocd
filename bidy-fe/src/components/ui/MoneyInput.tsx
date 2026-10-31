"use client";

import React, { forwardRef, useState } from "react";
import { Input } from "@/components/ui/input";

// Helper function to format Vietnamese currency (no decimals, dots as thousands separator)
const formatVietnameseCurrency = (value: string): string => {
  // Remove all non-digits
  const numericValue = value.replace(/\D/g, '');

  // If empty, return empty
  if (!numericValue) return '';

  // Convert to number and format with dots as thousands separator
  const number = parseInt(numericValue, 10);
  const formatted = number.toLocaleString('vi-VN').replace(/,/g, '.');

  return formatted;
};

// Helper function to parse Vietnamese formatted number back to plain number
export const parseVietnameseNumber = (formattedValue: string): string => {
  return formattedValue.replace(/\./g, '');
};

// Helper function to get numeric value from formatted string
export const getNumericValue = (formattedValue: string): number => {
  const numericString = parseVietnameseNumber(formattedValue);
  return parseInt(numericString, 10) || 0;
};

export interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  value: string;
  onChange: (value: string, numericValue: number) => void;
  suffix?: string;
  error?: boolean;
}

const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      onChange,
      suffix = "VNĐ",
      error,
      className,
      placeholder,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formattedValue = formatVietnameseCurrency(e.target.value);
      const numericValue = getNumericValue(formattedValue);
      onChange(formattedValue, numericValue);
    };

    const displayValue = isFocused ? (value ?? "").replace(/\D/g, "") : value;
    const placeholderWithSuffix = placeholder
      ? `${placeholder} ${suffix}`
      : `Nhập số tiền ${suffix}`;

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholderWithSuffix}
        aria-invalid={error || undefined}
        className={className}
        {...props}
      />
    );
  }
);

MoneyInput.displayName = "MoneyInput";

export default MoneyInput;