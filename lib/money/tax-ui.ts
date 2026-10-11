import { currencyMetadata } from "./exact";
import { journalInputMinor, journalDecimal } from "./journal-display";
import { bankMoneyDisplay } from "./bank-display";
import { approvalEntity, approvalMoneyFields, parseConditions } from "@/lib/approvals/conditions";
import { fromLegacyRate, exactRate, toLegacyRate } from "@/lib/currency/exact-rate";

/** Retained safe numeric carrier must agree with any additive exact alias. */
export function taxUiMinor(value: unknown, alias?: unknown): bigint {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0))
    throw new RangeError("Tax amount must be a safe integer");
  if (alias !== undefined && (typeof alias !== "string" || !/^(0|-?[1-9]\d*)$/.test(alias) || BigInt(alias) !== BigInt(value)))
    throw new RangeError("Tax amount aliases disagree");
  return BigInt(value);
}
export function taxUiCurrency(value: unknown): string {
  if (typeof value !== "string" || currencyMetadata(value).code !== value)
    throw new RangeError("Unsupported tax currency");
  return value;
}
export const taxUiAbs = (value: bigint) => value < 0n ? -value : value;
export const taxUiMax = (...values: bigint[]) => values.reduce((max, value) => value > max ? value : max, 1n);
/** Only the bounded visual ratio becomes a Number, after exact division. */
export function taxUiPercent(value: bigint, total: bigint) {
  if (total <= 0n) return 0;
  return Number((taxUiAbs(value) > total ? total : taxUiAbs(value)) * 10000n / total) / 100;
}
export const taxUiMoney = bankMoneyDisplay;
export const taxUiDecimal = journalDecimal;
export function taxUiRate(value: number, alias?: string | null) {
  const decimal = fromLegacyRate(value);
  if (alias != null && exactRate(alias) !== decimal) throw new RangeError("FX rate aliases disagree");
  return decimal;
}
export function taxUiRateInput(text: string) {
  const rateExact = exactRate(text);
  toLegacyRate(rateExact); // Existing positive int32 millionths coexistence, without rounding.
  return { rateExact, rateDirection: "quote_per_base" as const };
}
export function taxUiSettlement(text: string, currency: string) {
  try {
    taxUiCurrency(currency);
    if (!text) throw new RangeError("Enter an amount");
    const amount = journalInputMinor(text, currency);
    return { amount, amountMinor: String(amount), error: null };
  } catch (error) {
    return { amount: 0n, amountMinor: "0", error: error instanceof Error ? error.message : "Enter a valid amount" };
  }
}

export function taxUiRows<T extends object, K extends keyof T>(rows: T[], keys: K[]): (Omit<T, K> & Record<K, bigint>)[] {
  if (!Array.isArray(rows)) throw new RangeError("Missing tax report rows");
  return rows.map(row => {
    const result: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    for (const key of keys) result[String(key)] = taxUiMinor(row[key], (row as Record<string, unknown>)[`${String(key)}Minor`]);
    return result as Omit<T, K> & Record<K, bigint>;
  });
}

/** Workflows span document currencies: thresholds intentionally remain raw int64 units. */
export function taxUiConditions(entityType: string, input: unknown) {
  const type = approvalEntity.parse(entityType);
  return parseConditions(type, input).map(condition => approvalMoneyFields[type].includes(condition.field)
    ? { ...condition, valueMinor: condition.value } : condition);
}
