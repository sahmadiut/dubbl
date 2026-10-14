import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { publicPaymentSchema, portalInvoicesSchema, portalPaymentsSchema, portalQuotesSchema, portalStatementSchema, acceptedQuoteSchema, publicEmailMoney } from "../lib/money/public-ui";
import { clientJson, clientPdf } from "../lib/api/client-response";
import { documentHundredths, documentMoneyText, documentSum } from "../lib/documents/render-wire";

const pair = (key: string, value: number) => ({ [key]: value, [`${key}Minor`]: String(value) });
const line = { description: "Line", quantity: 150, ...pair("unitPrice", 3000000001), ...pair("amount", 3000000001), ...pair("taxAmount", 1) };
const invoice = { id: "invoice", invoiceNumber: "INV", issueDate: "2026-01-01", dueDate: "2026-02-01", currencyCode: "USD",
  ...pair("total", 3000000002), ...pair("amountDue", -1) };
const payment = { status: "pending", invoice: { ...invoice, lines: [line] }, organization: { name: "Org" }, contact: { name: "Contact" } };
const quote = { id: "quote", quoteNumber: "Q", issueDate: "2026-01-01", expiryDate: "2026-02-01", status: "sent", currencyCode: "USD",
  ...pair("subtotal", 3000000001), ...pair("taxTotal", 1), ...pair("total", 3000000002), ...pair("billedTotal", 0), lines: [line] };
const statementLine = { date: "2026-01-01", description: "INV", status: "sent", currencyCode: "USD",
  ...pair("amount", 3000000002), ...pair("paid", 3000000003), ...pair("balance", -1), ...pair("runningBalance", -1) };
const statement = { currencyCode: "USD", lines: [statementLine], ...pair("totalOutstanding", -1) };

test("public consumers preserve signed low digits and physical units in every saved currency scale", () => {
  for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
    const result = publicPaymentSchema.parse({ ...payment, invoice: { ...payment.invoice, currencyCode } });
    assert.equal(result.status, "pending");
    if (result.status !== "pending") throw new Error("Missing pending invoice");
    assert.equal(result.invoice.totalMinor, "3000000002");
    assert.equal(result.invoice.amountDueMinor, "-1");
    assert.equal(documentHundredths(result.invoice.lines[0].quantity), "1.50");
    assert.equal(documentSum(result.invoice.lines[0].amount, result.invoice.lines[0].taxAmount), 3000000002);
    assert.ok(documentMoneyText(result.invoice.total, currencyCode).includes(currencyCode === "KWD" ? ".002" : currencyCode === "USD" ? ".02" : "3,000,000,002"));
    assert.equal(portalStatementSchema.parse({ ...statement, currencyCode, lines: [{ ...statementLine, currencyCode }] }).totalOutstanding, -1);
  }
  assert.deepEqual(publicPaymentSchema.parse({ status: "paid", invoice: { invoiceNumber: "INV" } }), { status: "paid", invoice: { invoiceNumber: "INV" } });
  assert.equal(portalInvoicesSchema.parse({ data: [{ ...invoice, status: "sent" }] }).data[0].totalMinor, "3000000002");
  assert.equal(portalPaymentsSchema.parse({ data: [{ invoiceNumber: "INV", invoiceId: "invoice", paidAt: null, status: "paid", currencyCode: "USD", ...pair("total", 3000000002), ...pair("amountPaid", 3000000003) }] }).data[0].amountPaidMinor, "3000000003");
  assert.equal(portalQuotesSchema.parse({ data: [quote] }).data[0].lines[0].unitPriceMinor, "3000000001");
  assert.equal(acceptedQuoteSchema.parse(quote).billedTotalMinor, "0");
});

test("public consumers reject missing, noncanonical, conflicting, unsafe and hidden monetary aliases", () => {
  for (const totalMinor of [undefined, "03000000002", "3e9", "-0", "3000000003", "9223372036854775808"]) {
    assert.throws(() => publicPaymentSchema.parse({ ...payment, invoice: { ...payment.invoice, totalMinor } }));
    assert.throws(() => portalInvoicesSchema.parse({ data: [{ ...invoice, status: "sent", totalMinor }] }));
    assert.throws(() => acceptedQuoteSchema.parse({ ...quote, totalMinor }));
  }
  for (const total of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, -0]) assert.throws(() => publicPaymentSchema.parse({ ...payment, invoice: { ...payment.invoice, total } }));
  assert.throws(() => publicPaymentSchema.parse({ ...payment, invoice: { ...payment.invoice, currencyCode: "XXX" } }));
  for (const override of [{ taxAmountMinor: "2" }, { quantity: 1.5 }, { amount: Number.MAX_SAFE_INTEGER, amountMinor: String(Number.MAX_SAFE_INTEGER) }]) {
    assert.throws(() => publicPaymentSchema.parse({ ...payment, invoice: { ...payment.invoice, lines: [{ ...line, ...override }] } }));
  }
  assert.throws(() => portalQuotesSchema.parse({ data: [{ ...quote, billedTotalMinor: "1" }] }));
  for (const schema of [portalInvoicesSchema, portalPaymentsSchema, portalQuotesSchema]) assert.throws(() => schema.parse({ error: "unavailable" }));
});

test("statement adoption checks currency, exact running balances and total before rendering", () => {
  assert.deepEqual(portalStatementSchema.parse({ currencyCode: "JPY", lines: [], ...pair("totalOutstanding", 0) }).lines, []);
  for (const override of [{ currencyCode: "JPY" }, { runningBalance: 0, runningBalanceMinor: "0" }, { balanceMinor: "0" }]) {
    assert.throws(() => portalStatementSchema.parse({ ...statement, lines: [{ ...statementLine, ...override }] }));
  }
  assert.throws(() => portalStatementSchema.parse({ ...statement, ...pair("totalOutstanding", 0) }));
  assert.throws(() => portalStatementSchema.parse({ error: "unavailable" }));
  const max = Number.MAX_SAFE_INTEGER;
  const large = { ...statementLine, ...pair("balance", max), ...pair("runningBalance", max) };
  assert.throws(() => portalStatementSchema.parse({ ...statement, ...pair("totalOutstanding", max), lines: [large, { ...large, ...pair("balance", 1) }] }));
});

test("failed public requests and JSON error bodies never become data or PDF downloads", async () => {
  await assert.rejects(clientJson(Response.json({ error: "Expired link" }, { status: 401 }), "Unavailable"), /Expired link/);
  await assert.rejects(clientJson(new Response("upstream down", { status: 500 }), "Unavailable"), /Unavailable/);
  await assert.rejects(clientJson(new Response("{"), "Unavailable"));
  await assert.rejects(clientPdf(Response.json({ error: "Unsupported amount" }, { status: 422 })), /Unsupported amount/);
  await assert.rejects(clientPdf(Response.json({ error: "Wrong response" })), /not a PDF/);
  const pdf = await clientPdf(new Response("%PDF-fixture", { headers: { "content-type": "application/pdf" } }));
  assert.equal(await pdf.text(), "%PDF-fixture");
});

test("email money requires explicit saved currency and retains signed low digits", () => {
  assert.equal(publicEmailMoney(undefined, undefined), undefined);
  assert.equal(publicEmailMoney(-1, "USD"), "-$0.01");
  assert.equal(publicEmailMoney(3000000001n, "KWD"), "KWD\u00a03,000,000.001");
  assert.match(publicEmailMoney(3000000001, "JPY")!, /3,000,000,001/);
  for (const code of [undefined, "XXX", "usd"]) assert.throws(() => publicEmailMoney(1250, code));
  for (const amount of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, -0]) assert.throws(() => publicEmailMoney(amount, "USD"));
});

test("public money consumers cannot reintroduce numeric coercion or fixed-two money math", () => {
  for (const path of [
    "app/pay/[token]/page.tsx", "app/portal/[token]/invoices/page.tsx",
    "app/portal/[token]/payments/page.tsx", "app/portal/[token]/quotes/page.tsx",
    "app/portal/[token]/statements/page.tsx", "components/dashboard/send-document-dialog.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /from ["']@\/lib\/money["']/, path);
    assert.doesNotMatch(source, /\b(?:parseFloat|parseInt|Number)\s*\(|\.toFixed\s*\(|\bMath\.(?:round|floor|ceil)\s*\(|\/\s*100\b/, path);
    assert.match(source, /@\/lib\/money\/public-ui/, path);
  }
});
