import { currencyMetadata, parseMajor, money, toMajorDecimal } from "./exact";
import { bankMoneyDisplay } from "./bank-display";

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);
function supported(amount: bigint) {
  if (amount < -SAFE || amount > SAFE) throw new RangeError("Journal amount exceeds the supported range");
  return amount;
}

/** UI major text uses the explicit currency scale; blank cells mean zero. */
export function journalInputMinor(value: string, currency = "USD") {
  if (value !== "" && !/^\d+(?:\.\d+)?$/.test(value)) throw new RangeError("Enter a nonnegative decimal amount");
  return supported(parseMajor(value || "0", currency, "reject").amountMinor);
}

/** REST journal decimal aliases are historically fixed-two, regardless of the tag. */
export function journalRestMinor(decimal: string, exact?: string) {
  const legacy = supported(parseMajor(decimal, "USD", "reject").amountMinor);
  if (exact !== undefined && journalStoredMinor(exact) !== legacy) throw new RangeError("Journal amount aliases disagree");
  return exact === undefined ? legacy : journalStoredMinor(exact);
}

export function journalStoredMinor(value: number | string) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new RangeError("Journal amount must be an exact integer");
  if (typeof value === "string" && !/^(0|-?[1-9]\d*)$/.test(value)) throw new RangeError("Journal minor amount must be canonical");
  return supported(BigInt(value));
}

export function journalDecimal(amount: bigint, currency = "USD") {
  return toMajorDecimal(money(amount, currency));
}
export function journalMoney(amount: bigint, currency = "USD") {
  return bankMoneyDisplay(amount, currency);
}

/** Automated GL tags may name the source document, not the stored amount currency.
 * Retain their historical fixed-two display until MON-133 resolves base presentation.
 */
export function journalDisplayCurrency(sourceType: string | null, lineCurrency: string) {
  return sourceType === null || sourceType === "manual" || sourceType === "recurring_journal" ? lineCurrency : "USD";
}

export type JournalEditorRow = {
  accountId: string; description?: string; debit: string; credit: string;
  currencyCode?: string; exchangeRate?: number; costCenterId?: string | null; projectId?: string | null;
};

/** Validate the same rows used in previews and writes; never silently drop an amount. */
export function journalEditorPreview(rows: readonly JournalEditorRow[], { oneSided = false } = {}) {
  try {
    const lines = rows.map(row => {
      const currencyCode = currencyMetadata(row.currencyCode ?? "USD").code;
      const debit = journalInputMinor(row.debit, currencyCode), credit = journalInputMinor(row.credit, currencyCode);
      if (!row.accountId && (debit > 0n || credit > 0n)) throw new RangeError("Select an account for every amount");
      if (oneSided && debit > 0n && credit > 0n) throw new RangeError("Use either debit or credit on each line");
      return { accountId: row.accountId, description: row.description?.trim() || null,
        debitAmountMinor: String(debit), creditAmountMinor: String(credit), currencyCode,
        exchangeRate: row.exchangeRate ?? 1000000, costCenterId: row.costCenterId, projectId: row.projectId };
    }).filter(line => line.accountId && (line.debitAmountMinor !== "0" || line.creditAmountMinor !== "0"));
    const totalDebit = supported(lines.reduce((sum, line) => sum + BigInt(line.debitAmountMinor), 0n));
    const totalCredit = supported(lines.reduce((sum, line) => sum + BigInt(line.creditAmountMinor), 0n));
    const isBalanced = lines.length >= 2 && totalDebit > 0n && totalDebit === totalCredit;
    return { lines, totalDebit, totalCredit, isBalanced, error: null };
  } catch (error) {
    return { lines: [], totalDebit: 0n, totalCredit: 0n, isBalanced: false,
      error: error instanceof Error ? error.message : "Enter valid journal amounts" };
  }
}

/** Keep different saved currencies separate; no implicit FX in a display total. */
export function journalSideDisplay(lines: readonly { currencyCode?: string; debitAmountMinor: string; creditAmountMinor: string }[], side: "debitAmountMinor" | "creditAmountMinor" | "difference") {
  const totals = new Map<string, bigint>();
  for (const line of lines) {
    const code = line.currencyCode ?? "USD";
    const amount = side === "difference" ? journalStoredMinor(line.debitAmountMinor) - journalStoredMinor(line.creditAmountMinor) : journalStoredMinor(line[side]);
    totals.set(code, (totals.get(code) ?? 0n) + amount);
  }
  return [...totals].map(([code, amount]) => journalMoney(side === "difference" && amount < 0n ? -amount : amount, code)).join(" · ") || journalMoney(0n);
}
