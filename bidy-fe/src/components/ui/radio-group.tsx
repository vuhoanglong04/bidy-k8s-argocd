"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}

const RadioGroupContext = React.createContext<{
  value?: string
  onChange?: (value: string) => void
}>({})

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  RadioGroupProps
>(({ value, onValueChange, className, children, ...props }, ref) => {
  return (
    <RadioGroupContext.Provider value={{ value, onChange: onValueChange }}>
      <div ref={ref} className={cn("grid gap-2", className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
})
RadioGroup.displayName = "RadioGroup"

interface RadioGroupItemProps {
  value: string
  id?: string
  disabled?: boolean
  className?: string
}

const RadioGroupItem = React.forwardRef<
  HTMLInputElement,
  RadioGroupItemProps
>(({ value, id, disabled, className, ...props }, ref) => {
  const context = React.useContext(RadioGroupContext)
  const isChecked = context.value === value

  return (
    <input
      ref={ref}
      type="radio"
      id={id}
      value={value}
      checked={isChecked}
      onChange={() => context.onChange?.(value)}
      disabled={disabled}
      className={cn(
        "h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      {...props}
    />
  )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }