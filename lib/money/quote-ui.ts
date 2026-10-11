import { documentLineInputs, type DocumentEditorLine } from "./document-editor";
import { currencyMetadata } from "./exact";
import { invoiceUiRow, invoiceUiMoney } from "./invoice-ui";

/** Quotes default to USD in both transports, independently of customer currency. */
export function quoteEditorLines(lines: readonly DocumentEditorLine[]) {
  return documentLineInputs(lines).map(({ description, quantity, unitPriceExact, accountId, taxRateId }) => {
    if (!description.trim()) throw new RangeError("Add a description for every line");
    return { description, quantity, unitPriceExact, accountId, taxRateId };
  });
}

export function quoteUiHeader<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return invoiceUiRow(row, ["subtotal", "taxTotal", "total", "billedTotal"]);
}

export function quoteUiDocument<T extends Record<string, unknown> & { currencyCode: string;
  lines: (Record<string, unknown> & { quantity: number })[] }>(row: T) {
  const header = quoteUiHeader(row);
  const lines = row.lines.map(line => {
    if (!Number.isInteger(line.quantity) || line.quantity < -2147483648 || line.quantity > 2147483647)
      throw new RangeError("Invalid quote quantity");
    return invoiceUiRow(line, ["unitPrice", "amount", "taxAmount"]);
  });
  return { ...header, lines } as { [P in keyof T]: P extends "lines"
    ? { [K in keyof T["lines"][number]]: K extends "unitPrice" | "amount" | "taxAmount" ? bigint : T["lines"][number][K] }[]
    : P extends "subtotal" | "taxTotal" | "total" | "billedTotal" ? bigint : T[P] };
}

/** Group sample list totals by saved currency; never add different currencies. */
export function quoteUiSummary(rows: readonly { status: string; total: bigint; currencyCode: string }[], status: string) {
  const groups = new Map<string, bigint>();
  for (const row of rows) if (row.status === status) {
    currencyMetadata(row.currencyCode);
    groups.set(row.currencyCode, (groups.get(row.currencyCode) ?? 0n) + row.total);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([code, amount]) => invoiceUiMoney(amount, code)).join(" · ") || "—";
}

export const quoteUiMoney = invoiceUiMoney;
