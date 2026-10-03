import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { creditCreateFields, creditMcpCreateFields, creditTotals, creditAmount, creditAmountFields, creditBalances,
  creditNoteDto, customerCreditDto, creditRelations, parseCreditUpdate, creditListQuery } from "../lib/api/credit-wire";

const contactId = "00000000-0000-4000-8000-000000000001", taxId = "00000000-0000-4000-8000-000000000002";
const parse = (line: object, mcp = false, currencyCode = "USD") => z.object(mcp ? creditMcpCreateFields : creditCreateFields).strict()
  .parse({ contactId, issueDate: "2026-10-01", currencyCode, lines: [{ description: "Credit", ...line }] });
test("credit price units, exact aliases, extended-price rounding and currencies", () => {
  for (const fields of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" }, { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
    const parsed = parse({ ...fields, quantity: 1.5, discountPercent: 1000, taxRateId: taxId });
    const totals = creditTotals(parsed.lines, "rest", "USD", new Map([[taxId, 1000]]));
    assert.equal(totals.total, 1856); assert.equal(totals.processedLines[0].quantity, 150);
    assert.equal(totals.processedLines[0].unitPrice, 1250);
  }
  const minor = parse({ unitPrice: 1250, unitPriceMinor: "1250", unitPriceExact: "12.50" }, true);
  assert.equal(creditTotals(minor.lines, "mcp", "USD", new Map()).total, 1250);
  assert.equal(creditTotals(parse({ unitPriceExact: "0.005", quantity: 3 }).lines, "rest", "USD", new Map()).total, 2);
  assert.equal(creditTotals(parse({ unitPriceExact: "-0.005" }).lines, "rest", "USD", new Map()).total, 0);
  for (const [currency, major, minor] of [["USD", "12.5", 1250], ["IRR", "1250", 1250], ["JPY", "1250", 1250], ["KWD", "1.25", 1250]] as const)
    assert.equal(creditTotals(parse({ unitPriceExact: major }, false, currency).lines, "rest", currency, new Map()).total, minor);
  assert.equal(creditTotals(parse({}).lines, "rest", "USD", new Map()).total, 0);
});
test("credit aliases and monetary products/taxes/header sums reject precision loss", () => {
  for (const line of [{ unitPriceMinor: "01" }, { unitPriceExact: "1e3" }, { unitPrice: Number.MAX_SAFE_INTEGER + 1 },
    { unitPriceMinor: "9007199254740992" }, { unitPrice: 1, unitPriceExact: "2" }, { unitPriceMinor: "1250", unitPrice: 1 },
    { unitPriceMinor: "9007199254740991", quantity: 2 }, { unitPriceMinor: "9007199254740991", taxRateId: taxId }])
    assert.throws(() => creditTotals(parse(line).lines, "rest", "USD", new Map([[taxId, 10000]])));
  assert.throws(() => creditTotals(parse({ unitPrice: 1250, unitPriceMinor: "1" }, true).lines, "mcp", "USD", new Map()));
  const parsed = parse({ unitPriceMinor: "9007199254740991" });
  assert.throws(() => creditTotals([...parsed.lines, ...parsed.lines], "rest", "USD", new Map()));
});
test("credit amount aliases accept only positive safe canonical minor units", () => {
  for (const input of [{ amount: 1250 }, { amountMinor: "1250" }, { amount: 1250, amountMinor: "1250" }])
    assert.equal(creditAmount(z.object(creditAmountFields).parse(input)), 1250);
  for (const input of [{}, { amount: 0 }, { amountMinor: "0" }, { amountMinor: "-1" }, { amountMinor: "01" },
    { amountMinor: "9223372036854775808" }, { amountMinor: "9007199254740992" }, { amount: 2, amountMinor: "1" }, { amount: 1.5 }])
    assert.throws(() => creditAmount(z.object(creditAmountFields).parse(input)));
});
test("credit read DTOs guard safe numbers, references and saved balances", () => {
  const header = { subtotal: 1250, taxTotal: 0, total: 1250, amountApplied: 0, amountRemaining: 0 };
  assert.equal(creditNoteDto(header).totalMinor, "1250"); assert.equal(customerCreditDto({ originalAmount: 1250, amountRemaining: 1000 }).amountRemainingMinor, "1000");
  creditBalances(header, [{ unitPrice: 1250, amount: 1250, taxAmount: 0 }]);
  assert.throws(() => creditBalances({ ...header, total: 1 }, [{ unitPrice: 1250, amount: 1250, taxAmount: 0 }]));
  assert.throws(() => creditNoteDto({ ...header, total: Number.MAX_SAFE_INTEGER + 1 }));
  assert.throws(() => creditRelations({ contact: { organizationId: "b", creditLimit: null } }, "a"));
  assert.throws(() => creditRelations({ journalEntry: { organizationId: "b" } }, "a"));
});
test("draft credit patch is whitelisted and list dates/pagination are bounded", () => {
  assert.deepEqual(parseCreditUpdate({ notes: "Changed" }, "rest"), { notes: "Changed" });
  for (const input of [{ organizationId: contactId }, { status: "sent" }, { total: 1 }, { issueDate: "2026-02-30" }])
    assert.throws(() => parseCreditUpdate(input, "rest"));
  assert.equal(creditListQuery(new URL("http://fixture.test/?limit=10&page=2")).page, 2);
  for (const query of ["limit=NaN", "page=1.5", "from=2026-02-30", "page=999999999"])
    assert.throws(() => creditListQuery(new URL(`http://fixture.test/?${query}`)));
});
