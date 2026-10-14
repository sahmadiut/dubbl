import { z } from "zod";
import { currencyMetadata } from "./exact";
import { coreStoredMinor } from "./core-presentation";
export { financialStatementJson as ledgerAgingJson, statementUiMoney as reportUiMoney } from "./financial-statement-ui";

const currency = z.string().refine(value => {
  try { return currencyMetadata(value).code === value; } catch { return false; }
}, "A canonical report currency is required");
const exact = z.string().regex(/^(0|-?[1-9]\d*)$/);
const numeric = z.number().refine(value => Number.isSafeInteger(value) && !Object.is(value, -0));
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const dates = { startDate: z.string(), endDate: z.string() };
const dimension = { dimension: z.enum(["costCenterId", "projectId"]).optional(), dimensionValue: z.string().nullable().optional() };
const alias = <K extends string>(key: K) => ({ [key]: numeric, [`${key}Minor`]: exact }) as Record<K, typeof numeric> & Record<`${K}Minor`, typeof exact>;
const line = z.object({ date: z.string(), entryNumber: count, description: z.string().nullable(), reference: z.string().nullable(),
  entryId: z.string(), lineId: z.string(), ...alias("debit"), ...alias("credit"), ...alias("runningBalance"), ...alias("ledgerBalance"),
}).transform(row => {
  const debit = coreStoredMinor(row.debit, row.debitMinor), credit = coreStoredMinor(row.credit, row.creditMinor);
  if (debit < 0n || credit < 0n) throw new RangeError("Negative ledger movement");
  return { ...row, debit, credit, runningBalance: coreStoredMinor(row.runningBalance, row.runningBalanceMinor),
    ledgerBalance: coreStoredMinor(row.ledgerBalance, row.ledgerBalanceMinor) };
});
const summary = z.object({ entries: z.array(line), totalEntries: count, ...alias("totalDebit"), ...alias("totalCredit"),
  ...alias("balance"), ...alias("openingBalance"), ...alias("closingLedgerBalance"),
}).transform(row => {
  const totalDebit = coreStoredMinor(row.totalDebit, row.totalDebitMinor), totalCredit = coreStoredMinor(row.totalCredit, row.totalCreditMinor);
  const balance = coreStoredMinor(row.balance, row.balanceMinor), openingBalance = coreStoredMinor(row.openingBalance, row.openingBalanceMinor);
  const closingLedgerBalance = coreStoredMinor(row.closingLedgerBalance, row.closingLedgerBalanceMinor);
  if (totalDebit < 0n || totalCredit < 0n || openingBalance + balance !== closingLedgerBalance) throw new RangeError("Ledger summary disagrees");
  return { ...row, totalDebit, totalCredit, balance, openingBalance, closingLedgerBalance };
});
const account = summary.and(z.object({ accountId: z.string(), accountName: z.string(), accountCode: z.string(),
  accountType: z.enum(["asset", "expense", "revenue", "liability", "equity"]),
}));
export type AccountLedgerUi = z.infer<typeof account>;
export type LedgerEntryUi = z.infer<typeof line> & { currencyCode: string };
const natural = (type: AccountLedgerUi["accountType"], debit: bigint, credit: bigint) =>
  type === "asset" || type === "expense" ? debit - credit : credit - debit;

function validateEntries(row: AccountLedgerUi) {
  if (row.entries.length > row.totalEntries || new Set(row.entries.map(entry => entry.lineId)).size !== row.entries.length ||
    natural(row.accountType, row.totalDebit, row.totalCredit) !== row.balance) throw new RangeError("Ledger totals disagree");
  let debit = 0n, credit = 0n;
  for (const entry of row.entries) {
    debit += entry.debit; credit += entry.credit;
    if (entry.runningBalance !== natural(row.accountType, debit, credit) || entry.ledgerBalance !== row.openingBalance + entry.runningBalance) {
      throw new RangeError("Ledger running balance disagrees");
    }
  }
  if (row.entries.length === row.totalEntries && (debit !== row.totalDebit || credit !== row.totalCredit)) throw new RangeError("Ledger entries disagree");
}
export function generalLedgerUi(value: unknown) {
  const data = z.object({ ...dates, ...dimension, currencyCode: currency, accounts: z.array(account) }).parse(value);
  if (new Set(data.accounts.map(row => row.accountId)).size !== data.accounts.length) throw new RangeError("Duplicate ledger account");
  data.accounts.forEach(validateEntries);
  return data;
}
export type GeneralLedgerUi = ReturnType<typeof generalLedgerUi>;
export function ledgerPageUi(value: unknown) {
  return summary.and(z.object({ ...dates, ...dimension, currencyCode: currency, offset: count, limit: count.min(1) })).parse(value);
}
/** A page must describe the same snapshot/context before it can append to loaded state. */
export function appendLedgerPage(data: GeneralLedgerUi, accountId: string, page: ReturnType<typeof ledgerPageUi>) {
  const current = data.accounts.find(row => row.accountId === accountId);
  if (!current || page.offset !== current.entries.length || page.entries.length > page.limit ||
    page.currencyCode !== data.currencyCode || page.startDate !== data.startDate || page.endDate !== data.endDate ||
    page.dimension !== data.dimension || page.dimensionValue !== data.dimensionValue ||
    (["totalEntries", "totalDebit", "totalCredit", "balance", "openingBalance", "closingLedgerBalance"] as const).some(key => page[key] !== current[key])) {
    throw new RangeError("Ledger changed while loading. Please reload the report.");
  }
  const updated = { ...current, entries: [...current.entries, ...page.entries] };
  validateEntries(updated);
  return { ...data, accounts: data.accounts.map(row => row.accountId === accountId ? updated : row) };
}
export function ledgerExportRows(data: GeneralLedgerUi) {
  return data.accounts.flatMap(row => row.entries.map(entry => ({ account: row.accountCode, accountName: row.accountName,
    currencyCode: data.currencyCode, ...entry, debit: entry.debitMinor, credit: entry.creditMinor,
    runningBalance: entry.runningBalanceMinor, ledgerBalance: entry.ledgerBalanceMinor })));
}

const cashRow = z.object({ accountName: z.string(), accountCode: z.string(), ...alias("amount") })
  .transform(row => ({ ...row, amount: coreStoredMinor(row.amount, row.amountMinor) }));
export function cashFlowUi(value: unknown) {
  const row = z.object({ ...dates, currencyCode: currency, operating: z.array(cashRow), investing: z.array(cashRow), financing: z.array(cashRow),
    ...alias("totalOperating"), ...alias("totalInvesting"), ...alias("totalFinancing"), ...alias("netCashFlow"),
  }).parse(value);
  const totalOperating = coreStoredMinor(row.totalOperating, row.totalOperatingMinor), totalInvesting = coreStoredMinor(row.totalInvesting, row.totalInvestingMinor);
  const totalFinancing = coreStoredMinor(row.totalFinancing, row.totalFinancingMinor), netCashFlow = coreStoredMinor(row.netCashFlow, row.netCashFlowMinor);
  if (row.operating.reduce((sum, r) => sum + r.amount, 0n) !== totalOperating || row.investing.reduce((sum, r) => sum + r.amount, 0n) !== totalInvesting ||
    row.financing.reduce((sum, r) => sum + r.amount, 0n) !== totalFinancing || totalOperating + totalInvesting + totalFinancing !== netCashFlow) {
    throw new RangeError("Cash-flow totals disagree");
  }
  return { ...row, totalOperating, totalInvesting, totalFinancing, netCashFlow };
}
export type CashFlowUi = ReturnType<typeof cashFlowUi>;

const item = z.object({ id: z.string(), contactName: z.string(), dueDate: z.string(), currencyCode: currency,
  daysOverdue: count, ...alias("amountDue"),
}).transform(row => ({ ...row, amountDue: coreStoredMinor(row.amountDue, row.amountDueMinor) }));
const bucketLabels = ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"];
export function agingUi(value: unknown, kind: "invoices" | "bills") {
  const document = item.and(z.object({ invoiceNumber: z.string().optional(), billNumber: z.string().optional() }))
    .refine(row => typeof row[kind === "invoices" ? "invoiceNumber" : "billNumber"] === "string", "Missing document number");
  const bucket = z.object({ label: z.string(), count, ...alias("total"), invoices: z.array(document).optional(), bills: z.array(document).optional() })
    .refine(row => Array.isArray(row[kind]), "Missing aging documents");
  const data = z.object({ asAt: z.string(), currencyCode: currency, ...alias("grandTotal"), buckets: z.array(bucket).length(5) }).parse(value);
  const seen = new Set<string>();
  const buckets = data.buckets.map((row, i) => {
    const items = row[kind]!;
    const total = coreStoredMinor(row.total, row.totalMinor);
    if (row.label !== bucketLabels[i] || row.count !== items.length || items.reduce((sum, r) => sum + r.amountDue, 0n) !== total) {
      throw new RangeError("Aging bucket totals disagree");
    }
    for (const document of items) {
      if (document.currencyCode !== data.currencyCode || seen.has(document.id)) throw new RangeError("Aging currency or document disagrees");
      seen.add(document.id);
    }
    return { label: row.label, count: row.count, total, totalMinor: row.totalMinor, items };
  });
  const grandTotal = coreStoredMinor(data.grandTotal, data.grandTotalMinor);
  if (buckets.reduce((sum, row) => sum + row.total, 0n) !== grandTotal) throw new RangeError("Aging grand total disagrees");
  return { asAt: data.asAt, currencyCode: data.currencyCode, buckets, grandTotal };
}
export type AgingUi = ReturnType<typeof agingUi>;
export type AgingItemUi = AgingUi["buckets"][number]["items"][number];
export const receivablesUi = (value: unknown) => agingUi(value, "invoices");
export const payablesUi = (value: unknown) => agingUi(value, "bills");
export function agingExportRows(data: AgingUi) {
  return data.buckets.flatMap(bucket => bucket.items.map(row => ({ ...row, bucket: bucket.label, amountDue: row.amountDueMinor })));
}
