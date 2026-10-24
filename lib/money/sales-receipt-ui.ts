import type { NumberPresentation } from "../../i18n/numbers";
import { documentLineInputs, invoiceEditorCurrency, type DocumentEditorLine } from "./document-editor";
import { currencyMetadata } from "./exact";
import { invoiceUiRow, invoiceUiMoney } from "./invoice-ui";

export const salesReceiptEditorCurrency = invoiceEditorCurrency;

/** Receipt prices remain exact major-unit text; both transports round extended prices. */
export function salesReceiptEditorLines(lines: readonly DocumentEditorLine[]) {
  return documentLineInputs(lines).map(({ description, quantity, unitPriceExact, accountId, taxRateId }) => {
    if (!description.trim()) throw new RangeError("Add a description for every line");
    return { description, quantity, unitPriceExact, accountId, taxRateId };
  });
}

export function salesReceiptUiHeader<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return invoiceUiRow(row, ["subtotal", "taxTotal", "total"]);
}

export function salesReceiptUiDocument<T extends Record<string, unknown> & { currencyCode: string;
  lines: (Record<string, unknown> & { quantity: number })[] }>(row: T) {
  const header = salesReceiptUiHeader(row);
  const lines = row.lines.map(line => {
    if (!Number.isInteger(line.quantity) || line.quantity < -2147483648 || line.quantity > 2147483647)
      throw new RangeError("Invalid sales receipt quantity");
    return invoiceUiRow(line, ["unitPrice", "amount", "taxAmount"]);
  });
  return { ...header, lines } as { [P in keyof T]: P extends "lines"
    ? { [K in keyof T["lines"][number]]: K extends "unitPrice" | "amount" | "taxAmount" ? bigint : T["lines"][number][K] }[]
    : P extends "subtotal" | "taxTotal" | "total" ? bigint : T[P] };
}

/** Only posted paid receipts are collected; group the loaded matching sample by currency. */
export function salesReceiptUiCollected(rows: readonly { status: string; total: bigint; currencyCode: string }[], presentation: NumberPresentation = { locale: "en-US", numerals: "latn" }) {
  const groups = new Map<string, bigint>();
  for (const row of rows) if (row.status === "paid") {
    currencyMetadata(row.currencyCode);
    groups.set(row.currencyCode, (groups.get(row.currencyCode) ?? 0n) + row.total);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([code, amount]) => invoiceUiMoney(amount, code, presentation)).join(" · ") || "—";
}

export const salesReceiptUiMoney = invoiceUiMoney;
