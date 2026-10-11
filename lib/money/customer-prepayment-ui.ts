import { invoiceEditorCurrency } from "./document-editor";
import { invoiceUiCredit, invoiceUiAmount, invoiceUiMoney, invoiceUiDecimal } from "./invoice-ui";
import { creditNoteUiInvoice, creditNoteUiInvoiceEligible, creditNoteUiApplication } from "./credit-note-ui";

/** The create service resolves explicit, contact, organization, then USD currency. */
export const customerPrepaymentCurrency = invoiceEditorCurrency;
export const customerPrepaymentAmount = invoiceUiAmount;
export const customerPrepaymentMoney = invoiceUiMoney;
export const customerPrepaymentDecimal = invoiceUiDecimal;
export const customerPrepaymentInvoice = creditNoteUiInvoice;
export const customerPrepaymentInvoiceEligible = creditNoteUiInvoiceEligible;
export const customerPrepaymentApplication = creditNoteUiApplication;

export function customerPrepaymentRow<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  const saved = invoiceUiCredit(row);
  if (saved.originalAmount <= 0n || saved.amountRemaining < 0n || saved.amountRemaining > saved.originalAmount)
    throw new RangeError("Invalid saved prepayment balances");
  return saved;
}

/** These are the loaded filtered sample, excluding cancelled credits; never infer FX. */
export function customerPrepaymentSummary(rows: readonly { currencyCode: string; status: string; originalAmount: bigint; amountRemaining: bigint }[]) {
  const groups = new Map<string, { received: bigint; remaining: bigint }>();
  for (const row of rows) if (row.status !== "void") {
    const group = groups.get(row.currencyCode) ?? { received: 0n, remaining: 0n };
    group.received += row.originalAmount;
    group.remaining += row.amountRemaining;
    groups.set(row.currencyCode, group);
  }
  const sorted = [...groups].sort(([a], [b]) => a.localeCompare(b));
  return {
    received: sorted.map(([code, group]) => customerPrepaymentMoney(group.received, code)).join(" · ") || "—",
    remaining: sorted.map(([code, group]) => customerPrepaymentMoney(group.remaining, code)).join(" · ") || "—",
  };
}
