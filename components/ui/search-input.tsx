"use client";

import { useTranslations } from "next-intl";

import { forwardRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  "aria-label"?: string;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder: suppliedPlaceholder, loading, className, "aria-label": ariaLabel }, ref) => {
    const t = useTranslations("SharedUI");
    const placeholder = suppliedPlaceholder ?? t("search");
    return (
      <div className={cn("relative flex-1 sm:max-w-xs", className)}>
        <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          dir="auto"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ps-9 pe-8 h-8 text-sm"
        />
        <div className="absolute end-2.5 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <Loader2 className="size-3.5 text-muted-foreground animate-spin" />
          ) : value ? (
            <button
              type="button"
              aria-label={t("clearSearch")}
              onClick={() => onChange("")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

export { SearchInput };
