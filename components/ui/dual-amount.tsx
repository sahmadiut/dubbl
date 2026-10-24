"use client";

import { useNumberPresentation } from "@/i18n/use-numbers";
import { useCurrencyPresentation } from "@/i18n/use-currency";
import { cn } from "@/lib/utils";

interface DualAmountProps {
  /** amount in the document currency, integer minor units */
  amount: number | bigint;
  /** document currency code */
  currency: string;
  /** org base currency code; when different from `currency` the base line shows */
  baseCurrency?: string | null;
  /** amount converted to base currency (minor units), or null if no rate */
  baseAmount?: number | bigint | null;
  className?: string;
  /** Logical alignment by default; left/right preserve explicit physical totals. */
  align?: "start" | "end" | "left" | "right";
}

/**
 * Shows a monetary amount in its own currency and, when that differs from the
 * organization's base currency, the base-currency equivalent underneath.
 */
export function DualAmount({
  amount,
  currency,
  baseCurrency,
  baseAmount,
  className,
  align = "start",
}: DualAmountProps) {
  const numbers = useNumberPresentation();
  const units = useCurrencyPresentation();
  const display = (value: number | bigint, code: string) => {
    if (typeof value === "number" && !Number.isSafeInteger(value)) throw new RangeError("Expected safe integer minor units");
    return numbers.money(BigInt(value), code);
  };
  const showBase = !!baseCurrency && baseCurrency !== currency;

  return (
    <span
      className={cn(
        "inline-flex flex-col leading-tight",
        align === "start" && "items-start",
        align === "end" && "items-end",
        align === "right" && "items-end [&:dir(rtl)]:items-start",
        align === "left" && "items-start [&:dir(rtl)]:items-end",
        className
      )}
    >
      <span className="tabular-nums"><bdi>{display(amount, currency)}</bdi></span>
      {showBase && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {baseAmount == null
            ? <bdi>{`≈ — ${units.label(baseCurrency)}`}</bdi>
            : <bdi>{`≈ ${display(baseAmount, baseCurrency)}`}</bdi>}
        </span>
      )}
    </span>
  );
}
