import { documentLineInputs, type DocumentEditorLine } from "./document-editor";
import { currencyMetadata } from "./exact";
import { invoiceUiAmount, invoiceUiMinor, invoiceUiRow, invoiceUiMoney } from "./invoice-ui";

/** Both credit transports default to USD and round the extended price. */
export function creditNoteEditorLines(lines: readonly DocumentEditorLine[]) {
  return documentLineInputs(lines).map(({ description, quantity, unitPriceExact, accountId, taxRateId }) => {
    if (!description.trim()) throw new RangeError("Add a description for every line");
    return { description, quantity, unitPriceExact, accountId, taxRateId };
  });
}

const headers = ["subtotal", "taxTotal", "total", "amountApplied", "amountRemaining"] as const;
export function creditNoteUiHeader<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return invoiceUiRow(row, headers);
}

export function creditNoteUiDocument<T extends Record<string, unknown> & { currencyCode: string;
  lines: (Record<string, unknown> & { quantity: number })[] }>(row: T) {
  const header = creditNoteUiHeader(row);
  const lines = row.lines.map(line => {
    if (!Number.isInteger(line.quantity) || line.quantity < -2147483648 || line.quantity > 2147483647)
      throw new RangeError("Invalid credit-note quantity");
    return invoiceUiRow(line, ["unitPrice", "amount", "taxAmount"]);
  });
  return { ...header, lines } as { [P in keyof T]: P extends "lines"
    ? { [K in keyof T["lines"][number]]: K extends "unitPrice" | "amount" | "taxAmount" ? bigint : T["lines"][number][K] }[]
    : P extends typeof headers[number] ? bigint : T[P] };
}

export function creditNoteUiSummary<T extends Record<string, unknown> & { currencyCode: string | null;
  statusBreakdown: Record<string, { count: number; amount: number; amountMinor?: string }> }>(row: T) {
  const result = invoiceUiRow(row, ["totalAmount", "totalApplied", "totalRemaining"]);
  const statusBreakdown = Object.fromEntries(Object.entries(row.statusBreakdown).map(([key, value]) => [key, invoiceUiRow(value, ["amount"])]));
  if (row.currencyCode) currencyMetadata(row.currencyCode);
  else if (result.totalAmount !== 0n || result.totalApplied !== 0n || result.totalRemaining !== 0n || Object.values(statusBreakdown).some(value => value.amount !== 0n))
    throw new RangeError("Credit-note summary currency is missing");
  return { ...result, currencyCode: row.currencyCode, statusBreakdown };
}

export function creditNoteUiInvoice<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return { ...row, amountDue: invoiceUiMinor(row, "amountDue") };
}

/** Select only this customer's outstanding invoices in the saved credit currency. */
export function creditNoteUiInvoiceEligible(credit: { contactId: string | null; currencyCode: string },
  invoice: { contactId: string | null; currencyCode: string; status: string; amountDue: bigint }) {
  return !!credit.contactId && credit.contactId === invoice.contactId && credit.currencyCode === invoice.currencyCode
    && ["sent", "partial", "overdue"].includes(invoice.status) && invoice.amountDue > 0n;
}

export function creditNoteUiApplication(text: string, credit: { contactId: string | null; currencyCode: string; amountRemaining: bigint },
  invoice: { id: string; contactId: string | null; currencyCode: string; status: string; amountDue: bigint }) {
  if (!creditNoteUiInvoiceEligible(credit, invoice)) throw new RangeError("Select an outstanding invoice for this customer in the credit currency");
  const amount = invoiceUiAmount(text, credit.currencyCode);
  if (BigInt(amount.amountMinor) > credit.amountRemaining || BigInt(amount.amountMinor) > invoice.amountDue)
    throw new RangeError("Amount exceeds the remaining credit or invoice balance");
  return { invoiceId: invoice.id, ...amount };
}

export const creditNoteUiMoney = invoiceUiMoney;
