import assert from "node:assert/strict";
import { test } from "node:test";
import { salesReceiptCreateSchema, salesReceiptUpdateSchema, salesReceiptPostSchema, salesReceiptListQuery,
  salesReceiptTotals, salesReceiptBalances, salesReceiptDto, readSalesReceiptJson } from "../lib/api/sales-receipt-wire";

const contactId = "00000000-0000-4000-8000-000000000001", taxId = "00000000-0000-4000-8000-000000000002";
const parse = (line: object, currencyCode = "USD") => salesReceiptCreateSchema.parse({ contactId, date: "2026-10-01", currencyCode,
  lines: [{ description: "Sale", ...line }] });
test("sales receipt major/minor aliases preserve extended-price, discount and exclusive-tax rounding", () => {
  for (const price of [{ unitPrice: 12.5 }, { unitPriceExact: "12.50" }, { unitPriceMinor: "1250" },
    { unitPrice: 12.5, unitPriceExact: "12.50", unitPriceMinor: "1250" }]) {
    const row = parse({ ...price, quantity: 1.5, discountPercent: 1000, taxRateId: taxId });
    const totals = salesReceiptTotals(row.lines, "USD", new Map([[taxId, 1000]]));
    assert.equal(totals.total, 1856); assert.equal(totals.processedLines[0].quantity, 150);
    assert.equal(totals.processedLines[0].unitPrice, 1250);
  }
  for (const price of [{ unitPrice: 0.005 }, { unitPriceExact: "0.005" }])
    assert.equal(salesReceiptTotals(parse({ ...price, quantity: 3 }).lines, "USD", new Map()).total, 2);
  assert.equal(salesReceiptTotals(parse({ unitPriceExact: "-0.005" }).lines, "USD", new Map()).total, 0);
  for (const [currency, major] of [["USD", "12.5"], ["IRR", "1250"], ["JPY", "1250"], ["KWD", "1.25"]])
    assert.equal(salesReceiptTotals(parse({ unitPriceExact: major }, currency).lines, currency, new Map()).total, 1250);
  assert.equal(salesReceiptTotals(parse({}).lines, "USD", new Map()).total, 0);
});
test("sales receipt price aliases and products/sums reject unsupported numeric values", () => {
  for (const line of [{ unitPriceMinor: "01" }, { unitPriceExact: "1e3" }, { unitPriceExact: "۱۲" },
    { unitPriceMinor: "9223372036854775808" }, { unitPriceMinor: "9007199254740992" },
    { unitPrice: Number.MAX_SAFE_INTEGER + 1 }, { unitPrice: 1, unitPriceExact: "2" }, { unitPrice: 1, unitPriceMinor: "1250" },
    { unitPriceMinor: "9007199254740991", quantity: 2 }, { unitPriceMinor: "9007199254740991", taxRateId: taxId }])
    assert.throws(() => salesReceiptTotals(parse(line).lines, "USD", new Map([[taxId, 10000]])));
  const row = parse({ unitPriceMinor: "9007199254740991" });
  assert.equal(salesReceiptTotals(row.lines, "USD", new Map()).total, Number.MAX_SAFE_INTEGER);
  assert.throws(() => salesReceiptTotals([...row.lines, ...row.lines], "USD", new Map()));
});
test("receipt balances and DTOs never promote corrupt or unsafe stored amounts", () => {
  const row = { subtotal: 1250, taxTotal: 125, total: 1375 };
  const line = { unitPrice: 1250, amount: 1250, taxAmount: 125, quantity: 100, discountPercent: 0 };
  assert.equal(salesReceiptDto(row).totalMinor, "1375"); salesReceiptBalances(row, [line]);
  assert.throws(() => salesReceiptBalances({ ...row, total: 1 }, [line]));
  assert.throws(() => salesReceiptDto({ ...row, total: Number.MAX_SAFE_INTEGER + 1 }));
  assert.throws(() => salesReceiptBalances(row, [{ ...line, quantity: 2147483648 }]));
  assert.throws(() => salesReceiptBalances(row, [{ ...line, discountPercent: 10001 }]));
});
test("receipt edits, posting overrides and list filters are whitelisted and bounded", () => {
  assert.deepEqual(salesReceiptUpdateSchema.parse({ notes: "Changed" }), { notes: "Changed" });
  for (const input of [{ organizationId: contactId }, { status: "paid" }, { total: 1 }, { date: "2026-02-30" }])
    assert.throws(() => salesReceiptUpdateSchema.parse(input));
  assert.throws(() => salesReceiptPostSchema.parse({ exchangeRate: 1 }));
  assert.equal(salesReceiptListQuery(new URL("http://fixture.test/?page=2&limit=10")).page, 2);
  for (const query of ["page=NaN", "limit=1.5", "from=2026-02-30", "status=sent", "page=999999999"])
    assert.throws(() => salesReceiptListQuery(new URL(`http://fixture.test/?${query}`)));
});
test("malformed receipt JSON fails and optional empty lifecycle bodies are explicit", async () => {
  await assert.rejects(readSalesReceiptJson(new Request("http://fixture.test", { method: "POST", body: "{bad" })));
  await assert.rejects(readSalesReceiptJson(new Request("http://fixture.test", { method: "POST", body: "" })));
  assert.deepEqual(await readSalesReceiptJson(new Request("http://fixture.test", { method: "POST" }), true), {});
});
