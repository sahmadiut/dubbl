import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { recurringJournalLegs, recurringJournalDto, recurringJournalCreateSchema, recurringJournalUpdateSchema,
  assertRecurringJournalRate, assertRecurringJournalDates } from "../lib/api/recurring-journal-wire";
import { WireCompatibilityError } from "../lib/money/wire";

const accountId = "00000000-0000-4000-8000-000000000000";
const leg = { accountId, description: "Fixture" };
test("recurring aliases preserve units and safe limits, rejecting malformed/conflicting amounts", () => {
  for (const currency of ["USD", "IRR", "JPY", "KWD"]) for (const amount of ["1250", "2147483648", String(Number.MAX_SAFE_INTEGER)]) {
    const legs = recurringJournalLegs([{ ...leg, debitAmountMinor: amount }, { ...leg, creditAmountMinor: amount }], currency);
    const dto = recurringJournalDto({ currencyCode: currency, lines: legs });
    assert.equal(dto.lines![0].debitAmountMinor, amount);
    assert.equal(dto.lines![0].debitAmount, Number(amount)); assert.equal(dto.lines![0].rateExact, "1");
  }
  assert.equal(recurringJournalLegs([{ ...leg, debitAmount: 1250, debitAmountMinor: "1250" }, { ...leg, creditAmount: 1250 }], "USD")[0].debitAmount, 1250);
  for (const amount of ["01", "-0", "-1", "1.5", "1e3", " 1", "۱۲۵۰", "9223372036854775808"]) {
    assert.throws(() => recurringJournalLegs([{ ...leg, debitAmountMinor: amount }, { ...leg, creditAmountMinor: amount }], "USD"), z.ZodError);
  }
  assert.throws(() => recurringJournalLegs([{ ...leg, debitAmount: 1, debitAmountMinor: "2" }, { ...leg, creditAmount: 1 }], "USD"), z.ZodError);
  assert.throws(() => recurringJournalLegs([{ ...leg, debitAmountMinor: "9007199254740992" }, { ...leg, creditAmountMinor: "9007199254740992" }], "USD"), WireCompatibilityError);
  assert.throws(() => recurringJournalLegs([{ ...leg, debitAmount: Number.MAX_SAFE_INTEGER }, { ...leg, debitAmount: 1 }, { ...leg, creditAmount: Number.MAX_SAFE_INTEGER }, { ...leg, creditAmount: 1 }], "USD"), WireCompatibilityError);
  assert.throws(() => recurringJournalDto({ currencyCode: "USD", lines: [{ debitAmount: Number.MAX_SAFE_INTEGER + 1, creditAmount: 0 }] }), WireCompatibilityError);
});
test("recurring legs require a balanced journal and only persisted dimensions", () => {
  for (const lines of [[{ ...leg, debitAmount: 0 }, { ...leg, creditAmount: 0 }], [{ ...leg, debitAmount: 2 }, { ...leg, creditAmount: 1 }],
    [{ ...leg, debitAmount: 1, creditAmount: 1 }, { ...leg, debitAmount: 1, creditAmount: 1 }],
    [{ ...leg, debitAmount: 1, projectId: accountId }, { ...leg, creditAmount: 1 }]]) {
    assert.throws(() => recurringJournalLegs(lines, "USD"), z.ZodError);
  }
});
test("recurring dates, patches and fixed identity FX are explicit", () => {
  assertRecurringJournalRate({ rateExact: "1.000000", exchangeRate: 1000000, rateDirection: "quote_per_base" });
  for (const rateExact of ["2", "0.000001", "0.0000001", "2148"]) assert.throws(() => assertRecurringJournalRate({ rateExact }), WireCompatibilityError);
  assert.throws(() => assertRecurringJournalRate({ rateExact: "0" }), z.ZodError);
  assertRecurringJournalDates("2024-02-29", "2024-02-29");
  assert.throws(() => assertRecurringJournalDates("2026-02-29"), z.ZodError);
  assert.throws(() => assertRecurringJournalDates("2026-10-03", "2026-10-02"), z.ZodError);
  assert.deepEqual(recurringJournalUpdateSchema.parse({ notes: null }), { notes: null });
  assert.throws(() => recurringJournalUpdateSchema.parse({ startDate: "2026-10-03" }), z.ZodError);
  assert.throws(() => recurringJournalCreateSchema.parse({ name: "Fixture", frequency: "weekly", startDate: "2026-10-03", maxOccurrences: 2147483648,
    lines: [{ ...leg, debitAmount: 1 }, { ...leg, creditAmount: 1 }] }), z.ZodError);
});
