import assert from "node:assert/strict";
import { test } from "node:test";
import { journalImportDecimal, journalImportRow, parseJournalImportRows, previewJournalImport } from "../lib/api/journal-import-wire";

const row = { date: "2026-10-02", description: "Import", lineAccountCode: "100" };
test("journal REST decimal units retain exact two-place money without floating rounding", () => {
  for (const [input, expected] of [["12.50", 1250], [12.5, 1250], ["1,234.56", 123456], ["1.234,56", 123456], ["$ 12.50", 1250], ["", 0], ["90071992547409.91", Number.MAX_SAFE_INTEGER]] as const) {
    assert.equal(journalImportDecimal(input), expected);
  }
  for (const input of ["12abc", "1e3", "-1", "(12.50)", "1.005", "1,23", "۱۲.۵۰", "Infinity"]) assert.throws(() => journalImportDecimal(input));
  assert.throws(() => journalImportDecimal("90071992547409.92"), /safe|range/i);
  assert.throws(() => journalImportDecimal("999999999999999999999999999999"), /safe|range/i);
  assert.throws(() => journalImportDecimal(90071992547409.91), /strings/i);
});
test("journal import aliases preserve distinct REST decimal and MCP minor units", () => {
  assert.equal(journalImportRow({ ...row, debit: "12.50" }, true).debitAmount, 1250);
  assert.equal(journalImportRow({ ...row, debit: 1250 }).debitAmount, 1250);
  for (const rest of [true, false]) {
    assert.equal(journalImportRow({ ...row, debitAmountMinor: "1250" }, rest).debitAmount, 1250);
    assert.equal(journalImportRow({ ...row, debit: rest ? "12.50" : 1250, debitAmountMinor: "1250" }, rest).debitAmount, 1250);
    assert.throws(() => journalImportRow({ ...row, debit: rest ? "1" : 1, debitAmountMinor: "2" }, rest), /disagree/);
    for (const value of ["01", "-1", "1e2", "9223372036854775808"]) assert.throws(() => journalImportRow({ ...row, debitAmountMinor: value }, rest));
    assert.throws(() => journalImportRow({ ...row, debitAmountMinor: "9007199254740992" }, rest));
  }
});
test("journal import guards group sums and previews exact totals and invalid groups", () => {
  const rows = [{ ...row, debitAmountMinor: "9007199254740991" }, { ...row, creditAmountMinor: "9007199254740991" }];
  const preview = previewJournalImport(rows);
  assert.equal(preview.entries[0].totalDebitMinor, "9007199254740991");
  assert.equal(preview.entries[0].imbalanceMinor, "0");
  assert.equal(preview.balancedEntryCount, 1);
  assert.throws(() => parseJournalImportRows([...rows, { ...row, debit: 1 }]));
  const invalid = previewJournalImport([{ ...row, debit: "12.50" }, { ...row, credit: "12.50" }, { ...row, debit: "junk" }], true);
  assert.equal(invalid.validCount, 2); assert.equal(invalid.balancedEntryCount, 0);
  assert.equal(previewJournalImport([{ ...row, debit: 1, credit: 1 }, { ...row }]).balancedEntryCount, 0);
  assert.throws(() => parseJournalImportRows([{ ...row, date: "2026-02-30" }]));
  assert.equal(parseJournalImportRows([{ ...row, date: "10/02/2026", debit: "12.50" }], true, "quickbooks")[0].date, "2026-10-02");
});
