import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, journalEntry, journalLine,
  invoice, invoiceLine, bill, billLine, contact, payment, taxRate, taxPeriod } from "../../lib/db/schema";
import { GET as report1099 } from "../../app/api/v1/reports/1099/route";
import { GET as summary } from "../../app/api/v1/reports/tax-summary/route";
import { GET as sales } from "../../app/api/v1/reports/sales-tax/route";
import { GET as vat } from "../../app/api/v1/reports/vat-return/route";
import { GET as transactions } from "../../app/api/v1/reports/vat-return/transactions/route";
import { GET as bas } from "../../app/api/v1/reports/bas/route";
import { GET as schedule } from "../../app/api/v1/reports/schedule-c/route";
import { registerTaxReportTools } from "../../lib/mcp/tools/tax-reports";
import { registerTaxProfileTools } from "../../lib/mcp/tools/tax-profiles";
import type { AuthContext } from "../../lib/api/auth-context";

const pairs = [["1099", "report_1099", report1099], ["tax-summary", "tax_summary", summary], ["sales-tax", "sales_tax", sales],
  ["vat-return", "vat_return", vat], ["vat-return/transactions", "vat_return_transactions", transactions],
  ["bas", "bas", bas], ["schedule-c", "schedule_c", schedule]] as const;
async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Tax report fixture", version: "1" });
  registerTaxProfileTools(server, ctx); registerTaxReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const [, name] of pairs) assert.match(tools.find(tool => tool.name === name)!.description!, /Minor strings/);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Tax A", slug: "tax-a", countryCode: "GB" }, { name: "Tax B", slug: "tax-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "tax-owner@example.test" }, { email: "tax-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_tax_a", b: "dk_tax_b", denied: "dk_tax_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_tax" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const request = (path: string, args: Record<string, unknown>, key = keys.a) => new Request(`http://fixture.test/api/v1/reports/${path}?${new URLSearchParams(Object.entries(args).map(([k,v]) => [k, String(v)]))}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const period = { startDate: "2024-01-01", endDate: "2024-01-31" };
  const argsFor = (path: string): Record<string, unknown> => path === "1099" ? { year: 2024 } : path.endsWith("transactions") ? { ...period, box: "1" } : period;
  const check = async (path: string, name: string, handler: (request: Request) => Promise<Response>, args = argsFor(path), status = 200) => {
    const response = await handler(request(path, args)); assert.equal(response.status, status, `${path}: ${await response.clone().text()}`);
    const body = await response.json(), result = await ma.call(name, args);
    if (status === 200) assert.deepEqual(result.body, body); else { assert.equal(result.isError, true); assert.equal(result.body.status, status); }
    return body;
  };
  const [vendor, unpaid, foreign] = await db.insert(contact).values([
    { organizationId: a.id, name: "Vendor", type: "both", is1099Vendor: true, taxIdentifier: "SYNTHETIC", taxNumber: "VAT-fixture", addresses: { billing: { country: "FR" } } },
    { organizationId: a.id, name: "Unpaid", is1099Vendor: true },
    { organizationId: b.id, name: "Foreign secret", is1099Vendor: true, taxNumber: "secret", addresses: { billing: { country: "FR" } } },
  ]).returning();
  const [rate, foreignRate] = await db.insert(taxRate).values([{ organizationId: a.id, name: "Standard", rate: 2000 }, { organizationId: b.id, name: "Foreign secret", rate: 500 }]).returning();
  const [output, input, bank, revenue, expense, foreignAccount] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "2200", name: "Output", type: "liability" as const },
    { organizationId: a.id, code: "1500", name: "Input", type: "asset" as const },
    { organizationId: a.id, code: "1000", name: "Bank", type: "asset" as const, subType: "bank" },
    { organizationId: a.id, code: "4000", name: "Income", type: "revenue" as const, subType: "income" },
    { organizationId: a.id, code: "5000", name: "Supplies", type: "expense" as const, subType: "supplies" },
    { organizationId: b.id, code: "2200", name: "Foreign secret", type: "liability" as const, subType: "income" },
  ]).returning();
  let sequence = 0;
  const entry = async (lines: { accountId: string; debit?: number; credit?: number }[], date = "2024-01-15", org = a.id, sourceType = "manual", status: "posted" | "draft" = "posted") => {
    const [saved] = await db.insert(journalEntry).values({ organizationId: org, entryNumber: ++sequence, date, status, sourceType, description: "Synthetic tax fixture" }).returning();
    await db.insert(journalLine).values(lines.map(line => ({ journalEntryId: saved.id, accountId: line.accountId, debitAmount: line.debit ?? 0, creditAmount: line.credit ?? 0 })));
    return saved;
  };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["journal_entry", "journal_line", "invoice", "bill", "payment", "tax_period", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  try {
    for (const [path, name, handler] of pairs) await check(path, name, handler);
    assert.equal((await check(...pairs[0], {})).taxYear, new Date().getUTCFullYear() - 1);
    const defaultSummary = await check(...pairs[1], {});
    assert.equal(defaultSummary.startDate, `${new Date().getUTCFullYear()}-01-01`);
    assert.equal(defaultSummary.endDate, new Date().toISOString().slice(0, 10));
    const [sale] = await db.insert(invoice).values({ organizationId: a.id, contactId: vendor.id, invoiceNumber: "I1", issueDate: period.startDate, dueDate: period.endDate,
      status: "sent", subtotal: 10000, total: 12000 }).returning();
    await db.insert(invoiceLine).values([{ invoiceId: sale.id, description: "Taxed", quantity: 100, unitPrice: 10000, amount: 10000, taxAmount: 2000, taxRateId: rate.id },
      { invoiceId: sale.id, description: "Truncated", quantity: 33, unitPrice: 101, amount: 33, taxAmount: 1, taxRateId: rate.id },
      { invoiceId: sale.id, description: "Exempt", amount: 300 }]);
    const [purchase] = await db.insert(bill).values({ organizationId: a.id, contactId: vendor.id, billNumber: "B1", issueDate: period.endDate, dueDate: period.endDate,
      status: "received", subtotal: 5000, total: 6000 }).returning();
    await db.insert(billLine).values({ billId: purchase.id, description: "Taxed", quantity: 100, unitPrice: 5000, amount: 5000, taxAmount: 1000, taxRateId: rate.id });
    for (const status of ["draft", "void", "sent"] as const) {
      const [excluded] = await db.insert(invoice).values({ organizationId: a.id, contactId: vendor.id, invoiceNumber: `excluded-${status}`,
        issueDate: period.startDate, dueDate: period.endDate, status, subtotal: 999, total: 999, deletedAt: status === "sent" ? new Date() : null }).returning();
      await db.insert(invoiceLine).values({ invoiceId: excluded.id, description: "Excluded", amount: 999, taxAmount: 999, unitPrice: 999, taxRateId: rate.id });
    }
    for (const [amount, method, type, org, contactId, date, deleted] of [
      [60000, "cash", "made", a.id, vendor.id, "2024-01-01", false], [10, "bank_transfer", "made", a.id, vendor.id, "2024-12-31", false],
      [900, "card", "made", a.id, vendor.id, "2024-01-01", false], [900, "cash", "received", a.id, vendor.id, "2024-01-01", false],
      [900, "cash", "made", b.id, vendor.id, "2024-01-01", false], [900, "cash", "made", a.id, foreign.id, "2024-01-01", false],
      [900, "cash", "made", a.id, vendor.id, "2023-12-31", false], [900, "cash", "made", a.id, vendor.id, "2024-01-01", true],
    ] as const) await db.insert(payment).values({ organizationId: org, contactId, paymentNumber: randomUUID(), amount, method, type, date, deletedAt: deleted ? new Date() : null });
    await entry([{ accountId: output.id, credit: 2000 }, { accountId: revenue.id, credit: 10000 }, { accountId: bank.id, debit: 12000 }]);
    await entry([{ accountId: input.id, debit: 1000 }, { accountId: expense.id, debit: 5000 }, { accountId: bank.id, credit: 6000 }]);
    await entry([{ accountId: input.id, debit: 300 }, { accountId: output.id, credit: 300 }]); // accrual reverse charge
    await entry([{ accountId: output.id, credit: 999 }], undefined, b.id); // foreign entry -> owned account
    await entry([{ accountId: foreignAccount.id, credit: 999 }]); // owned entry -> foreign account
    await entry([{ accountId: output.id, credit: 999 }], "2024-02-01");
    await entry([{ accountId: output.id, credit: 999 }], undefined, a.id, "manual", "draft");
    const [returns] = await db.insert(chartAccount).values({ organizationId: a.id, code: "4100", name: "Returns", type: "revenue", subType: "returns_allowances" }).returning();
    await entry([{ accountId: returns.id, credit: 100 }]);
    const before = await snapshot();
    const r1099 = await check(...pairs[0]); assert.equal(r1099.grandTotalMinor, "60010"); assert.equal(r1099.reportableCount, 1);
    assert.equal(r1099.vendors.find((v: { contactId: string }) => v.contactId === unpaid.id).totalPaidMinor, "0");
    assert.equal((await check(...pairs[0], { year: 2024, thresholdMinor: "60011" })).reportableCount, 0);
    const taxSummary = await check(...pairs[1]); assert.equal(taxSummary.totalOutputTaxMinor, "2001"); assert.equal(taxSummary.rates[0].outputNetMinor, "10033");
    assert.equal(taxSummary.totalInputTaxMinor, "1000"); assert.equal(taxSummary.netTaxPayable, 1001);
    const salesReport = await check(...pairs[2]); assert.equal(salesReport.exemptAmountMinor, "300");
    assert.equal(salesReport.breakdown.find((r: { taxRateName: string }) => r.taxRateName === "Standard").taxCollectedMinor, "2001");
    const vatReport = await check(...pairs[3]); assert.deepEqual(vatReport.boxes.map((box: { amountMinor: string }) => box.amountMinor), ["2000","300","2300","1300","1000","10000","5000","10000","5000"]);
    const cashVat = await check(...pairs[3], { ...period, basis: "cash" }); assert.equal(cashVat.boxes[0].amountMinor, "1700"); assert.equal(cashVat.boxes[1].amountMinor, "300");
    const flat = await check(...pairs[3], { ...period, flatRatePercent: 1450 }); assert.equal(flat.boxes[0].amountMinor, "1740"); assert.equal(flat.boxes[3].amountMinor, "0");
    const drill = await check(...pairs[4]); assert.equal(drill.totalMinor, "2300"); assert.equal(drill.count, 2);
    for (const box of ["1A", "4", "1B"]) assert.equal((await check(...pairs[4], { ...period, box })).totalMinor, box === "1A" ? "2300" : "1300");
    const basReport = await check(...pairs[5]); assert.deepEqual(basReport.fields.map((field: { amountMinor: string }) => field.amountMinor), ["12000","10000","0","0","6000","2300","1300","1000"]);
    const scheduleReport = await check(...pairs[6]); assert.equal(scheduleReport.totalIncomeMinor, "10000"); assert.equal(scheduleReport.totalExpensesMinor, "5000"); assert.equal(scheduleReport.netProfitMinor, "5000");
    assert.equal(scheduleReport.lines.find((line: { line: string }) => line.line === "2").amountMinor, "100");
    for (const [path, name, handler] of pairs) {
      const args = argsFor(path);
      assert.equal((await handler(request(path, args, "dk_invalid"))).status, 401);
      assert.equal((await handler(request(path, args, keys.denied))).status, 403); assert.equal((await noRead.call(name, args)).body.status, 403);
      const other = await (await handler(request(path, args, keys.b))).json(); assert.deepEqual((await mb.call(name, args)).body, other);
      assert.ok(!JSON.stringify(other).includes("Vendor")); assert.ok(!JSON.stringify(await check(path, name, handler)).includes("Foreign secret"));
      const invalid = path === "1099" ? { year: "2024bad" } : { ...args, startDate: "2024-02-30" };
      assert.equal((await handler(request(path, invalid))).status, 400); assert.equal((await ma.call(name, invalid)).isError, true);
      assert.equal((await handler(request(path, { ...args, unknown: 1 }))).status, 400);
    }
    assert.deepEqual(await snapshot(), before);
    const [ownedPeriod, foreignPeriod] = await db.insert(taxPeriod).values([{ organizationId: a.id, startDate: period.startDate, endDate: period.endDate, type: "monthly", name: "Owned" },
      { organizationId: b.id, startDate: period.startDate, endDate: period.endDate, type: "monthly", name: "Foreign" }]).returning();
    assert.equal((await check(...pairs[4], { box: "1", periodId: ownedPeriod.id })).totalMinor, "2300");
    await check(...pairs[4], { box: "1", periodId: foreignPeriod.id }, 404);
    for (const box of ["2", "6", "bad"]) assert.equal((await transactions(request("vat-return/transactions", { ...period, box }))).status, 400);
    await db.update(organization).set({ vatScheme: "cash" }).where(eq(organization.id, a.id));
    assert.equal((await check(...pairs[4], { box: "1", periodId: ownedPeriod.id })).totalMinor, "2000");
    await db.update(organization).set({ vatScheme: "accrual" }).where(eq(organization.id, a.id));
    const [foreignBank] = await db.insert(chartAccount).values({ organizationId: b.id, code: "1000", name: "Foreign bank", type: "asset", subType: "bank" }).returning();
    await entry([{ accountId: output.id, credit: 9 }, { accountId: foreignBank.id, debit: 9 }], "2029-01-01");
    await entry([{ accountId: output.id, credit: 7 }], "2029-01-01", a.id, "payment");
    const cashPeriod = { startDate: "2029-01-01", endDate: "2029-01-01", basis: "cash" };
    assert.equal((await check(...pairs[4], { ...cashPeriod, box: "1" })).totalMinor, "7");
    // Malformed metadata references cannot reveal another tenant's rate/contact.
    await db.update(invoiceLine).set({ taxRateId: foreignRate.id }).where(eq(invoiceLine.invoiceId, sale.id));
    assert.ok(!JSON.stringify(await check(...pairs[2])).includes("Foreign secret"));
    await db.update(invoiceLine).set({ taxRateId: rate.id }).where(eq(invoiceLine.invoiceId, sale.id));
    await db.update(invoice).set({ contactId: foreign.id }).where(eq(invoice.id, sale.id));
    assert.equal((await check(...pairs[3])).boxes[7].amountMinor, "0");
    await db.update(invoice).set({ contactId: vendor.id }).where(eq(invoice.id, sale.id));
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      for (const table of [invoice, bill, payment]) await db.update(table).set({ currencyCode: currency });
      for (const [path, name, handler] of pairs) { const body = await check(path, name, handler); assert.equal(body.currencyCode, currency); }
      assert.equal((await check(...pairs[3])).boxes[0].amountMinor, "2000");
    }
    await db.update(invoice).set({ currencyCode: "EUR" }).where(eq(invoice.id, sale.id));
    for (const i of [1,2,3,5]) { const [path, name, handler] = pairs[i]; const body = await check(path, name, handler, argsFor(path), 422); assert.equal(body.code, "LEGACY_NUMERIC_RANGE"); }
    await db.update(invoice).set({ currencyCode: "KWD" }).where(eq(invoice.id, sale.id));
    await db.update(payment).set({ currencyCode: "EUR" }); await check(...pairs[0], { year: 2024 }, 422);
    await db.update(payment).set({ currencyCode: "KWD" });
    // Numeric quantity multiplication must not overflow int64 or round before cancellation.
    const [largeSale] = await db.insert(invoice).values({ organizationId: a.id, contactId: vendor.id, invoiceNumber: "Huge",
      issueDate: "2025-01-01", dueDate: "2025-01-01", status: "sent", currencyCode: "KWD" }).returning();
    const extremeLines = await db.insert(invoiceLine).values(["positive", "negative", "cent"].map(description => ({
      invoiceId: largeSale.id, description, taxRateId: rate.id, quantity: 200,
    }))).returning({ id: invoiceLine.id });
    await db.execute(sql`update ${invoiceLine} set amount=9223372036854775807, tax_amount=9223372036854775807, unit_price=9223372036854775807 where id=${extremeLines[0].id}`);
    await db.execute(sql`update ${invoiceLine} set amount=-9223372036854775807, tax_amount=-9223372036854775807, unit_price=-9223372036854775807 where id=${extremeLines[1].id}`);
    await db.execute(sql`update ${invoiceLine} set amount=1, tax_amount=1, unit_price=1 where id=${extremeLines[2].id}`);
    const largePeriod = { startDate: "2025-01-01", endDate: "2025-01-01" };
    const exactSummary = await check(...pairs[1], largePeriod);
    assert.equal(exactSummary.totalOutputTaxMinor, "1"); assert.equal(exactSummary.rates[0].outputNetMinor, "2");
    assert.equal((await check(...pairs[2], largePeriod)).breakdown[0].taxableAmountMinor, "1");
    await db.execute(sql`update ${invoiceLine} set amount=0, tax_amount=0, unit_price=0 where id=${extremeLines[1].id}`);
    await check(...pairs[1], largePeriod, 422); await check(...pairs[2], largePeriod, 422);
    // Above-safe and above-int64 SQL aggregate cancellation must retain one cent.
    const huge = await entry([{ accountId: output.id }], "2025-01-01");
    await db.execute(sql`update ${journalLine} set credit_amount=9223372036854775807, debit_amount=9223372036854775806 where journal_entry_id=${huge.id}`);
    const huge2 = await entry([{ accountId: output.id }], "2025-01-01");
    await db.execute(sql`update ${journalLine} set credit_amount=9223372036854775807, debit_amount=9223372036854775807 where journal_entry_id=${huge2.id}`);
    assert.equal((await check(...pairs[3], largePeriod)).boxes[0].amountMinor, "1");
    assert.equal((await check(...pairs[5], largePeriod)).fields[5].amountMinor, "1");
    await check(...pairs[4], { ...largePeriod, box: "1" }, 422); // individual legs are exposed
    await db.execute(sql`update ${journalLine} set debit_amount=0 where journal_entry_id=${huge.id}`);
    await check(...pairs[3], largePeriod, 422); await check(...pairs[5], largePeriod, 422);
    const largeIncome = await entry([{ accountId: revenue.id }], "2026-01-01");
    await db.execute(sql`update ${journalLine} set credit_amount=9007199254740991 where journal_entry_id=${largeIncome.id}`);
    const incomePeriod = { startDate: "2026-01-01", endDate: "2026-01-01" };
    assert.equal((await check(...pairs[6], incomePeriod)).totalIncomeMinor, "9007199254740991");
    await db.execute(sql`update ${journalLine} set credit_amount=9007199254740992 where journal_entry_id=${largeIncome.id}`);
    await check(...pairs[6], incomePeriod, 422);
    const totalOverflow = await entry([{ accountId: output.id, credit: Number.MAX_SAFE_INTEGER }, { accountId: output.id, credit: 1 }], "2027-01-01");
    await check(...pairs[4], { startDate: "2027-01-01", endDate: "2027-01-01", box: "1" }, 422);
    await db.delete(journalEntry).where(eq(journalEntry.id, totalOverflow.id));
    await db.execute(sql`update ${payment} set amount=9007199254740991 where contact_id=${vendor.id} and organization_id=${a.id} and method='cash' and type='made' and deleted_at is null and date='2024-01-01'`);
    await check(...pairs[0], { year: 2024 }, 422);
    await check(...pairs[0], { year: 2024, thresholdMinor: "9007199254740992" }, 422);
    const final = await snapshot();
    for (const pair of pairs) await pair[2](request(pair[0], argsFor(pair[0])));
    assert.deepEqual(await snapshot(), final);
    console.log("REST and MCP tax reports verified");
  } finally { await ma.close(); await mb.close(); await noRead.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$client.end());
