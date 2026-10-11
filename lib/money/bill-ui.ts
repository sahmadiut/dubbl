import { currencyMetadata, checkedMinor } from "./exact";
import { invoiceUiMinor, invoiceUiRow, invoiceUiDocument, invoiceUiDecimal, invoiceUiAmount } from "./invoice-ui";

// Bills share the adopted safe numeric/Minor read and whole-minor payment contract.
export { invoiceUiBase as billUiBase,
  invoiceUiMoney as billUiMoney, invoiceUiDecimal as billUiDecimal,
  invoiceUiAmount as billUiAmount, invoiceUiAmountValid as billUiAmountValid,
  invoiceUiPercent as billUiPercent } from "./invoice-ui";

export function billUiDocument<T extends Parameters<typeof invoiceUiDocument>[0]>(row: T) {
  if (!Array.isArray(row.lines)) throw new RangeError("Bill lines are missing");
  for (const line of row.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < -2147483648 || line.quantity > 2147483647)
      throw new RangeError("Invalid saved bill quantity");
  }
  return invoiceUiDocument(row);
}

export function billUiList<T extends Record<string, unknown> & { currencyCode: string }>(row: T) {
  currencyMetadata(row.currencyCode);
  return { ...invoiceUiRow(row, ["total", "amountDue"]), currencyCode: row.currencyCode };
}

export function billUiPaymentAmount(text: string, currency: string, amountDue: bigint) {
  const amount = invoiceUiAmount(text, currency);
  if (BigInt(amount.amountMinor) > amountDue) throw new RangeError("Payment exceeds amount due");
  return amount;
}
export function billUiPaymentValid(text: string, currency: string, amountDue: bigint) {
  try { billUiPaymentAmount(text, currency, amountDue); return true; } catch { return false; }
}

type CountBucket = { count: number; amount: number; amountMinor?: string; currencyCode: string };
export function billUiCounts(row: { total: number; counts: Record<string, CountBucket> }) {
  if (!Number.isSafeInteger(row.total) || row.total < 0) throw new RangeError("Invalid bill count");
  const counts = Object.fromEntries(Object.entries(row.counts).map(([status, bucket]) => {
    if (!Number.isSafeInteger(bucket.count) || bucket.count < 0) throw new RangeError("Invalid bill status count");
    currencyMetadata(bucket.currencyCode);
    return [status, { ...bucket, amount: invoiceUiMinor(bucket, "amount") }];
  }));
  if (Object.values(counts).reduce((sum, bucket) => sum + bucket.count, 0) !== row.total)
    throw new RangeError("Conflicting bill counts");
  const currencies = new Map<string, { currencyCode: string; outstanding: bigint; overdue: bigint }>();
  for (const [status, bucket] of Object.entries(counts)) {
    if (!["received", "partial", "overdue"].includes(status)) continue;
    const code = currencyMetadata(bucket.currencyCode).code;
    const group = currencies.get(code) ?? { currencyCode: code, outstanding: 0n, overdue: 0n };
    group.outstanding = checkedMinor(group.outstanding + bucket.amount);
    if (status === "overdue") group.overdue = bucket.amount;
    currencies.set(code, group);
  }
  return { total: row.total, counts, currencies: [...currencies.values()].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)) };
}

/** This is an explicitly labelled page sample, grouped by source currency; no FX. */
export function billUiAging(bills: readonly { status: string; dueDate: string; amountDue: bigint; currencyCode: string }[], now = new Date()) {
  type Bucket = { count: number; amount: bigint };
  const currencies = new Map<string, { currencyCode: string; buckets: Record<"current" | "1-30" | "31-60" | "60+", Bucket>; total: bigint }>();
  for (const bill of bills) {
    if (!["received", "partial", "overdue"].includes(bill.status) || bill.amountDue <= 0n) continue;
    const code = currencyMetadata(bill.currencyCode).code;
    const group = currencies.get(code) ?? { currencyCode: code, total: 0n, buckets: {
      current: { count: 0, amount: 0n }, "1-30": { count: 0, amount: 0n },
      "31-60": { count: 0, amount: 0n }, "60+": { count: 0, amount: 0n },
    } };
    const days = Math.floor((now.getTime() - new Date(bill.dueDate).getTime()) / 86400000);
    if (!Number.isFinite(days)) throw new RangeError("Invalid bill due date");
    const key = days <= 0 ? "current" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : "60+";
    group.buckets[key].count++;
    group.buckets[key].amount = checkedMinor(group.buckets[key].amount + bill.amountDue);
    group.total = checkedMinor(group.total + bill.amountDue);
    currencies.set(code, group);
  }
  return [...currencies.values()].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
}

/** Debit notes accept this subset of bill dimensions. Do not send unsupported inventory/receipt fields. */
export function billUiSupplierCreditLines(lines: readonly { description: string; quantity: number; unitPrice: bigint;
  accountId?: string | null; account?: { id: string } | null; taxRateId?: string | null;
  taxRate?: { id: string } | null; costCenterId?: string | null; discountPercent?: number }[], currency: string) {
  currencyMetadata(currency);
  return lines.map(line => ({ description: line.description, quantity: line.quantity / 100,
    unitPriceExact: invoiceUiDecimal(line.unitPrice, currency),
    accountId: line.accountId ?? line.account?.id ?? null,
    taxRateId: line.taxRateId ?? line.taxRate?.id ?? null,
    costCenterId: line.costCenterId ?? null, discountPercent: line.discountPercent ?? 0 }));
}
