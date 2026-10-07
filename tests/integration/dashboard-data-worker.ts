import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, invoice, bill, inventoryItem, subscription,
  bankAccount, bankTransaction, bankReconciliation, reminderRule } from "../../lib/db/schema";
import { GET as widget } from "../../app/api/v1/dashboard/widgets/[type]/data/route";
import { GET as alerts } from "../../app/api/v1/dashboard/alerts/route";
import { registerDashboardDataTools } from "../../lib/mcp/tools/dashboard-data";
import { registerAllTools } from "../../lib/mcp/tools";
import { getDashboardWidget, getDashboardAlerts } from "../../lib/api/dashboard-data";
import { createInvoice } from "../../lib/api/invoice-writes";
import { createBill } from "../../lib/api/bill-writes";
import { createBankAccount } from "../../lib/api/bank-accounts";
import type { AuthContext } from "../../lib/api/auth-context";

const operations = [
  ["accounts_receivable", "get_dashboard_receivables"], ["accounts_payable", "get_dashboard_payables"],
  ["bank_balances", "get_dashboard_bank_balances"], ["inventory_alerts", "get_dashboard_inventory_alerts"],
  ["quick_actions", "get_dashboard_quick_actions"], ["alerts", "get_dashboard_alerts"],
] as const;

async function mcp(ctx: AuthContext, all = false) {
  const server = new McpServer({ name: "Dashboard fixture", version: "1" });
  if (all) registerAllTools(server, ctx); else registerDashboardDataTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.filter(tool => operations.some(([, name]) => tool.name === name)).length, 6);
  for (const [, name] of operations) {
    const tool = tools.find(tool => tool.name === name)!; assert.match(tool.description!, /Requires view:data/);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    return { isError: result.isError === true, body: JSON.parse((result.content as { text: string }[])[0].text) };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Dashboard A", slug: "da" }, { name: "Dashboard B", slug: "db" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "dash-owner@example.test" }, { email: "dash-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No data", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro", overrideInvoicesPerMonth: 1000 }, { organizationId: b.id, plan: "pro" }]);
  const keys = { a: "dk_dash_a", b: "dk_dash_b", denied: "dk_dash_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_dash" });
  const [local, foreign] = await db.insert(contact).values([{ organizationId: a.id, name: "Local", type: "both" },
    { organizationId: b.id, name: "Foreign secret", type: "both" }]).returning();
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const ma = await mcp(ctx, true), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, permissions: [] });
  const request = (kind: string, suffix = "", key = keys.a) => new Request(`http://fixture.test/api/v1/dashboard/${kind}${suffix}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const response = (kind: string, suffix = "", key = keys.a) => kind === "alerts" ? alerts(request(kind, suffix, key))
    : widget(request(kind, suffix, key), { params: Promise.resolve({ type: kind }) });
  const parity = async (kind: string, suffix = "", args = {}, client = ma, key = keys.a) => {
    const res = await response(kind, suffix, key); assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json(); const tool = operations.find(([type]) => type === kind)![1];
    const result = await client.call(tool, args); assert.equal(result.isError, false); assert.deepEqual(result.body, body); return body;
  };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "invoice_line", "bill", "bill_line", "bank_account", "bank_transaction", "bank_reconciliation", "reminder_rule", "inventory_item", "journal_entry", "journal_line", "audit_log", "notification"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  const today = new Date().toISOString().slice(0, 10);
  const day = (offset: number) => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
  let sequence = 0;
  const seed = async (kind: string, amount: number, options: { org?: string; currency?: string; due?: string; status?: "draft" | "paid" | "void" | "overdue"; deleted?: boolean } = {}) => {
    const values = { organizationId: options.org ?? a.id, contactId: options.org === b.id ? foreign.id : local.id,
      issueDate: "2024-01-01", dueDate: options.due ?? "2024-12-31", amountDue: amount, currencyCode: options.currency ?? "USD", deletedAt: options.deleted ? new Date() : null };
    if (kind === "accounts_receivable") return (await db.insert(invoice).values({ ...values, invoiceNumber: `DI-${++sequence}`, status: options.status ?? "sent" }).returning())[0].id;
    return (await db.insert(bill).values({ ...values, billNumber: `DB-${++sequence}`, status: options.status ?? "received" }).returning())[0].id;
  };
  const clear = async (kind: string) => {
    if (kind === "accounts_receivable") await db.delete(invoice).where(eq(invoice.organizationId, a.id));
    else await db.delete(bill).where(eq(bill.organizationId, a.id));
  };
  const range = async (kind: string, tool: string, suffix = "", args = {}) => {
    const before = await snapshot(); const res = await response(kind, suffix); assert.equal(res.status, 422);
    assert.equal((await res.json()).code, "LEGACY_NUMERIC_RANGE");
    const result = await ma.call(tool, args); assert.equal(result.isError, true); assert.equal(result.body.code, "LEGACY_NUMERIC_RANGE");
    assert.deepEqual(await snapshot(), before);
  };
  try {
    for (const [kind, tool] of operations) {
      const before = await snapshot(); const empty = await parity(kind);
      if (kind === "accounts_receivable" || kind === "accounts_payable") assert.deepEqual(empty, { total: 0, totalMinor: "0", currencyCode: "USD", count: 0, overdueCount: 0 });
      assert.equal((await response(kind, "", "dk_dash_invalid")).status, 401);
      assert.equal((await response(kind, "", keys.denied)).status, 403);
      assert.equal((await noRead.call(tool)).body.status, 403);
      for (const query of ["?currencyCode=usd", "?currencyCode=XXX", "?currencyCode=", "?unknown=1", "?currencyCode=USD&currencyCode=USD"])
        assert.equal((await response(kind, query)).status, 400);
      assert.deepEqual(await snapshot(), before);
    }
    assert.equal((await response("unknown")).status, 400);
    // Real legacy and exact writer inputs feed compatible/exact dashboard readers.
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }]) {
      const input = { contactId: local.id, issueDate: "2024-01-01", dueDate: "2024-12-31", lines: [{ description: "Client", ...price }] };
      await createInvoice(ctx, input, "rest"); await createBill(ctx, input, "rest");
    }
    for (const kind of ["accounts_receivable", "accounts_payable"]) {
      const body = await parity(kind); assert.equal(body.totalMinor, "2500"); assert.equal(body.total, 2500); assert.equal(body.count, 2);
      await clear(kind);
    }
    for (const [kind, tool] of operations.slice(0, 2)) {
      await seed(kind, 100); await seed(kind, -1, { status: "overdue" });
      for (const status of ["draft", "paid", "void"] as const) await seed(kind, 7, { status });
      await seed(kind, 8, { due: today }); await seed(kind, 9, { due: day(1) });
      await seed(kind, 900, { deleted: true }); await seed(kind, 1000, { org: b.id });
      let before = await snapshot();
      const body = await parity(kind); assert.equal(body.totalMinor, "137"); assert.equal(body.count, 7); assert.equal(body.overdueCount, 1);
      const action = await parity("alerts"); const key = kind === "accounts_receivable" ? "overdueInvoices" : "overdueBills";
      assert.equal(action[key].totalMinor, "99"); assert.equal(action[key].count, 2);
      assert.deepEqual(await snapshot(), before);
      const foreignBody = await parity(kind, "", {}, mb, keys.b); assert.equal(foreignBody.totalMinor, "1000");
      for (const currency of ["IRR", "JPY", "KWD"]) {
        const id = await seed(kind, 1250, { currency }); await range(kind, tool); await range("alerts", "get_dashboard_alerts");
        const filtered = await parity(kind, `?currencyCode=${currency}`, { currencyCode: currency });
        assert.equal(filtered.totalMinor, "1250"); assert.equal(filtered.currencyCode, currency);
        assert.equal((await parity("alerts", `?currencyCode=${currency}`, { currencyCode: currency }))[key].totalMinor, "1250");
        if (kind === "accounts_receivable") await db.delete(invoice).where(eq(invoice.id, id)); else await db.delete(bill).where(eq(bill.id, id));
      }
      await clear(kind);
      await seed(kind, Number.MAX_SAFE_INTEGER); await seed(kind, 1); await seed(kind, -Number.MAX_SAFE_INTEGER);
      assert.equal((await parity(kind)).totalMinor, "1"); assert.equal((await parity("alerts"))[key].totalMinor, "1"); await clear(kind);
      for (const amount of [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]) {
        await seed(kind, amount); assert.equal((await parity(kind)).total, amount); assert.equal((await parity("alerts"))[key].totalMinor, String(amount)); await clear(kind);
      }
      await seed(kind, Number.MAX_SAFE_INTEGER); await seed(kind, 1); await range(kind, tool); await range("alerts", "get_dashboard_alerts"); await clear(kind);
      const unsafe = await seed(kind, 1); const table = kind === "accounts_receivable" ? invoice : bill;
      await db.execute(sql`update ${table} set amount_due=9223372036854775807 where id=${unsafe}`);
      await range(kind, tool); await range("alerts", "get_dashboard_alerts"); await clear(kind);
      await seed(kind, 1, { currency: "XXX" }); await range(kind, tool); await range("alerts", "get_dashboard_alerts"); await clear(kind);
      const invalidDate = await seed(kind, 1);
      await db.execute(sql`update ${table} set due_date='-infinity'::date where id=${invalidDate}`);
      await range("alerts", "get_dashboard_alerts"); await clear(kind);
      assert.equal((await parity(kind, "?currencyCode=JPY", { currencyCode: "JPY" })).totalMinor, "0");
      before = await snapshot(); await parity("alerts"); assert.deepEqual(await snapshot(), before);
    }
    const written = [];
    for (const balance of [{ balance: 1250 }, { balanceMinor: "-1250" }]) {
      const saved = await createBankAccount(ctx, { accountName: "Client bank", ...balance }); written.push(saved.bankAccount.id);
    }
    let balances = await parity("bank_balances"); assert.deepEqual(balances.accounts.map((v: { balance: number }) => v.balance).sort((a: number, b: number) => a - b), [-1250, 1250]);
    const [inactive, deletedBank, foreignBank, never, old, boundary, recent] = await db.insert(bankAccount).values([
      { organizationId: a.id, accountName: "Inactive", isActive: false, balance: -9, currencyCode: "JPY" },
      { organizationId: a.id, accountName: "Deleted secret", deletedAt: new Date(), balance: 900 },
      { organizationId: b.id, accountName: "Foreign secret", balance: 800 },
      { organizationId: a.id, accountName: "Never reconciled", balance: 1, currencyCode: "IRR" },
      { organizationId: a.id, accountName: "Old recon", balance: 1250, currencyCode: "KWD" },
      { organizationId: a.id, accountName: "30 day boundary" }, { organizationId: a.id, accountName: "Recent recon" },
    ]).returning();
    await db.insert(bankTransaction).values([written[0], inactive.id, deletedBank.id, foreignBank.id].map(id => ({ bankAccountId: id, date: today, description: "Uncategorized", amount: 1 })));
    await db.insert(bankTransaction).values({ bankAccountId: written[0], date: today, description: "Excluded", amount: 1, status: "excluded" });
    await db.insert(bankReconciliation).values([
      { bankAccountId: old.id, startDate: day(-60), endDate: day(-31), status: "completed" },
      { bankAccountId: boundary.id, startDate: day(-60), endDate: day(-30), status: "completed" },
      { bankAccountId: recent.id, startDate: day(-60), endDate: day(-31), status: "completed" },
      { bankAccountId: recent.id, startDate: day(-30), endDate: day(-1), status: "completed" },
      { bankAccountId: never.id, startDate: day(-30), endDate: today, status: "in_progress" },
    ]);
    const rule = { triggerType: "after_due" as const, triggerDays: 1, subjectTemplate: "Reminder", bodyTemplate: "Body", documentType: "invoice" as const, recipientType: "contact_email" as const };
    await db.insert(reminderRule).values([
      { ...rule, organizationId: a.id, name: "Enabled", enabled: true }, { ...rule, organizationId: a.id, name: "Disabled", enabled: false },
      { ...rule, organizationId: a.id, name: "Deleted", enabled: true, deletedAt: new Date() }, { ...rule, organizationId: b.id, name: "Foreign secret", enabled: true },
    ]);
    balances = await parity("bank_balances"); assert.equal(balances.accounts.length, 7); assert.ok(!JSON.stringify(balances).includes("secret"));
    const foreignBalances = await parity("bank_balances", "", {}, mb, keys.b); assert.equal(foreignBalances.accounts.length, 1); assert.equal(foreignBalances.accounts[0].balanceMinor, "800");
    for (const row of balances.accounts) assert.equal(row.balanceMinor, String(row.balance));
    for (const currency of ["JPY", "IRR", "KWD"]) {
      const body = await parity("bank_balances", `?currencyCode=${currency}`, { currencyCode: currency }); assert.equal(body.accounts.length, 1); assert.equal(body.accounts[0].currencyCode, currency);
    }
    let action = await parity("alerts"); assert.equal(action.uncategorizedTransactions, 2); assert.equal(action.activeReminderRules, 1);
    const foreignAction = await parity("alerts", "", {}, mb, keys.b); assert.equal(foreignAction.uncategorizedTransactions, 1); assert.equal(foreignAction.activeReminderRules, 1);
    assert.deepEqual(action.accountsNeedingReconciliation.map((v: { bankAccountId: string }) => v.bankAccountId).sort(), [...written, never.id, old.id].sort());
    assert.ok(!JSON.stringify(action).includes("secret"));
    assert.deepEqual((await parity("alerts", "?currencyCode=JPY", { currencyCode: "JPY" })).accountsNeedingReconciliation, action.accountsNeedingReconciliation);
    // Unconsumed unsafe columns do not break count-only/narrow dashboard projections.
    await db.execute(sql`update ${bankAccount} set low_balance_threshold=9223372036854775807 where id=${old.id}`);
    await parity("bank_balances"); await parity("alerts");
    for (const amount of ["9007199254740991", "-9007199254740991"]) {
      await db.execute(sql`update ${bankAccount} set balance=${amount}::bigint where id=${old.id}`);
      assert.equal((await parity("bank_balances", "?currencyCode=KWD", { currencyCode: "KWD" })).accounts[0].balanceMinor, amount);
    }
    await db.execute(sql`update ${bankAccount} set balance=9223372036854775807 where id=${old.id}`);
    await range("bank_balances", "get_dashboard_bank_balances"); await parity("alerts"); await parity("bank_balances", "?currencyCode=JPY", { currencyCode: "JPY" });
    await db.update(bankAccount).set({ balance: 1, currencyCode: "XXX" }).where(eq(bankAccount.id, old.id));
    await range("bank_balances", "get_dashboard_bank_balances"); await db.update(bankAccount).set({ currencyCode: "KWD" }).where(eq(bankAccount.id, old.id));
    await db.insert(inventoryItem).values(Array.from({ length: 12 }, (_, index) => ({ organizationId: a.id, name: `Low ${index}`, code: `LOW-${index}`, quantityOnHand: index - 1, reorderPoint: 10 })));
    await db.insert(inventoryItem).values([{ organizationId: a.id, name: "Inactive", code: "INACTIVE", isActive: false },
      { organizationId: a.id, name: "Deleted secret", code: "DELETED", deletedAt: new Date() }, { organizationId: b.id, name: "Foreign secret", code: "FOREIGN" },
      { organizationId: a.id, name: "Enough", code: "ENOUGH", quantityOnHand: 11, reorderPoint: 10 }]);
    const items = await parity("inventory_alerts"); assert.equal(items.lowStockCount, 12); assert.equal(items.items.length, 10);
    assert.equal((await parity("inventory_alerts", "", {}, mb, keys.b)).lowStockCount, 1);
    assert.ok(!JSON.stringify(items).includes("secret")); assert.ok(items.items.every((v: { quantityOnHand: number; reorderPoint: number }) => v.quantityOnHand <= v.reorderPoint));
    await db.execute(sql`update ${inventoryItem} set purchase_price=9223372036854775807 where organization_id=${a.id}`); await parity("inventory_alerts");
    for (const kind of ["inventory_alerts", "quick_actions"]) assert.equal((await response(kind, "?currencyCode=USD")).status, 400);
    const before = await snapshot(); for (const [kind] of operations) await parity(kind); assert.deepEqual(await snapshot(), before);
    await assert.rejects(getDashboardAlerts({ ...ctx, organizationId: randomUUID() }), { status: 404 });
    await assert.rejects(getDashboardWidget({ ...ctx, permissions: [] }, "quick_actions"), { status: 403 });
    await assert.rejects(getDashboardAlerts(ctx, { unknown: true }));
    await db.update(organization).set({ defaultCurrency: "XXX" }).where(eq(organization.id, a.id));
    await range("accounts_receivable", "get_dashboard_receivables"); await range("alerts", "get_dashboard_alerts");
    action = await parity("alerts", "?currencyCode=USD", { currencyCode: "USD" }); assert.equal(action.overdueInvoices.currencyCode, "USD");
    console.log("REST and MCP dashboard contracts verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close()]); }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
