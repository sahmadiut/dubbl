import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { report1099Ui, taxSummaryUi, vatReturnUi, trackingReportUi, consolidationReportUi,
  customReportUi, customReportUiConfig, customReportCell, consolidationReportExport, reportResultJson, reportResultMoney } from "../lib/money/report-result-ui";

const dual = (fields: Record<string, number>) => Object.fromEntries(Object.entries(fields).flatMap(([key, amount]) => [[key, amount], [`${key}Minor`, String(amount)]]));
const tracking = () => ({ currencyCode: "JPY", mode: "pnl", columns: [{ key: "p", label: "Project", dimensionValue: "p" }],
  sections: [{ label: "Revenue", accounts: [{ accountId: "r", accountCode: "4000", accountName: "Sales", accountType: "revenue",
    amounts: [3000000001], amountsMinor: ["3000000001"], ...dual({ total: 3000000001 }) }],
    totals: [3000000001], totalsMinor: ["3000000001"], ...dual({ total: 3000000001 }) },
  { label: "Expenses", accounts: [], totals: [0], totalsMinor: ["0"], ...dual({ total: 0 }) }],
  netIncome: { byColumn: [3000000001], byColumnMinor: ["3000000001"], ...dual({ total: 3000000001 }) } });

test("report adapters preserve currency scale and reject missing, malformed or conflicting saved aliases", () => {
  const data = { currencyCode: "USD", taxYear: 2024, reportableCount: 1, ...dual({ threshold: 60000, reportableTotal: 3000000001, grandTotal: 3000000001 }),
    vendors: [{ contactId: "v", name: "Vendor", taxIdentifier: null, w9TaxClassification: null, backupWithholding: false, paymentCount: 1, reportable: true, ...dual({ totalPaid: 3000000001 }) }] };
  for (const [code, expected] of [["USD", "$30,000,000.01"], ["JPY", "¥3,000,000,001"], ["IRR", "IRR 3,000,000,001"], ["KWD", "KWD 3,000,000.001"]]) {
    const result = report1099Ui({ ...data, currencyCode: code });
    assert.equal(result.vendors[0].totalPaid, 3000000001n);
    assert.equal(reportResultMoney(result.grandTotal, result.currencyCode), expected);
  }
  for (const alias of [undefined, null, "03000000001", "+3000000001", "3000000001.0", "3000000002", "9223372036854775807"]) {
    assert.throws(() => report1099Ui({ ...data, grandTotalMinor: alias }));
  }
  for (const amount of [-0, NaN, Infinity, 0.1, 9007199254740992]) assert.throws(() => report1099Ui({ ...data, grandTotal: amount }));
  for (const code of [undefined, "usd", " USD", "BAD"]) assert.throws(() => report1099Ui({ ...data, currencyCode: code }));
  assert.throws(() => report1099Ui({ ...data, reportableCount: 0 }));
  assert.throws(() => report1099Ui({ ...data, ...dual({ reportableTotal: 0 }) }));
});

test("tax summary refunds and VAT calculations validate signed bigint totals", () => {
  const summary = { currencyCode: "KWD", ...dual({ totalOutputTax: 1250, totalInputTax: 3000000001, netTaxPayable: -2999998751 }), rates: [
    { taxRateId: "r", taxRateName: "Tax", rate: 2000, type: "standard", ...dual({ outputTax: 1250, inputTax: 3000000001, outputNet: 6250, inputNet: 15000000005, netTax: -2999998751 }) }] };
  assert.equal(taxSummaryUi(summary).netTaxPayable, -2999998751n);
  assert.throws(() => taxSummaryUi({ ...summary, ...dual({ netTaxPayable: 0 }) }));
  const vat = { currencyCode: "JPY", period: { startDate: "2024-01-01", endDate: "2024-01-31" }, basis: "accrual",
    boxes: [1250, 2, 1252, 3000, -1748, 0, 0, 0, 0].map((amount, i) => ({ box: String(i + 1), label: "Box", ...dual({ amount }) })) };
  assert.equal(vatReturnUi(vat).boxes[4].amount, -1748n);
  assert.throws(() => vatReturnUi({ ...vat, boxes: vat.boxes.slice(1) }));
  const corrupt = structuredClone(vat); corrupt.boxes[2] = { ...corrupt.boxes[2], ...dual({ amount: 1253 }) };
  assert.throws(() => vatReturnUi(corrupt));
});

test("tracking aligns aliases, column totals and net income without losing low digits", () => {
  assert.equal(trackingReportUi(tracking()).netIncome!.total, 3000000001n);
  for (const mutate of [
    (data: ReturnType<typeof tracking>) => { data.sections[0].accounts[0].amountsMinor = []; },
    (data: ReturnType<typeof tracking>) => { data.sections[0].totalsMinor[0] = "3000000000"; },
    (data: ReturnType<typeof tracking>) => { data.netIncome.byColumn = [0]; data.netIncome.byColumnMinor = ["0"]; },
    (data: ReturnType<typeof tracking>) => { data.columns.push(data.columns[0]); },
  ]) { const data = tracking(); mutate(data); assert.throws(() => trackingReportUi(data)); }
});

test("consolidation preserves post-elimination totals distinct from entity columns and exact derived sums", () => {
  const account = { type: "revenue", code: "4000", name: "Sales", ...dual({ total: 5 }), byEntity: { a: 10 }, byEntityMinor: { a: "10" } };
  const data = { presentationCurrency: "USD", group: { id: "g", name: "Group", presentationCurrency: "USD" },
    members: [{ orgId: "a", label: "A", orgName: "A", functionalCurrency: "JPY" }],
    consolidatedPnL: { ...dual({ totalRevenue: 5, totalExpenses: 0, netIncome: 5 }), accounts: [account], byEntity: [{ orgId: "a", label: "A", ...dual({ revenue: 10, expenses: 0, netIncome: 10 }) }] },
    consolidatedBalanceSheet: { ...dual({ totalAssets: 0, totalLiabilities: 0, totalEquity: 0, balanceCheck: -5 }), accounts: [], byEntity: [{ orgId: "a", label: "A", ...dual({ assets: 0, liabilities: 0, equity: 0 }) }] } };
  const report = consolidationReportUi(data);
  assert.equal(report.consolidatedPnL.accounts[0].total, 5n);
  assert.equal(report.consolidatedPnL.accounts[0].byEntity.a, 10n);
  const exported = consolidationReportExport({ ...report, members: [...report.members, { ...report.members[0], orgId: "b" }] }, "pnl");
  assert.ok(exported.columns.includes("A (a)")); assert.ok(exported.columns.includes("A (b)"));
  assert.equal(exported.data[0].total, "5"); assert.equal(exported.data[0].currencyCode, "USD");
  assert.equal(exported.data[0]["A (a)"], "10");
  assert.equal(exported.data[0]["A (b)"], "0");
  const derived = [BigInt(Number.MAX_SAFE_INTEGER), 2n].reduce((sum, amount) => sum + amount, 0n);
  assert.equal(reportResultMoney(derived, "USD"), "$90,071,992,547,409.93");
  assert.throws(() => consolidationReportUi({ ...data, presentationCurrency: "JPY" }));
  const bad = structuredClone(data); bad.consolidatedPnL.accounts[0].byEntityMinor.a = "11";
  assert.throws(() => consolidationReportUi(bad));
});

test("custom/saved projections request hidden aliases and currency, retain nullable limits and raw Minor columns", () => {
  const config = customReportUiConfig({ dataSource: "invoices", columns: ["totalMinor", "invoiceNumber"] });
  assert.deepEqual(config.columns, ["totalMinor", "invoiceNumber", "total", "currencyCode"]);
  const body = { total: 2, data: [{ total: 1250, totalMinor: "1250", currencyCode: "KWD", invoiceNumber: "A" }, { total: 1250, totalMinor: "1250", currencyCode: "JPY", invoiceNumber: "B" }] };
  const rows = customReportUi(body, config);
  assert.equal(customReportCell(rows[0], "total"), "KWD 1.250");
  assert.equal(customReportCell(rows[1], "total"), "¥1,250");
  assert.equal(customReportCell(rows[0], "totalMinor"), "1250");
  const nullable = customReportUi({ total: 1, data: [{ creditLimit: null, creditLimitMinor: null, currencyCode: "USD" }] }, { dataSource: "contacts", columns: ["creditLimit"] });
  assert.equal(customReportCell(nullable[0], "creditLimit"), "-");
  for (const bad of [{ ...body, total: 0 }, { data: [{}], total: 1 }, { total: 1, data: [{ total: 1250, totalMinor: "1251", invoiceNumber: "A", currencyCode: "USD" }] }]) assert.throws(() => customReportUi(bad, config));
});

test("HTTP and malformed report responses reject before adoption; all result pages use validated consumers", async () => {
  await assert.rejects(reportResultJson(new Response('{"error":"secret"}', { status: 422 }), trackingReportUi), /Unable to load/);
  await assert.rejects(reportResultJson(new Response('{"error":"bad"}'), trackingReportUi), /amounts are invalid/);
  await assert.rejects(reportResultJson(new Response('{'), trackingReportUi), /amounts are invalid/);
  for (const page of ["1099", "tax-summary", "vat-return", "tracking", "consolidation", "custom", "saved"]) {
    const source = readFileSync(`app/(dashboard)/reports/${page}/page.tsx`, "utf8");
    assert.ok(source.includes("reportResultJson"), page);
    assert.doesNotMatch(source, /import .*formatMoney.*from ["']@\/lib\/money["']/);
    assert.match(source, /role="alert"/);
  }
});
