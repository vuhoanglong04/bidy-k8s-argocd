"use client";
import { ButtonHTMLAttributes, ReactNode, useState } from "react";
import LoadingSpinner from "./LoadingSpinner";

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export default function AnimatedButton({
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingText = "Đang tải...",
  icon,
  children,
  className = "",
  ...props
}: AnimatedButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 focus:ring-secondary",
    outline: "border-2 border-border text-foreground hover:bg-accent focus:ring-primary"
  };

  const sizes = {
    sm: "px-3 py-2.5 text-sm min-h-[40px]",
    md: "px-4 py-3 text-base min-h-[44px]",
    lg: "px-6 py-4 text-lg min-h-[48px]"
  };

  const baseClasses = `
    relative font-semibold rounded-lg
    focus:outline-none focus:ring-2 focus:ring-offset-2
    transition-all duration-200 ease-out
    disabled:opacity-50 disabled:cursor-not-allowed
    transform active:scale-95
    overflow-hidden
  `;

  return (
    <button
      {...props}
      disabled={props.disabled || isLoading}
      className={`
        ${baseClasses}
        ${variants[variant]}
        ${sizes[size]}
        ${isPressed ? "scale-95" : "hover:scale-[1.02]"}
        ${className}
      `}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {/* Ripple effect background */}
      <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-active:scale-x-100 transition-transform duration-300 origin-left" />
      
      {/* Button content */}
      <div className="relative flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" color="white" />
            {loadingText}
          </>
        ) : (
          <>
            {icon && (
              <span className="transition-transform duration-200 group-hover:scale-110">
                {icon}
              </span>
            )}
            {children}
          </>
        )}
      </div>
      
      {/* Shine effect */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700" />
      </div>
    </button>
  );
}