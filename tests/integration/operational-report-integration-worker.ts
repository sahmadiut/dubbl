// Runs only in the harness's migrated disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, subscription, contact, invoice, bill,
  inventoryItem, bankAccount, bankTransaction, chartAccount } from "../../lib/db/schema";
import { GET as vendor } from "../../app/api/v1/reports/vendor-spend/route";
import { GET as customer } from "../../app/api/v1/reports/sales-by-customer/route";
import { GET as item } from "../../app/api/v1/reports/sales-by-item/route";
import { GET as expense } from "../../app/api/v1/reports/expense-analytics/route";
import { GET as profitability } from "../../app/api/v1/reports/profitability/route";
import { GET as monthly } from "../../app/api/v1/reports/monthly-trends/route";
import { GET as executive } from "../../app/api/v1/reports/executive-summary/route";
import { GET as forecast } from "../../app/api/v1/reports/cash-flow-forecast/route";
import { GET as fx } from "../../app/api/v1/reports/unrealized-gains-losses/route";
import { GET as cash } from "../../app/api/v1/reports/bank-cash-flow/route";
import { GET as reconciliation } from "../../app/api/v1/reports/bank-reconciliation-status/route";
import { GET as valuation } from "../../app/api/v1/reports/inventory-valuation/route";
import { GET as recurring } from "../../app/api/v1/reports/recurring-transactions/route";
import { GET as calendar } from "../../app/api/v1/reports/financial-calendar/route";
import { GET as duplicates } from "../../app/api/v1/reports/duplicate-detection/route";
import { POST as createEntry } from "../../app/api/v1/entries/route";
import { POST as postEntry } from "../../app/api/v1/entries/[id]/post/route";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined operational reports", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { tools: (await client.listTools()).tools, async call(name: string, args: object = {}) {
    const result = await client.callTool({ name, arguments: { ...args } });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

// Each present alias must match its original number, including sparkline arrays.
function aliases(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (key.endsWith("Minor")) {
      const numeric: unknown = (value as Record<string, unknown>)[key.slice(0, -5)];
      if (Array.isArray(entry)) assert.deepEqual(entry, (numeric as number[]).map(String));
      else { assert.equal(typeof numeric, "number", key); assert.ok(Number.isSafeInteger(numeric), key); assert.equal(entry, String(numeric), key); }
    }
    aliases(entry);
  }
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Operational A", slug: "operational-a" }, { name: "Operational B", slug: "operational-b" },
  ]).returning();
  const [owner, denied] = await db.insert(users).values([
    { email: "operational-owner@example.test" }, { email: "operational-denied@example.test" },
  ]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No data", permissions: [] }).returning();
  await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id },
  ]);
  await db.insert(subscription).values({ organizationId: a.id, plan: "pro", overrideInvoicesPerMonth: 1000 });
  const keys = { a: "dk_operational_a", b: "dk_operational_b", denied: "dk_operational_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({
    organizationId: label === "b" ? b.id : a.id, createdBy: label === "denied" ? denied.id : owner.id,
    name: label, keyPrefix: "dk_operational", keyHash: createHash("sha256").update(key).digest("hex"),
  });
  const [local, foreign] = await db.insert(contact).values([
    { organizationId: a.id, name: "Local", type: "both" }, { organizationId: b.id, name: "Foreign secret", type: "both" },
  ]).returning();
  const [stock, foreignStock] = await db.insert(inventoryItem).values([
    { organizationId: a.id, code: "LOCAL", name: "Local stock", quantityOnHand: 3, purchasePrice: 250, salePrice: 1250, totalValue: 750, averageCost: 250 },
    { organizationId: b.id, code: "SECRET", name: "Foreign secret", quantityOnHand: 1, purchasePrice: 777, salePrice: 777, totalValue: 777 },
  ]).returning();
  const [bank, foreignBank] = await db.insert(bankAccount).values([
    { organizationId: a.id, accountName: "Local bank", balance: 5000 }, { organizationId: b.id, accountName: "Foreign secret", balance: 777 },
  ]).returning();
  const accounts = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1000", name: "Cash", type: "asset" as const, subType: "bank" },
    { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" as const },
  ]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id });
  const noRead = await mcp({ ...ctx, userId: denied.id, role: "member", permissions: [] });
  const today = new Date().toISOString().slice(0, 10), period = { startDate: today, endDate: today };
  const pairs = [
    ["vendor-spend", "vendor_spend", vendor, period], ["sales-by-customer", "sales_by_customer", customer, period],
    ["sales-by-item", "sales_by_item", item, period], ["expense-analytics", "expense_analytics", expense, period],
    ["profitability", "contact_profitability", profitability, period], ["monthly-trends", "monthly_trends", monthly, { months: 1 }],
    ["executive-summary", "executive_summary", executive, period], ["cash-flow-forecast", "cash_flow_forecast", forecast, { weeks: 1 }],
    ["unrealized-gains-losses", "unrealized_gains_losses", fx, {}], ["bank-cash-flow", "bank_cash_flow", cash, period],
    ["bank-reconciliation-status", "bank_reconciliation_status", reconciliation, {}],
    ["inventory-valuation", "get_inventory_valuation", valuation, {}], ["recurring-transactions", "recurring_transactions", recurring, {}],
    ["financial-calendar", "financial_calendar", calendar, period], ["duplicate-detection", "duplicate_detection", duplicates, {}],
  ] as const;
  const request = (path: string, key = keys.a, body?: unknown) => new Request(`http://fixture.test/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "invoice_line", "bill", "bill_line", "journal_entry", "journal_line", "chart_account",
      "inventory_item", "inventory_cost_layer", "bank_account", "bank_transaction", "recurring_template", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select to_jsonb(t)::text as row from ${table} t order by id`))).rows;
    return result;
  };
  const get = async (pair: typeof pairs[number], client = ma, key = keys.a) => {
    const [path, name, handler, input] = pair;
    const query = new URLSearchParams(Object.entries(input).map(([k, v]) => [k, String(v)]));
    const response = await handler(request(`reports/${path}?${query}`, key));
    assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
    const body = await response.json(), tool = await client.call(name, input);
    assert.equal(tool.isError, false, JSON.stringify(tool.body)); assert.deepEqual(tool.body, body, path); aliases(body);
    return body;
  };
  try {
    for (const [, name] of pairs) {
      const tool = ma.tools.find(tool => tool.name === name)!;
      assert.ok(tool, name); assert.equal(tool.inputSchema.additionalProperties, false, name);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
    }
    // Numeric and exact document writers feed all document-derived reports together.
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }]) {
      const input = { contactId: local.id, issueDate: today, dueDate: today, lines: [{ description: "Combined sale", inventoryItemId: stock.id, ...price }] };
      let saved;
      if ("unitPrice" in price) {
        const response = await createInvoice(request("invoices", keys.a, input));
        assert.equal(response.status, 201, await response.clone().text()); saved = await response.json();
      } else {
        const result = await ma.call("create_invoice", input); assert.equal(result.isError, false, JSON.stringify(result.body)); saved = result.body;
      }
      await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, saved.invoice.id));
    }
    const purchase = await ma.call("create_bill", { contactId: local.id, issueDate: today, dueDate: today,
      lines: [{ description: "Combined purchase", unitPriceMinor: "250" }] });
    assert.equal(purchase.isError, false, JSON.stringify(purchase.body));
    await db.update(bill).set({ status: "received" }).where(eq(bill.id, purchase.body.bill.id));
    await db.insert(invoice).values({ organizationId: b.id, contactId: foreign.id, invoiceNumber: "SECRET", issueDate: today, dueDate: today,
      currencyCode: "USD", status: "sent", total: 777, amountDue: 777 });
    await db.insert(bankTransaction).values([
      { bankAccountId: bank.id, date: today, description: "Subscription 1", amount: -250 },
      { bankAccountId: bank.id, date: today, description: "Subscription 2", amount: -250 },
      { bankAccountId: foreignBank.id, date: today, description: "Foreign secret", amount: 777 },
    ]);
    const journal = { date: today, description: "Combined ledger", lines: [
      { accountId: accounts[0].id, debitAmountMinor: "2250" }, { accountId: accounts[1].id, creditAmount: 2500 },
      { accountId: accounts[2].id, debitAmount: 250 },
    ] };
    const created = await createEntry(request("entries", keys.a, journal)); assert.equal(created.status, 201, await created.clone().text());
    const entryId = (await created.json()).entry.id;
    assert.equal((await postEntry(request(`entries/${entryId}/post`, keys.a, {}), { params: Promise.resolve({ id: entryId }) })).status, 200);

    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      // Change only synthetic currency tags, preserving every saved integer.
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      await db.update(invoice).set({ currencyCode: currency }).where(eq(invoice.organizationId, a.id));
      await db.update(bill).set({ currencyCode: currency }).where(eq(bill.organizationId, a.id));
      await db.update(bankAccount).set({ currencyCode: currency }).where(eq(bankAccount.id, bank.id));
      const before = await snapshot();
      const reports = await Promise.all(pairs.map(pair => get(pair)));
      const [vs, cs, is, ea, pr, mt, ex, fc, uf, bc, br, iv, rt, cal, dup] = reports;
      assert.equal(vs.totalSpendMinor, "250"); assert.equal(cs.totals.netMinor, "2500"); assert.equal(is.totals.netMinor, cs.totals.netMinor);
      assert.equal(pr.totalRevenueMinor, cs.totals.netMinor); assert.equal(pr.totalCostsMinor, vs.totalSpendMinor); assert.equal(pr.totalProfitMinor, "2250");
      assert.equal(ea.totalExpensesMinor, vs.totalSpendMinor); assert.equal(mt.months[0].netIncomeMinor, pr.totalProfitMinor);
      assert.equal(ex.kpis.find((k: { key: string }) => k.key === "netIncome").currentMinor, pr.totalProfitMinor);
      assert.equal(fc.totalInflowsMinor, cs.totals.netMinor); assert.equal(fc.totalOutflowsMinor, vs.totalSpendMinor); assert.equal(fc.netForecastMinor, pr.totalProfitMinor);
      assert.equal(uf.items.length, 0); assert.equal(bc.totals.netMinor, "-500"); assert.equal(br.accounts[0].balanceDiscrepancyMinor, "5500");
      assert.equal(iv.summary.carryingValueMinor, "750"); assert.equal(iv.summary.totalCostMinor, "750"); assert.equal(iv.summary.totalValueMinor, "3750");
      assert.equal(rt.patterns[0].avgAmountMinor, "-250"); assert.equal(rt.patterns[0].count, 2);
      assert.equal(cal.events.filter((e: { type: string }) => e.type === "invoice_due").reduce((sum: bigint, e: { amountMinor: string }) => sum + BigInt(e.amountMinor), 0n), 2500n);
      assert.equal(dup.totalGroups, 1); assert.equal(dup.duplicateGroups[0].amountMinor, "1250");
      for (const r of [vs, cs, is, ea, pr, mt, ex, fc, bc]) assert.equal(r.currencyCode, currency);
      assert.equal(iv.summary.currencyCode, currency); assert.equal(br.accounts[0].currencyCode, currency);
      assert.equal(rt.patterns[0].currencyCode, currency); assert.ok(cal.events.every((e: { currencyCode: string }) => e.currencyCode === currency));
      assert.equal(dup.duplicateGroups[0].currencyCode, currency); assert.deepEqual(await snapshot(), before);
    }
    const before = await snapshot();
    const foreignReports = await Promise.all(pairs.map(pair => get(pair, mb, keys.b)));
    assert.equal(foreignReports[7].totalInflowsMinor, "777");
    assert.equal(foreignReports[9].totals.netMinor, "777");
    assert.equal(foreignReports[10].accounts[0].balanceMinor, "777");
    assert.equal(foreignReports[11].summary.carryingValueMinor, "777");
    assert.equal(foreignReports[13].events[0].amountMinor, "777");
    for (const pair of pairs) {
      const [path, name, handler, input] = pair, query = new URLSearchParams(Object.entries(input).map(([k, v]) => [k, String(v)]));
      assert.equal((await handler(request(`reports/${path}?${query}`, "dk_operational_invalid"))).status, 401, path);
      assert.equal((await handler(request(`reports/${path}?${query}`, keys.denied))).status, 403, path);
      assert.equal((await noRead.call(name, input)).body.status, 403, name);
      assert.equal((await handler(request(`reports/${path}?${query}&unknown=1`))).status, 400, path);
      assert.equal((await ma.call(name, { ...input, unknown: 1 })).isError, true, name);
      if (query.size) { const [key, value] = [...query][0]; assert.equal((await handler(request(`reports/${path}?${query}&${key}=${value}`))).status, 400, path); }
    }
    assert.deepEqual(await snapshot(), before);
    // The reused valuation boundary must fail before disclosure or serialization.
    for (const suffix of ["?sortBy=invalid", "?sortOrder=asc&sortOrder=asc"]) assert.equal((await valuation(request(`reports/inventory-valuation${suffix}`))).status, 400);
    await db.execute(sql`update ${inventoryItem} set total_value=9223372036854775807 where id=${stock.id}`);
    const unsafe = await snapshot();
    assert.equal((await valuation(request("reports/inventory-valuation"))).status, 422);
    assert.equal((await ma.call("get_inventory_valuation")).body.code, "LEGACY_NUMERIC_RANGE"); assert.deepEqual(await snapshot(), unsafe);
    await db.update(inventoryItem).set({ totalValue: 750 }).where(eq(inventoryItem.id, stock.id));
    await db.update(organization).set({ defaultCurrency: "XXX" }).where(eq(organization.id, a.id));
    const invalidCurrency = await snapshot();
    assert.equal((await valuation(request("reports/inventory-valuation"))).status, 422);
    assert.equal((await ma.call("get_inventory_valuation")).body.code, "LEGACY_NUMERIC_RANGE"); assert.deepEqual(await snapshot(), invalidCurrency);
    assert.ok(foreignStock.id);
    console.log("Combined operational report contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close()]); }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
