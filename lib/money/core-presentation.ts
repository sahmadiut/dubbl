import { currencyMetadata } from "./exact";
import { journalRestMinor, journalStoredMinor, journalMoney } from "./journal-display";
import type { NumberPresentation } from "../../i18n/numbers";

/** Account REST/MCP fields are integer minor units, not decimal-major strings. */
export function coreStoredMinor(value: number, exact: string) {
  if (typeof value !== "number" || typeof exact !== "string") throw new RangeError("Money aliases are required");
  const amount = journalStoredMinor(exact);
  if (journalStoredMinor(value) !== amount) throw new RangeError("Money aliases disagree");
  return amount;
}
export type DebitGroup = { currencyCode: string; totalDebit: number; totalDebitMinor: string };
export type JournalSummary = { totalDebit: string; totalDebitMinor: string; debitTotals: DebitGroup[] };
export function coreJournalSummary<T extends JournalSummary>(row: T): T {
  if (typeof row.totalDebitMinor !== "string") throw new RangeError("Journal exact total is required");
  const raw = journalRestMinor(row.totalDebit, row.totalDebitMinor);
  if (!Array.isArray(row.debitTotals)) throw new RangeError("Journal currency totals are required");
  const seen = new Set<string>();
  let sum = 0n;
  for (const group of row.debitTotals) {
    const code = currencyMetadata(group.currencyCode).code;
    if (seen.has(code)) throw new RangeError("Duplicate journal currency total");
    seen.add(code);
    const amount = coreStoredMinor(group.totalDebit, group.totalDebitMinor);
    if (amount < 0n) throw new RangeError("Journal debit must be nonnegative");
    sum += amount;
  }
  if (sum !== raw) throw new RangeError("Journal currency totals disagree with raw total");
  return row;
}
export function coreDebitDisplay(rows: readonly { debitTotals: DebitGroup[] }[], presentation: NumberPresentation = { locale: "en-US", numerals: "latn" }) {
  const groups = new Map<string, bigint>();
  for (const row of rows) for (const group of row.debitTotals) {
    const code = currencyMetadata(group.currencyCode).code;
    groups.set(code, (groups.get(code) ?? 0n) + coreStoredMinor(group.totalDebit, group.totalDebitMinor));
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([code, amount]) => journalMoney(amount, code, presentation)).join(" · ") || "—";
}
/** Amount sorting groups unlike currencies first; only like-unit values are compared. */
export function coreDebitCompare(a: { debitTotals: DebitGroup[] }, b: { debitTotals: DebitGroup[] }) {
  const left = [...a.debitTotals].sort((x, y) => x.currencyCode.localeCompare(y.currencyCode));
  const right = [...b.debitTotals].sort((x, y) => x.currencyCode.localeCompare(y.currencyCode));
  const currencies = left.map(g => g.currencyCode).join(",").localeCompare(right.map(g => g.currencyCode).join(","));
  if (currencies) return currencies;
  for (let i = 0; i < left.length; i++) {
    const x = coreStoredMinor(left[i].totalDebit, left[i].totalDebitMinor), y = coreStoredMinor(right[i].totalDebit, right[i].totalDebitMinor);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
export type AccountMoney = { balance: number; balanceMinor: string; totalDebits: number; totalDebitsMinor: string; totalCredits: number; totalCreditsMinor: string; amountCurrencyCode: string };
export function coreAccountMoney<T extends AccountMoney>(row: T): T {
  currencyMetadata(row.amountCurrencyCode);
  coreStoredMinor(row.balance, row.balanceMinor);
  if (coreStoredMinor(row.totalDebits, row.totalDebitsMinor) < 0n || coreStoredMinor(row.totalCredits, row.totalCreditsMinor) < 0n) throw new RangeError("Account movements must be nonnegative");
  return row;
}
export type LedgerMoney = { debitAmount: number; debitAmountMinor: string; creditAmount: number; creditAmountMinor: string; balance: number; balanceMinor: string; amountCurrencyCode: string };
export function coreLedgerMoney<T extends LedgerMoney>(row: T): T {
  currencyMetadata(row.amountCurrencyCode);
  coreStoredMinor(row.balance, row.balanceMinor);
  if (coreStoredMinor(row.debitAmount, row.debitAmountMinor) < 0n || coreStoredMinor(row.creditAmount, row.creditAmountMinor) < 0n) throw new RangeError("Ledger movements must be nonnegative");
  return row;
}
export function coreJournalDetail<T extends { lines: { debitAmount: string; debitAmountMinor: string; creditAmount: string; creditAmountMinor: string; amountCurrencyCode: string }[] }>(entry: T): T {
  for (const line of entry.lines) {
    if (typeof line.debitAmountMinor !== "string" || typeof line.creditAmountMinor !== "string") throw new RangeError("Journal exact amounts are required");
    currencyMetadata(line.amountCurrencyCode);
    if (journalRestMinor(line.debitAmount, line.debitAmountMinor) < 0n || journalRestMinor(line.creditAmount, line.creditAmountMinor) < 0n) throw new RangeError("Journal movements must be nonnegative");
  }
  return entry;
}
