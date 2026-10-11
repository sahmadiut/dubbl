import { currencyMetadata, parseMajor, roundRatio, money, toMajorDecimal } from "./exact";
import { bankMoneyDisplay } from "./bank-display";

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);
function supported(value: bigint) {
  if (value < -SAFE || value > SAFE) throw new RangeError("Invoice money exceeds the supported range");
  return value;
}

/** Adopt Minor aliases, validating the retained numeric raw units without rescaling. */
export function invoiceUiMinor(row: Record<string, unknown>, field: string) {
  const legacy = row[field], alias = row[`${field}Minor`];
  if (typeof legacy !== "number" || !Number.isSafeInteger(legacy)) throw new RangeError(`Invalid ${field} amount`);
  if (alias !== undefined && (typeof alias !== "string" || !/^(0|-?[1-9]\d*)$/.test(alias))) throw new RangeError(`Invalid ${field}Minor amount`);
  const amount = supported(BigInt(alias === undefined ? legacy : alias as string));
  if (amount !== BigInt(legacy)) throw new RangeError(`Conflicting ${field} money aliases`);
  return amount;
}

export function invoiceUiRow<T extends Record<string, unknown>, K extends keyof T & string>(row: T, fields: readonly K[]) {
  return { ...row, ...Object.fromEntries(fields.map(field => [field, invoiceUiMinor(row, field)])) } as { [P in keyof T]: P extends K ? bigint : T[P] } & Record<K, bigint>;
}

const headers = ["subtotal", "taxTotal", "total", "amountPaid", "amountDue"] as const;
type SavedLine = { description: string; quantity: number; unitPrice: number; amount: number; taxAmount: number;
  account?: { id: string } | null; taxRate?: { id: string } | null; [key: string]: unknown };
export function invoiceUiDocument<T extends Record<string, unknown> & { currencyCode: string; lines?: SavedLine[] }>(row: T) {
  currencyMetadata(row.currencyCode);
  const result = invoiceUiRow(row, headers);
  return { ...result, currencyCode: row.currencyCode, ...(Array.isArray(row.lines) ? { lines: row.lines.map(line => invoiceUiRow(line, ["unitPrice", "amount", "taxAmount"])) } : {}) };
}

export function invoiceUiPayment<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return { ...invoiceUiRow(row, ["amount"]), currencyCode: row.currencyCode };
}

export function invoiceUiCredit<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return { ...invoiceUiRow(row, ["originalAmount", "amountRemaining"]), currencyCode: row.currencyCode };
}

export function invoiceUiBase<T extends { baseCurrency: string; amounts: Record<string, unknown> }>(base: T) {
  currencyMetadata(base.baseCurrency);
  return { ...base, amounts: Object.fromEntries(headers.map(field => {
    if (base.amounts[field] === null) {
      if (base.amounts[`${field}Minor`] != null) throw new RangeError("Conflicting base money aliases");
      return [field, null];
    }
    return [field, invoiceUiMinor(base.amounts, field)];
  })) as Record<typeof headers[number], bigint | null> };
}

export function invoiceUiSummary<T extends { totalCount: number; currencyCode: string | null; aging: Record<string, { count: number; amount: number; amountMinor?: string }> } & Record<string, unknown>>(row: T) {
  const result = invoiceUiRow(row, ["outstanding", "overdue"]);
  const aging = Object.fromEntries(Object.entries(row.aging).map(([key, bucket]) => [key, invoiceUiRow(bucket, ["amount"])]));
  if (row.currencyCode) currencyMetadata(row.currencyCode);
  else if (result.outstanding !== 0n || result.overdue !== 0n || Object.values(aging).some(bucket => bucket.amount !== 0n)) throw new RangeError("Invoice summary currency is missing");
  return { ...result, totalCount: row.totalCount, currencyCode: row.currencyCode, aging };
}

export const invoiceUiMoney = bankMoneyDisplay;
export function invoiceUiDecimal(amount: bigint, currency: string) { return toMajorDecimal(money(amount, currency)); }

/** Payments and overrides require positive whole minor units, with no silent rounding. */
export function invoiceUiAmount(text: string, currency: string) {
  if (text.length > 40 || !/^\d+(?:\.\d+)?$/.test(text)) throw new RangeError("Enter a positive decimal amount");
  const amount = supported(parseMajor(text, currency, "reject").amountMinor);
  if (amount <= 0n) throw new RangeError("Enter a positive amount");
  return { amountMinor: amount.toString() };
}
export function invoiceUiAmountValid(text: string, currency: string) {
  try { invoiceUiAmount(text, currency); return true; } catch { return false; }
}

/** Convert only a bounded presentation percentage to Number after exact division. */
export function invoiceUiPercent(amount: bigint, total: bigint, digits = 0) {
  if (total <= 0n) return amount > 0n ? 100 : 0;
  const scale = 10n ** BigInt(digits);
  const percent = roundRatio(amount * 100n * scale, total, "half-away-from-zero");
  return Number(percent < 0n ? 0n : percent > 100n * scale ? 100n * scale : percent) / Number(scale);
}

export function invoiceUiCreditAmount(credit: { currencyCode: string; amountRemaining: bigint }, invoice: { currencyCode: string; amountDue: bigint }) {
  if (credit.currencyCode !== invoice.currencyCode) throw new RangeError("Credit currency must match the invoice");
  const amount = supported(credit.amountRemaining < invoice.amountDue ? credit.amountRemaining : invoice.amountDue);
  if (amount <= 0n) throw new RangeError("Nothing left to apply");
  return { amountMinor: amount.toString() };
}

/** Saved prices are raw currency units. Preserve dimensions and tax when making a copy. */
export function invoiceUiCopyLines(lines: readonly ({ description: string; quantity: number; unitPrice: bigint;
  account?: { id: string } | null; taxRate?: { id: string } | null; accountId?: string | null; taxRateId?: string | null;
  costCenterId?: string | null; projectId?: string | null; inventoryItemId?: string | null; warehouseId?: string | null;
  priceListId?: string | null; discountPercent?: number } )[], currency: string) {
  currencyMetadata(currency);
  return lines.map(line => ({ description: line.description, quantity: line.quantity / 100,
    unitPriceExact: invoiceUiDecimal(supported(line.unitPrice), currency),
    accountId: line.accountId ?? line.account?.id ?? null, taxRateId: line.taxRateId ?? line.taxRate?.id ?? null,
    costCenterId: line.costCenterId ?? null, projectId: line.projectId ?? null,
    inventoryItemId: line.inventoryItemId ?? null, warehouseId: line.warehouseId ?? null,
    priceListId: line.priceListId ?? null, discountPercent: line.discountPercent ?? 0 }));
}
