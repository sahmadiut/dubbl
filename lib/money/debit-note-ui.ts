import { documentLineInputs, type DocumentEditorLine } from "./document-editor";
import { currencyMetadata } from "./exact";
import { invoiceUiAmount, invoiceUiMinor, invoiceUiRow, invoiceUiMoney } from "./invoice-ui";

/** Both debit-note transports default to USD and round the extended price. */
export function debitNoteEditorLines(lines: readonly DocumentEditorLine[]) {
  return documentLineInputs(lines).map(({ description, quantity, unitPriceExact, accountId, taxRateId }) => {
    if (!description.trim()) throw new RangeError("Add a description for every line");
    return { description, quantity, unitPriceExact, accountId, taxRateId };
  });
}

const headers = ["subtotal", "taxTotal", "total", "amountApplied", "amountRemaining"] as const;
export function debitNoteUiHeader<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return invoiceUiRow(row, headers);
}

export function debitNoteUiDocument<T extends Record<string, unknown> & { currencyCode: string;
  lines: (Record<string, unknown> & { quantity: number })[] }>(row: T) {
  const header = debitNoteUiHeader(row);
  const lines = row.lines.map(line => {
    if (!Number.isInteger(line.quantity) || line.quantity < -2147483648 || line.quantity > 2147483647)
      throw new RangeError("Invalid debit-note quantity");
    return invoiceUiRow(line, ["unitPrice", "amount", "taxAmount"]);
  });
  return { ...header, lines } as { [P in keyof T]: P extends "lines"
    ? { [K in keyof T["lines"][number]]: K extends "unitPrice" | "amount" | "taxAmount" ? bigint : T["lines"][number][K] }[]
    : P extends typeof headers[number] ? bigint : T[P] };
}

/** Overview is the loaded, filtered sample, excluding void notes, grouped by currency. */
export function debitNoteUiOverview(rows: readonly { currencyCode: string; status: string;
  total: bigint; amountApplied: bigint; amountRemaining: bigint }[]) {
  const groups = new Map<string, { currencyCode: string; total: bigint; amountApplied: bigint; amountRemaining: bigint }>();
  for (const row of rows) {
    if (row.status === "void") continue;
    currencyMetadata(row.currencyCode);
    const group = groups.get(row.currencyCode) ?? { currencyCode: row.currencyCode, total: 0n, amountApplied: 0n, amountRemaining: 0n };
    group.total += row.total; group.amountApplied += row.amountApplied; group.amountRemaining += row.amountRemaining;
    groups.set(row.currencyCode, group);
  }
  return [...groups.values()].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
}

export function debitNoteUiBill<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return { ...row, amountDue: invoiceUiMinor(row, "amountDue") };
}

/** Pending approval is not recognized and cannot receive a debit-note allocation. */
export function debitNoteUiBillEligible(note: { contactId: string | null; currencyCode: string },
  bill: { contactId: string | null; currencyCode: string; status: string; amountDue: bigint }) {
  return !!note.contactId && note.contactId === bill.contactId && note.currencyCode === bill.currencyCode
    && ["received", "partial", "overdue"].includes(bill.status) && bill.amountDue > 0n;
}

export function debitNoteUiApplication(text: string, note: { contactId: string | null; currencyCode: string; status: string; amountRemaining: bigint },
  bill: { id: string; contactId: string | null; currencyCode: string; status: string; amountDue: bigint }) {
  if (note.status !== "sent" || !debitNoteUiBillEligible(note, bill))
    throw new RangeError("Select a recognized outstanding bill for this supplier in the credit currency");
  const amount = invoiceUiAmount(text, note.currencyCode);
  if (BigInt(amount.amountMinor) > note.amountRemaining || BigInt(amount.amountMinor) > bill.amountDue)
    throw new RangeError("Amount exceeds the remaining credit or bill balance");
  return { billId: bill.id, ...amount };
}

export const debitNoteUiMoney = invoiceUiMoney;
