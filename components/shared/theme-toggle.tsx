"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div className={cn("flex h-8 w-20 rounded-full bg-muted", className)} />;
  }

  return <ThemeOptions className={className} theme={theme} onSelect={setTheme} />;
}

export function ThemeOptions({ className, theme, onSelect }: {
  className?: string; theme?: string; onSelect: (theme: string) => void;
}) {
  const t = useTranslations("SharedUI");
  const options = [
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
    { value: "system", icon: Monitor },
  ] as const;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border bg-muted/50 p-0.5",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className={cn(
            "flex size-7 items-center justify-center rounded-full transition-all duration-200",
            theme === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={t("theme", { theme: opt.value })}
        >
          <opt.icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
