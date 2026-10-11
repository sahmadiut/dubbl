import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount, taxRate, costCenter, invoice, invoiceLine } from "../../lib/db/schema";
import { POST as create, GET as list } from "../../app/api/v1/invoices/route";
import { GET as get, PATCH as edit } from "../../app/api/v1/invoices/[id]/route";
import { POST as pay } from "../../app/api/v1/invoices/[id]/pay/route";
import { POST as chargeInterest } from "../../app/api/v1/invoices/[id]/charge-interest/route";
import { GET as summary } from "../../app/api/v1/invoices/summary/route";
import { GET as payments } from "../../app/api/v1/payments/route";
import { POST as createCredit } from "../../app/api/v1/customer-credits/route";
import { POST as applyCredit } from "../../app/api/v1/customer-credits/[id]/apply/route";
import { GET as credits } from "../../app/api/v1/invoices/[id]/available-credits/route";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { registerInvoiceTools } from "../../lib/mcp/tools/invoices";
import { registerCustomerCreditTools } from "../../lib/mcp/tools/customer-credits";
import { registerInvoiceLifecycleTools } from "../../lib/mcp/tools/invoice-lifecycle";
import { invoiceUiDocument, invoiceUiSummary, invoiceUiBase, invoiceUiAmount, invoiceUiCredit, invoiceUiCreditAmount,
  invoiceUiCopyLines, invoiceUiDecimal, invoiceUiPayment } from "../../lib/money/invoice-ui";
import { invoiceWriteTotals, invoiceCreateSchema } from "../../lib/api/invoice-write-wire";

async function run() {
  const [user] = await db.insert(users).values({ email: "invoice-lifecycle-ui@example.test" }).returning();
  for (const currency of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Invoice UI ${currency}`, slug: `invoice-ui-${currency}`, defaultCurrency: currency, interestRate: 500 }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: user.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_invoice_ui_${currency}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: user.id, name: "UI fixture", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_invoice" });
    const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Customer", type: "customer", currencyCode: currency }).returning();
    const [revenue, cash] = await db.insert(chartAccount).values([
      { organizationId: org.id, name: "Revenue", code: "4000", type: "revenue", currencyCode: currency },
      { organizationId: org.id, name: "Cash", code: "1100", type: "asset", currencyCode: currency },
      { organizationId: org.id, name: "AR", code: "1200", type: "asset", currencyCode: currency },
      { organizationId: org.id, name: "Tax payable", code: "2200", type: "liability", currencyCode: currency },
      { organizationId: org.id, name: "Interest", code: "4100", type: "revenue", currencyCode: currency },
    ]).returning();
    const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "10%", rate: 1000 }).returning();
    const [center] = await db.insert(costCenter).values({ organizationId: org.id, name: "Sales", code: "S" }).returning();
    const ctx = { organizationId: org.id, userId: user.id, role: "owner" as const };
    const server = new McpServer({ name: "Invoice lifecycle UI fixture", version: "1" });
    registerInvoiceTools(server, ctx); registerCustomerCreditTools(server, ctx); registerInvoiceLifecycleTools(server, ctx);
    const client = new Client({ name: "UI fixture", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const request = (method = "GET", body?: unknown, query = "") => new Request(`http://fixture.test/api/v1/invoices${query}`, {
      method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": org.id },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    async function ok(response: Response) { const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body; }
    async function mcp(name: string, arguments_: Record<string, unknown>) {
      const result = await client.callTool({ name, arguments: arguments_ });
      assert.equal(result.isError, undefined, JSON.stringify(result.content));
      return JSON.parse((result.content as { text: string }[])[0].text);
    }
    try {
      const payload = { contactId: customer.id, issueDate: "2026-10-11", dueDate: "2026-11-11", currencyCode: currency,
        lines: [{ description: "Saved line", quantity: 1.25, unitPriceExact: invoiceUiDecimal(1250n, currency), discountPercent: 1000,
          accountId: revenue.id, taxRateId: tax.id, costCenterId: center.id }] };
      const totals = invoiceWriteTotals(invoiceCreateSchema.parse(payload).lines, currency, true, new Map([[tax.id, tax.rate]]));
      const created = await ok(await create(request("POST", payload)));
      const data = await ok(await get(request(), params(created.invoice.id)));
      const saved = invoiceUiDocument(data.invoice);
      assert.equal(saved.total, BigInt(totals.total));
      assert.equal(invoiceUiBase(data.base).amounts.total, saved.total);
      const copiedLines = invoiceUiCopyLines(saved.lines!, currency);
      const copied = await ok(await create(request("POST", { ...payload, lines: copiedLines })));
      assert.equal(copied.invoice.totalMinor, created.invoice.totalMinor);
      const patched = await ok(await edit(request("PATCH", { lines: copiedLines }), params(created.invoice.id)));
      assert.equal(patched.invoice.totalMinor, created.invoice.totalMinor);
      const updated = await mcp("update_invoice", { invoiceId: created.invoice.id, lines: copiedLines });
      assert.equal(updated.invoice.totalMinor, created.invoice.totalMinor);
      const storedLines = await db.select({ price: sql<string>`${invoiceLine.unitPrice}::text`, amount: sql<string>`${invoiceLine.amount}::text`, center: invoiceLine.costCenterId,
        tax: invoiceLine.taxRateId, discount: invoiceLine.discountPercent, quantity: invoiceLine.quantity }).from(invoiceLine).where(eq(invoiceLine.invoiceId, created.invoice.id));
      assert.equal(storedLines[0].price, "1250"); assert.equal(storedLines[0].center, center.id);
      assert.equal(storedLines[0].tax, tax.id); assert.equal(storedLines[0].discount, 1000); assert.equal(storedLines[0].quantity, 125);
      const listed = await ok(await list(request()));
      assert.ok(listed.data.map(invoiceUiDocument).some((row: { total: bigint }) => row.total === saved.total));
      assert.equal(invoiceUiDocument((await mcp("get_invoice", { invoiceId: created.invoice.id })).invoice).total, saved.total);
      // Recognition uses the real service; no outbound email/provider action is invoked.
      await sendInvoice(ctx, created.invoice.id);
      const input = invoiceUiAmount(invoiceUiDecimal(250n, currency), currency);
      const paid = await ok(await pay(request("POST", { ...input, date: "2026-10-11", method: "cash" }), params(created.invoice.id)));
      assert.equal(invoiceUiDocument(paid.invoice).amountPaid, 250n);
      await mcp("pay_invoice", { invoiceId: created.invoice.id, ...invoiceUiAmount(invoiceUiDecimal(1n, currency), currency), date: "2026-10-11", method: "cash" });
      const creditBody = { contactId: customer.id, date: "2026-10-11", currencyCode: currency, ...invoiceUiAmount(invoiceUiDecimal(100n, currency), currency), sourceType: "prepayment", depositAccountId: cash.id };
      const credit = await ok(await createCredit(request("POST", creditBody)));
      const available = await ok(await credits(request(), params(created.invoice.id)));
      const creditUi = invoiceUiCredit(available.credits[0]);
      const before = invoiceUiDocument((await ok(await get(request(), params(created.invoice.id)))).invoice);
      await ok(await applyCredit(request("POST", { invoiceId: created.invoice.id, ...invoiceUiCreditAmount(creditUi, before), date: "2026-10-11" }), params(credit.customerCredit.id)));
      const secondCredit = await mcp("create_customer_credit", creditBody);
      await mcp("apply_customer_credit", { customerCreditId: secondCredit.customerCredit.id, invoiceId: created.invoice.id, amountMinor: "100", date: "2026-10-11" });
      const refreshed = await ok(await get(request(), params(created.invoice.id)));
      const settled = invoiceUiDocument(refreshed.invoice);
      assert.equal(settled.amountPaid, 451n); assert.equal(settled.amountDue, settled.total - 451n);
      // Invoice GET history is allocation money in document currency and has no currency tag.
      const history = refreshed.payments.map((row: Record<string, unknown>) => invoiceUiPayment({ ...row, currencyCode: currency }));
      assert.equal(history.reduce((sum: bigint, row: { amount: bigint }) => sum + row.amount, 0n), 451n);
      const recent = await ok(await payments(request("GET", undefined, "?type=received&limit=5")));
      recent.data.map(invoiceUiPayment).forEach((row: { currencyCode: string }) => assert.equal(row.currencyCode, currency));
      const stats = invoiceUiSummary(await ok(await summary(request())));
      assert.equal(stats.outstanding, settled.amountDue); assert.equal(stats.currencyCode, currency);
      const raw = await db.select({ paid: sql<string>`${invoice.amountPaid}::text`, due: sql<string>`${invoice.amountDue}::text` }).from(invoice).where(eq(invoice.id, created.invoice.id));
      assert.equal(raw[0].paid, "451"); assert.equal(raw[0].due, String(settled.amountDue));
      // Set an overdue date through the supported draft operation, then recognize a separate invoice.
      const overdue = await ok(await create(request("POST", { ...payload, issueDate: "2026-09-01", dueDate: "2026-09-02" })));
      await sendInvoice(ctx, overdue.invoice.id);
      const feeInput = invoiceUiAmount(invoiceUiDecimal(1251n, currency), currency);
      const fee = await ok(await chargeInterest(request("POST", feeInput), params(overdue.invoice.id)));
      assert.equal(invoiceUiDocument(fee.invoice).total, 1251n); assert.equal(fee.invoice.currencyCode, currency);
      const mcpFee = await mcp("charge_invoice_interest", { invoiceId: overdue.invoice.id, ...feeInput });
      assert.equal(invoiceUiDocument(mcpFee.invoice).total, 1251n);
      const feeSql = await db.select({ price: sql<string>`${invoiceLine.unitPrice}::text` }).from(invoiceLine).where(eq(invoiceLine.invoiceId, fee.invoice.id));
      assert.equal(feeSql[0].price, "1251");
      // Large safe low digits remain exact in saved/copy paths without claiming posting range.
      if (currency === "USD") {
        const high = await ok(await create(request("POST", { ...payload, lines: [{ description: "Low digits", unitPriceExact: "40000000000000.03", accountId: revenue.id }] })));
        const highSaved = invoiceUiDocument((await ok(await get(request(), params(high.invoice.id)))).invoice);
        assert.equal(highSaved.total, 4000000000000003n);
        const highCopy = await ok(await create(request("POST", { ...payload, lines: invoiceUiCopyLines(highSaved.lines!, currency) })));
        assert.equal(highCopy.invoice.totalMinor, "4000000000000003");
      }
    } finally { await client.close(); await server.close(); }
  }
  console.log("Invoice lifecycle UI stored money verified");
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
