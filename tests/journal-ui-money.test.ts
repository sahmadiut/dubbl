import assert from "node:assert/strict";
import { test } from "node:test";
import { journalDisplayCurrency, journalInputMinor, journalRestMinor, journalStoredMinor, journalDecimal, journalMoney, journalEditorPreview, journalSideDisplay } from "../lib/money/journal-display";
import { journalLineInput, journalTotals, journalLineDto } from "../lib/api/journal-wire";
import { recurringJournalLegs } from "../lib/api/recurring-journal-wire";

const accountId = "00000000-0000-4000-8000-000000000001";
const row = (debit: string, credit = "", currencyCode = "USD") => ({ accountId, description: "UI line", debit, credit, currencyCode });

test("journal UI preserves currency scale and safe-edge low digits through actual wire adapters", () => {
  for (const [currency, text, minor] of [
    ["USD", "90071992547409.91", "9007199254740991"],
    ["IRR", "1250", "1250"], ["JPY", "1250", "1250"], ["KWD", "1.251", "1251"],
  ]) {
    const preview = journalEditorPreview([row(text, "", currency), row("", text, currency)]);
    assert.equal(preview.error, null); assert.equal(preview.isBalanced, true);
    assert.equal(String(preview.totalDebit), minor);
    const saved = preview.lines.map(journalLineInput);
    assert.equal(journalTotals(saved).totalDebit, Number(minor));
    const rest = journalLineDto(saved[0], true);
    assert.equal(String(journalRestMinor(String(rest.debitAmount), rest.debitAmountMinor)), minor);
    assert.equal(journalDecimal(journalRestMinor(String(rest.debitAmount), rest.debitAmountMinor), currency), text);
    assert.equal(String(recurringJournalLegs(preview.lines.map(({ accountId, description, debitAmountMinor, creditAmountMinor }) => ({ accountId, description, debitAmountMinor, creditAmountMinor })), currency)[0].debitAmount), minor);
  }
});

test("journal preview, write and saved totals agree without decimal sum tolerance", () => {
  const preview = journalEditorPreview([row("0.10"), row("0.20"), row("", "0.30")]);
  assert.equal(preview.isBalanced, true); assert.equal(preview.totalDebit, 30n);
  assert.equal(journalDecimal(preview.totalDebit), "0.30");
  const low = journalEditorPreview([row("40000000000000.01"), row("0.02"), row("", "40000000000000.03")]);
  assert.equal(low.isBalanced, true); assert.equal(low.totalDebit, 4000000000000003n);
  assert.equal(journalEditorPreview([row("0.10"), row("", "0.11")]).isBalanced, false);
});

test("invalid journal cells, orphan amounts and out-of-range totals block saving", () => {
  for (const value of ["1e2", "1x", "NaN", "Infinity", "-1", ".5", "1.", "1,000", " 1", "0.001", "90071992547409.92"]) {
    const preview = journalEditorPreview([row(value), row("", "1")]);
    assert.ok(preview.error, value); assert.equal(preview.isBalanced, false);
  }
  assert.equal(journalInputMinor(""), 0n);
  assert.throws(() => journalInputMinor("0.1", "JPY"));
  assert.throws(() => journalInputMinor("1.0001", "KWD"));
  assert.ok(journalEditorPreview([{ ...row("1"), accountId: "" }, row("", "1")]).error);
  assert.ok(journalEditorPreview([row("1", "1"), row("", "1")], { oneSided: true }).error);
  assert.equal(journalEditorPreview([row("1", "1"), row("1", "1")]).isBalanced, true);
  assert.ok(journalEditorPreview([row("90071992547409.91"), row("0.01"), row("", "1")]).error);
  assert.equal(journalEditorPreview([row("1"), row("", "1"), { ...row(""), accountId: "" }]).lines.length, 2);
});

test("fixed-two REST aliases never rescale stored JPY/KWD amounts; conflicts fail closed", () => {
  assert.equal(journalRestMinor("12.50", "1250"), 1250n);
  assert.equal(journalRestMinor("12.50"), 1250n);
  assert.throws(() => journalRestMinor("12.50", "1251"));
  assert.throws(() => journalStoredMinor("01"));
  assert.throws(() => journalStoredMinor(Number.MAX_SAFE_INTEGER + 1));
  assert.equal(journalDecimal(1250n, "JPY"), "1250");
  assert.equal(journalDecimal(1250n, "KWD"), "1.250");
  assert.equal(journalDisplayCurrency("manual", "KWD"), "KWD");
  assert.equal(journalDisplayCurrency("recurring_journal", "JPY"), "JPY");
  assert.equal(journalDisplayCurrency(null, "IRR"), "IRR");
  // The automated tag can be the source document; keep its legacy presentation.
  assert.equal(journalDisplayCurrency("invoice", "KWD"), "USD");
});

test("English money displays exact fractions, negative zero and separate currency totals", () => {
  assert.equal(journalMoney(1250n), "$12.50");
  assert.equal(journalMoney(-1n), "-$0.01");
  assert.match(journalMoney(9007199254740991n), /90,071,992,547,409\.91/);
  assert.match(journalMoney(1251n, "KWD"), /1\.251/);
  const lines = [{ currencyCode: "USD", debitAmountMinor: "1250", creditAmountMinor: "0" }, { currencyCode: "JPY", debitAmountMinor: "1250", creditAmountMinor: "0" }];
  assert.match(journalSideDisplay(lines, "debitAmountMinor"), /\$12\.50 · ¥1,250/);
});

test("draft edits retain saved line currency, FX and allocation metadata", () => {
  const preview = journalEditorPreview([row("1.251", "", "KWD"), row("", "1.251", "KWD")].map(line => ({ ...line, exchangeRate: 1234567, costCenterId: accountId, projectId: accountId })));
  for (const line of preview.lines.map(journalLineInput)) {
    assert.equal(line.currencyCode, "KWD"); assert.equal(line.exchangeRate, 1234567);
    assert.equal(line.rateExact, "1.234567"); assert.equal(line.costCenterId, accountId); assert.equal(line.projectId, accountId);
  }
});
