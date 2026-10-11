import { formatMoney } from "@/lib/money";
import { bankMoneyDisplay } from "@/lib/money/bank-display";
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
  /** right-align the stacked amounts (for totals in tables) */
  align?: "left" | "right";
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
  align = "left",
}: DualAmountProps) {
  const showBase = !!baseCurrency && baseCurrency !== currency;

  return (
    <span
      className={cn(
        "inline-flex flex-col leading-tight",
        align === "right" && "items-end",
        className
      )}
    >
      <span className="tabular-nums">{typeof amount === "bigint" ? bankMoneyDisplay(amount, currency) : formatMoney(amount, currency)}</span>
      {showBase && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {baseAmount == null
            ? `≈ — ${baseCurrency}`
            : `≈ ${typeof baseAmount === "bigint" ? bankMoneyDisplay(baseAmount, baseCurrency) : formatMoney(baseAmount, baseCurrency)}`}
        </span>
      )}
    </span>
  );
}
