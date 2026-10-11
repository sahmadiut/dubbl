import { documentLineInputs, type DocumentEditorLine } from "./document-editor";
import { currencyMetadata } from "./exact";
import { invoiceUiMinor, invoiceUiMoney } from "./invoice-ui";
import { recurringInvoiceStoredLines, recurringInvoiceTotals } from "../api/recurring-invoice-wire";
import { invoiceRound, safeInvoiceMinor } from "../api/invoice-write-wire";

/** Both recurring create transports default to USD, independently of contact/org. */
export function recurringInvoiceEditorCurrency(selected?: string | null) {
  return currencyMetadata(selected || "USD").code;
}

export function recurringInvoiceEditorLines(lines: readonly DocumentEditorLine[]) {
  return documentLineInputs(lines).map(({ description, quantity, unitPriceExact, accountId, taxRateId }) => {
    if (!description.trim()) throw new RangeError("Add a description for every line");
    return { description, quantity, unitPriceExact, accountId, taxRateId };
  });
}

/** Templates round BOTH price and quantity before calculating any occurrence. */
export function recurringInvoiceEditorPreview(lines: readonly DocumentEditorLine[], currency: string | null,
  rates: readonly { id: string; rate: number }[]) {
  try {
    if (!currency) throw new RangeError("Select a template currency to preview totals");
    const code = currencyMetadata(currency).code;
    const inputs = documentLineInputs(lines);
    const stored = recurringInvoiceStoredLines(inputs.map(line => ({ ...line, description: line.description || "Preview line" })), code);
    const totals = recurringInvoiceTotals(stored, new Map(rates.map(rate => [rate.id, rate.rate])));
    return { inputs, lines: totals.processedLines.map(line => ({ amountMinor: BigInt(line.amount), taxMinor: BigInt(line.taxAmount), priceMinor: BigInt(line.unitPrice) })),
      subtotal: BigInt(totals.subtotal), taxTotal: BigInt(totals.taxTotal), total: BigInt(totals.total), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enter valid recurring line amounts";
    return { inputs: [], lines: [], subtotal: 0n, taxTotal: 0n, total: 0n,
      error: message.startsWith("[") ? "Check the line quantity, account and tax selection" : message };
  }
}

export type RecurringInvoiceUiLine = { id: string; description: string; quantity: number; unitPrice: bigint;
  grossMinor: bigint; discountPercent: number; account?: { code: string; name: string } | null };

export function recurringInvoiceUiDocument<T extends { currencyCode: string; lines: (Record<string, unknown> & {
  id: string; description: string; quantity: number; discountPercent: number; account?: { code: string; name: string } | null })[] }>(row: T) {
  currencyMetadata(row.currencyCode);
  const lines: RecurringInvoiceUiLine[] = row.lines.map(line => {
    if (!Number.isInteger(line.quantity) || line.quantity < -2147483648 || line.quantity > 2147483647)
      throw new RangeError("Invalid recurring quantity");
    if (!Number.isInteger(line.discountPercent) || line.discountPercent < 0 || line.discountPercent > 10000)
      throw new RangeError("Invalid recurring discount");
    const unitPrice = invoiceUiMinor(line, "unitPrice");
    const grossMinor = invoiceRound(BigInt(line.quantity) * unitPrice, 100n);
    safeInvoiceMinor(grossMinor);
    return { ...line, unitPrice, grossMinor };
  });
  safeInvoiceMinor(lines.reduce((sum, line) => sum + line.grossMinor, 0n));
  return { ...row, lines };
}

/** Legacy upcoming preview is gross before discounts/tax, in the saved currency. */
export function recurringInvoiceUiUpcoming<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return { ...row, lineTotal: invoiceUiMinor(row, "lineTotal") };
}

export const recurringInvoiceUiMoney = invoiceUiMoney;
