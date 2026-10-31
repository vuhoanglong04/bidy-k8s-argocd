"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <button
      // variant="ghost"
      // size="icon"
      className="ml-2 cursor-pointer hover:text-primary text-foreground"
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <Sun className={`w-4 h-4`} />
      ) : (
        <Moon className={`w-4 h-4`} />
      )}
      {/* <span className="sr-only">Toggle theme</span> */}
    </button>
  );
}
