import { journalInputMinor, journalStoredMinor } from "./journal-display";

// The existing REST/MCP opening-balance operation accepts numeric cents only and
// inserts default USD journal tags. Keep this compatibility policy explicit;
// organization currency metadata cannot change these stored units.
export const OPENING_BALANCE_CURRENCY = "USD";
export type OpeningBalanceRow = { accountId: string; debit: string; credit: string };
export type OpeningBalanceWrite = { accountId: string; debitAmount: number; creditAmount: number };

export function openingBalancePreview(rows: readonly OpeningBalanceRow[]) {
  try {
    const balances = rows.map(row => {
      const debit = journalInputMinor(row.debit, OPENING_BALANCE_CURRENCY);
      const credit = journalInputMinor(row.credit, OPENING_BALANCE_CURRENCY);
      if (!row.accountId && (debit > 0n || credit > 0n)) throw new RangeError("Select an account for every amount");
      // Checked numeric bridge for this operation's existing wire schema.
      return { accountId: row.accountId, debitAmount: Number(debit), creditAmount: Number(credit) };
    }).filter(row => row.accountId && (row.debitAmount > 0 || row.creditAmount > 0));
    const totalDebit = balances.reduce((sum, row) => sum + BigInt(row.debitAmount), 0n);
    const totalCredit = balances.reduce((sum, row) => sum + BigInt(row.creditAmount), 0n);
    // The endpoint also sums Numbers. Nonnegative totals within the safe range
    // ensure every intermediate sum is exact, regardless of row order.
    journalStoredMinor(totalDebit.toString());
    journalStoredMinor(totalCredit.toString());
    return { balances, totalDebit, totalCredit, isBalanced: totalDebit > 0n && totalDebit === totalCredit, error: null };
  } catch (error) {
    return { balances: [], totalDebit: 0n, totalCredit: 0n, isBalanced: false,
      error: error instanceof Error ? error.message : "Enter valid opening balances" };
  }
}

export type OpeningBalanceSavedLine = {
  id: string; debitAmount: number; creditAmount: number;
  debitAmountMinor?: string; creditAmountMinor?: string;
  account: { code: string; name: string } | null;
};

function savedMinor(numeric: number, alias?: string) {
  const amount = journalStoredMinor(numeric);
  if (amount < 0n) throw new RangeError("Opening balance amounts must be nonnegative");
  if (alias !== undefined && journalStoredMinor(alias) !== amount) throw new RangeError("Opening balance amount aliases disagree");
  return amount;
}

export function openingBalanceSaved(lines: readonly OpeningBalanceSavedLine[]) {
  const amounts = lines.map(line => ({ ...line,
    debit: savedMinor(line.debitAmount, line.debitAmountMinor),
    credit: savedMinor(line.creditAmount, line.creditAmountMinor),
  }));
  return { lines: amounts,
    totalDebit: amounts.reduce((sum, line) => sum + line.debit, 0n),
    totalCredit: amounts.reduce((sum, line) => sum + line.credit, 0n),
  };
}
