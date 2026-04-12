"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Cycles through Light → Dark → System. The icon reflects the *resolved*
 * theme so users always see a visual indicator of what's currently applied
 * (Sun for light, Moon for dark), and switches to Monitor when the user has
 * set an explicit "system" preference — on hover/click the cycle continues.
 *
 * Renders a stable placeholder on the server so hydration matches; the
 * resolved icon appears after mount.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const label = !mounted
    ? "Toggle theme"
    : theme === "system"
      ? `System theme (${resolvedTheme})`
      : theme === "dark"
        ? "Dark theme"
        : "Light theme";

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycle}
      aria-label={label}
      title={label}
      className="relative h-8 w-8 px-0"
    >
      {mounted ? (
        theme === "system" ? (
          <Monitor className="h-4 w-4" />
        ) : resolvedTheme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )
      ) : (
        // Matches the size/shape of the real icons to avoid layout shift
        <span className="h-4 w-4" aria-hidden />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
