import type { NumberPresentation } from "../../i18n/numbers";
import { currencyMetadata, roundRatio } from "./exact";
import { invoiceUiMinor, invoiceUiRow, invoiceUiAmount, invoiceUiMoney, invoiceUiDecimal } from "./invoice-ui";

export const paymentUiMoney = invoiceUiMoney;
export const paymentUiDecimal = invoiceUiDecimal;
export function paymentUiAmount(text: string, currency: string) {
  try { return invoiceUiAmount(text, currency); }
  catch { throw new RangeError(`Enter a positive amount with valid decimal places for ${currency} and within the supported range`); }
}

/** Saved allocations include signed noncash carriers; retain their raw units. */
export function paymentUiRow<T extends Record<string, unknown> & { currencyCode: string; allocations: Record<string, unknown>[] }>(row: T) {
  currencyMetadata(row.currencyCode);
  const saved = invoiceUiRow(row, ["amount"]);
  const allocations = row.allocations.map(value => invoiceUiRow(value, ["amount"]));
  const allocated = allocations.reduce((sum, value) => sum + value.amount, 0n);
  return { ...saved, allocations, allocated, unallocated: saved.amount - allocated };
}

/** Loaded filtered sample only; currency groups never imply FX conversion. */
export function paymentUiSummary(rows: readonly { amount: bigint; currencyCode: string }[], presentation: NumberPresentation = { locale: "en-US", numerals: "latn" }) {
  const groups = new Map<string, { amount: bigint; count: bigint }>();
  for (const row of rows) {
    currencyMetadata(row.currencyCode);
    const group = groups.get(row.currencyCode) ?? { amount: 0n, count: 0n };
    group.amount += row.amount; group.count += 1n; groups.set(row.currencyCode, group);
  }
  const sorted = [...groups].sort(([a], [b]) => a.localeCompare(b));
  return {
    total: sorted.map(([code, group]) => paymentUiMoney(group.amount, code, presentation)).join(" · ") || "—",
    // Preserve Math.round's signed tie rule using an exact floor(x + 1/2).
    average: sorted.map(([code, group]) => paymentUiMoney(roundRatio(2n * group.amount + group.count, 2n * group.count, "floor"), code, presentation)).join(" · ") || "—",
  };
}

export function paymentUiBill<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return invoiceUiRow(row, ["total", "amountDue"]);
}

export function paymentUiScheduled<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  const saved = invoiceUiRow(row, ["amount"]);
  return { ...saved, ...(row.bill ? { bill: paymentUiBill(row.bill as Record<string, unknown> & { currencyCode: string }) } : {}) };
}

export function paymentUiBatch<T extends Record<string, unknown> & { currencyCode: string; items: (Record<string, unknown> & { currencyCode: string })[] }>(row: T) {
  currencyMetadata(row.currencyCode);
  const saved = invoiceUiRow(row, ["totalAmount"]);
  const items = row.items.map(paymentUiScheduled);
  if (items.some(item => item.currencyCode !== row.currencyCode || item.amount <= 0n)
    || items.reduce((sum, item) => sum + item.amount, 0n) !== saved.totalAmount)
    throw new RangeError("Batch totals or currencies disagree");
  return { ...saved, items };
}

export function paymentUiRemittance<T extends Record<string, unknown> & { currencyCode: string; lines: (Record<string, unknown> & { currencyCode: string })[] }>(row: T) {
  currencyMetadata(row.currencyCode);
  const totalPaid = invoiceUiMinor(row, "totalPaid");
  const lines = row.lines.map(line => invoiceUiRow(line, ["billTotal", "amountPaid"]));
  if (lines.some(line => line.currencyCode !== row.currencyCode)
    || lines.reduce((sum, line) => sum + line.amountPaid, 0n) !== totalPaid)
    throw new RangeError("Remittance totals or currencies disagree");
  return { ...row, totalPaid, lines };
}

type Bill = { id: string; contactId: string; currencyCode: string; amountDue: bigint };
type Selection = { billId: string; contactId: string; currencyCode: string; amount: string };
export function paymentUiBillAmount(text: string, bill: Bill) {
  const result = paymentUiAmount(text, bill.currencyCode);
  if (BigInt(result.amountMinor) > bill.amountDue) throw new RangeError("Amount exceeds the bill balance");
  return result;
}

/** One stored batch has one explicit currency; the preview and payload share this result. */
export function paymentUiBatchInput(selected: readonly Selection[], bills: readonly Bill[]) {
  if (!selected.length || selected.length > 1000 || new Set(selected.map(row => row.billId)).size !== selected.length)
    throw new RangeError("Select distinct bills");
  const currencyCode = selected[0].currencyCode;
  const items = selected.map(row => {
    const bill = bills.find(bill => bill.id === row.billId);
    if (!bill || bill.contactId !== row.contactId || bill.currencyCode !== currencyCode || row.currencyCode !== currencyCode)
      throw new RangeError("Select bills in one currency with matching suppliers");
    return { billId: bill.id, contactId: bill.contactId, currencyCode, ...paymentUiBillAmount(row.amount, bill) };
  });
  const total = items.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Batch total exceeds the supported range");
  return { currencyCode, items, total };
}
