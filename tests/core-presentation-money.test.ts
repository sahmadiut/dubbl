import assert from "node:assert/strict";
import { test } from "node:test";
import { coreStoredMinor, coreAccountMoney, coreLedgerMoney, coreJournalSummary, coreDebitDisplay, coreDebitCompare, coreJournalDetail } from "../lib/money/core-presentation";
import { journalMoney } from "../lib/money/journal-display";

test("account numeric minor aliases preserve exact low digits and explicit GL scale", () => {
  for (const [code, expected] of [["USD", /12\.51/], ["JPY", /1,251/], ["IRR", /1,251/], ["KWD", /1\.251/]] as const) {
    const row = coreAccountMoney({ balance: -1251, balanceMinor: "-1251", totalDebits: 0, totalDebitsMinor: "0", totalCredits: 1251, totalCreditsMinor: "1251", amountCurrencyCode: code });
    assert.match(journalMoney(coreStoredMinor(row.balance, row.balanceMinor), code), expected);
    assert.match(journalMoney(coreStoredMinor(9007199254740991, "9007199254740991"), "USD"), /90,071,992,547,409\.91/);
    coreLedgerMoney({ debitAmount: 0, debitAmountMinor: "0", creditAmount: 1251, creditAmountMinor: "1251", balance: -1251, balanceMinor: "-1251", amountCurrencyCode: code });
  }
});
test("malformed, missing, unsafe and disagreeing aliases fail before presentation", () => {
  for (const exact of ["01", "+1", "1.0", "1e3", " 1", "9007199254740992", "-0"]) assert.throws(() => coreStoredMinor(1, exact));
  assert.throws(() => coreStoredMinor(1.5, "1"));
  assert.throws(() => coreStoredMinor(2, "1"));
  assert.throws(() => coreStoredMinor("1" as unknown as number, "1"));
  assert.throws(() => coreStoredMinor(1, undefined as unknown as string));
  assert.throws(() => coreJournalDetail({ lines: [{ debitAmount: "0.01", debitAmountMinor: "1", creditAmount: "0.00", creditAmountMinor: "0", amountCurrencyCode: "BAD" }] }));
});
test("journal summaries reconcile legacy fixed-two aliases and keep currency groups separate", () => {
  const row = coreJournalSummary({ totalDebit: "25.02", totalDebitMinor: "2502", debitTotals: [
    { currencyCode: "JPY", totalDebit: 1251, totalDebitMinor: "1251" }, { currencyCode: "KWD", totalDebit: 1251, totalDebitMinor: "1251" },
  ] });
  assert.match(coreDebitDisplay([row]), /1,251.*1\.251/);
  assert.match(coreDebitDisplay([row, row]), /2,502.*2\.502/);
  assert.throws(() => coreJournalSummary({ ...row, totalDebit: "25.03" }));
  assert.throws(() => coreJournalSummary({ ...row, debitTotals: [row.debitTotals[0]] }));
  assert.throws(() => coreJournalSummary({ ...row, debitTotals: [row.debitTotals[0], row.debitTotals[0]] }));
  const large = { debitTotals: [{ currencyCode: "USD", totalDebit: Number.MAX_SAFE_INTEGER, totalDebitMinor: String(Number.MAX_SAFE_INTEGER) }] };
  assert.match(coreDebitDisplay([large, large]), /180,143,985,094,819\.82/);
  assert.equal(coreDebitCompare({ debitTotals: [row.debitTotals[0]] }, { debitTotals: [row.debitTotals[1]] }), -1);
});
