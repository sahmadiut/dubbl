import assert from "node:assert/strict";
import { test } from "node:test";
import { journalLineInput, journalTotals, journalTotalDebit, journalLegacyDecimal, journalLineDto } from "../lib/api/journal-wire";
import { WireCompatibilityError } from "../lib/money/wire";
import { z } from "zod";

const accountId = "00000000-0000-4000-8000-000000000001";
test("journal aliases preserve units, defaults and exact millionths; reject conflicts and unsupported ranges", () => {
  for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
    const line = journalLineInput({ accountId, currencyCode, debitAmountMinor: "1250", rateExact: "1.250000" });
    assert.equal(line.debitAmount, 1250); assert.equal(line.creditAmount, 0);
    assert.equal(line.exchangeRate, 1250000); assert.equal(line.rateExact, "1.25");
    assert.equal(line.currencyCode, currencyCode);
  }
  assert.equal(journalLineInput({ accountId }).exchangeRate, 1000000);
  assert.equal(journalLineInput({ accountId, debitAmount: 0, debitAmountMinor: "0" }).debitAmount, 0);
  for (const fields of [{ debitAmount: 1, debitAmountMinor: "2" }, { debitAmountMinor: "01" },
    { debitAmountMinor: "-1" }, { debitAmountMinor: "1e2" }, { debitAmountMinor: "۱۲۵۰" },
    { debitAmount: Number.MAX_SAFE_INTEGER + 1 }, { rateExact: "1.2", exchangeRate: 1000000 },
    { exchangeRate: 0 }, { rateDirection: "base_per_quote" }]) {
    assert.throws(() => journalLineInput({ accountId, ...fields }), z.ZodError);
  }
  for (const fields of [{ debitAmountMinor: "9007199254740992" }, { rateExact: "0.0000001" }, { rateExact: "2147.483648" }]) {
    assert.throws(() => journalLineInput({ accountId, ...fields }), WireCompatibilityError);
  }
});

test("journal guards raw sums and conversion products before Number math without changing legacy balance policy", () => {
  const debit = journalLineInput({ accountId, debitAmountMinor: String(Number.MAX_SAFE_INTEGER) });
  const credit = journalLineInput({ accountId, creditAmountMinor: String(Number.MAX_SAFE_INTEGER) });
  assert.equal(journalTotals([debit, credit]).totalDebit, Number.MAX_SAFE_INTEGER);
  assert.throws(() => journalTotalDebit([debit, journalLineInput({ accountId, debitAmount: 1 })]), WireCompatibilityError);
  const foreign = journalLineInput({ accountId, currencyCode: "EUR", debitAmount: 100, rateExact: "2" });
  const base = journalLineInput({ accountId, creditAmount: 200 });
  assert.equal(journalTotals([foreign, base], true).totalDebit, 100);
  assert.throws(() => journalTotals([foreign, base]), z.ZodError);
  assert.throws(() => journalTotals([{ ...foreign, debitAmount: 9007199254740991 }, base], true), WireCompatibilityError);
  assert.throws(() => journalTotals([{ ...foreign, debitAmount: 103 }, base], true), z.ZodError);
  assert.throws(() => journalTotals([journalLineInput({ accountId }), journalLineInput({ accountId })]), z.ZodError);
});

test("journal output keeps REST decimal strings/MCP minor integers and exact saved aliases", () => {
  assert.equal(journalLegacyDecimal(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(journalLegacyDecimal(-1250), "-12.50");
  const line = { ...journalLineInput({ accountId, debitAmount: 1250 }), rateMigrationStatus: "valid" };
  assert.equal(journalLineDto(line, true).debitAmount, "12.50");
  assert.equal(journalLineDto(line).debitAmount, 1250);
  assert.equal(journalLineDto(line).debitAmountMinor, "1250");
  const pending = journalLineDto({ ...line, rateExact: null, rateMigrationStatus: "review_required" });
  assert.equal(pending.rateExact, null); assert.equal(pending.rateMigrationStatus, "review_required");
  assert.throws(() => journalLineDto({ ...line, rateExact: "2" }), WireCompatibilityError);
  assert.throws(() => journalLineDto({ ...line, debitAmount: Number.MAX_SAFE_INTEGER + 1 }), WireCompatibilityError);
});
