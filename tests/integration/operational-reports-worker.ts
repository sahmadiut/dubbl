import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, invoice, bill, bankAccount, bankTransaction, recurringTemplate, recurringTemplateLine, budget, budgetLine, budgetPeriod, chartAccount } from "../../lib/db/schema";
import { GET as recurring } from "../../app/api/v1/reports/recurring-transactions/route";
import { GET as calendar } from "../../app/api/v1/reports/financial-calendar/route";
import { GET as duplicates } from "../../app/api/v1/reports/duplicate-detection/route";
import { registerOperationalReportTools } from "../../lib/mcp/tools/operational-reports";
import { createInvoice } from "../../lib/api/invoice-writes";
import { createBill } from "../../lib/api/bill-writes";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Operational fixture", version: "1" }); registerOperationalReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 3);
  for (const tool of tools) {
    assert.ok(tool.description);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args }); const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Operational A", slug: "op-a" }, { name: "Operational B", slug: "op-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "op-owner@example.test" }, { email: "op-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_operational_a", b: "dk_operational_b", denied: "dk_operational_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_op" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, permissions: [] });
  const request = (suffix = "", key = keys.a) => new Request(`http://fixture.test/report${suffix}`, { headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id } });
  const aliases = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key.endsWith("Minor")) {
        assert.equal(typeof child, "string");
        const numeric: unknown = (value as Record<string, unknown>)[key.slice(0, -5)];
        assert.equal(typeof numeric, "number"); assert.ok(Number.isSafeInteger(numeric)); assert.equal(BigInt(numeric as number).toString(), child);
      } else aliases(child);
    }
  };
  const read = async (handler: typeof calendar, suffix = "", key = keys.a) => {
    const response = await handler(request(suffix, key)); assert.equal(response.status, 200);
    const body = await response.json(); aliases(body); return body;
  };
  const dates = { startDate: "2024-01-01", endDate: "2024-03-31" }, query = "?startDate=2024-01-01&endDate=2024-03-31";
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "invoice_line", "bill", "bill_line", "bank_account", "bank_transaction", "recurring_template", "recurring_template_line", "budget", "budget_line", "budget_period", "journal_entry", "journal_line", "audit_log"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  const range = async (handler: typeof calendar, tool: string, suffix = "", input: Record<string, unknown> = {}) => {
    const before = await snapshot(); const response = await handler(request(suffix)); assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
    assert.equal((await ma.call(tool, input)).body.code, "LEGACY_NUMERIC_RANGE"); assert.deepEqual(await snapshot(), before);
  };
  try {
    for (const [handler, tool] of [[recurring, "recurring_transactions"], [calendar, "financial_calendar"], [duplicates, "duplicate_detection"]] as const) {
      assert.deepEqual((await ma.call(tool)).body, await read(handler));
      assert.equal((await handler(request("", "dk_invalid"))).status, 401); assert.equal((await handler(request("", keys.denied))).status, 403);
      assert.equal((await noRead.call(tool)).body.status, 403);
      assert.equal((await handler(request("?unknown=1"))).status, 400); assert.equal((await ma.call(tool, { unknown: 1 })).isError, true);
    }
    for (const suffix of ["?minOccurrences=1", "?minOccurrences=2x", "?minOccurrences=2.5", "?minOccurrences=10001", "?minOccurrences=2&minOccurrences=3", "?bankAccountId=", "?bankAccountId=x"])
      assert.equal((await recurring(request(suffix))).status, 400);
    for (const suffix of ["?startDate=2023-02-29", "?startDate=", "?startDate=2024-03-01&endDate=2024-02-01", "?startDate=9999-12-31", "?currencyCode=usd", "?startDate=2024-01-01&startDate=2024-02-01"])
      assert.equal((await calendar(request(suffix))).status, 400);
    for (const input of [{ minOccurrences: "2" }, { minOccurrences: 1 }, { minOccurrences: 2.5 }, { bankAccountId: "bad" }]) assert.equal((await ma.call("recurring_transactions", input)).isError, true);
    for (const input of [{ startDate: "2024-02-30" }, { currencyCode: "XXX" }, { startDate: "2024-03-01", endDate: "2024-02-01" }]) assert.equal((await ma.call("financial_calendar", input)).isError, true);
    const [local, foreign, deletedContact] = await db.insert(contact).values([{ organizationId: a.id, name: "Local", type: "both" },
      { organizationId: b.id, name: "Foreign secret", type: "both" }, { organizationId: a.id, name: "Deleted secret", deletedAt: new Date() }]).returning();
    const [bank, foreignBank, deletedBank, inactiveBank, kwdBank] = await db.insert(bankAccount).values([
      { organizationId: a.id, accountName: "Local" }, { organizationId: b.id, accountName: "Foreign secret" },
      { organizationId: a.id, accountName: "Deleted secret", deletedAt: new Date() }, { organizationId: a.id, accountName: "Inactive", isActive: false },
      { organizationId: a.id, accountName: "KWD", currencyCode: "KWD" }]).returning();
    const txn = async (id: string, amount: number, date = "2024-01-01", description = "Rent 123", excluded = false) =>
      (await db.insert(bankTransaction).values({ bankAccountId: id, amount, date, description, status: excluded ? "excluded" : "unreconciled" }).returning())[0];
    for (const id of [foreignBank.id, deletedBank.id, randomUUID()]) {
      assert.equal((await recurring(request(`?bankAccountId=${id}`))).status, 404); assert.equal((await ma.call("recurring_transactions", { bankAccountId: id })).body.status, 404);
    }
    for (let i = 0; i < 7; i++) await txn(bank.id, -(1250 + i), `2024-0${i + 1}-01`);
    for (const id of [foreignBank.id, deletedBank.id, inactiveBank.id, kwdBank.id]) { await txn(id, 10); await txn(id, 20, "2024-01-08"); }
    await txn(bank.id, 9999, "2024-01-08", "Rent 999", true); await txn(bank.id, 1, "2024-01-01", "123");
    const patterns = await read(recurring); assert.equal(patterns.patterns.length, 2);
    const usd = patterns.patterns[0]; assert.equal(usd.count, 9); assert.equal(usd.minAmountMinor, "-1256"); assert.equal(usd.maxAmountMinor, "20");
    assert.equal(usd.avgAmountMinor, "-971"); assert.equal(usd.direction, "mixed"); assert.equal(usd.transactions.length, 5);
    assert.deepEqual((await ma.call("recurring_transactions")).body, patterns);
    assert.equal((await read(recurring, "?minOccurrences=3")).patterns.length, 1);
    assert.deepEqual((await mb.call("recurring_transactions")).body, await read(recurring, "", keys.b));
    assert.equal((await read(recurring, `?bankAccountId=${inactiveBank.id}`)).patterns[0].frequency, "weekly");
    const movementsBefore = await snapshot(); await read(recurring); await ma.call("recurring_transactions"); assert.deepEqual(await snapshot(), movementsBefore);
    await db.delete(bankTransaction);
    for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(bankAccount).set({ currencyCode }).where(eq(bankAccount.id, bank.id));
      await txn(bank.id, 1250); await txn(bank.id, 1250, "2024-01-08");
      const output = await read(recurring); assert.equal(output.patterns[0].currencyCode, currencyCode); assert.equal(output.patterns[0].avgAmountMinor, "1250");
      assert.deepEqual((await ma.call("recurring_transactions")).body, output); await db.delete(bankTransaction);
    }
    await db.update(bankAccount).set({ currencyCode: "USD" }).where(eq(bankAccount.id, bank.id));
    // Average must remain exact even when its safe inputs sum beyond Number precision.
    for (const sign of [1, -1]) {
      await txn(bank.id, sign * Number.MAX_SAFE_INTEGER); await txn(bank.id, sign * (Number.MAX_SAFE_INTEGER - 1), "2024-01-08");
      const result = await read(recurring); assert.equal(result.patterns[0].avgAmountMinor, sign > 0 ? "9007199254740991" : "-9007199254740990");
      assert.deepEqual((await ma.call("recurring_transactions")).body, result); await db.delete(bankTransaction);
    }
    for (const amount of [1, -1]) {
      await txn(bank.id, amount); await txn(bank.id, 0, "2024-01-08");
      assert.equal((await read(recurring)).patterns[0].avgAmountMinor, amount === 1 ? "1" : "0"); await db.delete(bankTransaction);
    }
    for (let i = 0; i < 55; i++) for (const date of ["2024-01-01", "2024-01-08"]) await txn(bank.id, 1, date, `Pattern ${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + i % 26)}`);
    assert.equal((await read(recurring)).patterns.length, 50); assert.deepEqual((await ma.call("recurring_transactions")).body, await read(recurring));
    await db.delete(bankTransaction);
    const overflow = await txn(bank.id, 1); await db.execute(sql`update bank_transaction set amount=9223372036854775807 where id=${overflow.id}`);
    await range(recurring, "recurring_transactions"); await db.delete(bankTransaction);
    const mismatch = await txn(bank.id, 1); await db.update(bankTransaction).set({ currencyCode: "KWD" }).where(eq(bankTransaction.id, mismatch.id));
    await range(recurring, "recurring_transactions"); await db.delete(bankTransaction);
    const doc = async (payable: boolean, amount: number, options: { org?: string; contactId?: string; currency?: string; date?: string; deleted?: boolean; void?: boolean } = {}) => {
      const base = { organizationId: options.org ?? a.id, contactId: options.contactId ?? local.id, currencyCode: options.currency ?? "USD",
        issueDate: options.date ?? "2024-01-01", dueDate: options.date ?? "2024-01-01", total: amount, amountDue: amount,
        deletedAt: options.deleted ? new Date() : null };
      if (payable) return (await db.insert(bill).values({ ...base, billNumber: randomUUID(), status: options.void ? "void" : "received" }).returning())[0].id;
      return (await db.insert(invoice).values({ ...base, invoiceNumber: randomUUID(), status: options.void ? "void" : "sent" }).returning())[0].id;
    };
    // Both public legacy-major and exact-minor writer contracts feed these reads.
    for (const price of [{ unitPrice: 12.5 }, { unitPriceMinor: "1250" }]) {
      const input = { contactId: local.id, issueDate: "2024-01-01", dueDate: "2024-01-01", lines: [{ description: "Actual client", ...price }] };
      const inv = await createInvoice(ctx, input, "rest"); await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, inv.invoice.id));
      const payable = await createBill(ctx, input, "rest"); await db.update(bill).set({ status: "received" }).where(eq(bill.id, payable.bill.id));
    }
    for (const currency of ["IRR", "JPY", "KWD"]) { await doc(false, 1250, { currency }); await doc(false, 1250, { currency, date: "2024-01-08" }); }
    await doc(false, 1, { contactId: foreign.id }); await doc(false, 1, { contactId: foreign.id });
    await doc(false, 2, { contactId: deletedContact.id }); await doc(false, 2, { contactId: deletedContact.id });
    for (const options of [{ deleted: true }, { void: true }, { org: b.id, contactId: foreign.id }]) { await doc(false, 900, options); await doc(false, 900, options); }
    await doc(false, 7); await doc(false, 7, { date: "2024-01-09" }); // eight-day span excluded
    const dup = await read(duplicates); assert.equal(dup.totalGroups, 5); assert.ok(!JSON.stringify(dup).includes("secret"));
    assert.ok(dup.duplicateGroups.every((g: { amountMinor: string; items: unknown[] }) => g.amountMinor === "1250" && g.items.length === 2));
    assert.deepEqual((await ma.call("duplicate_detection")).body, dup); assert.deepEqual((await mb.call("duplicate_detection")).body, await read(duplicates, "", keys.b));
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      const events = await read(calendar, query + `&currencyCode=${currency}`); assert.ok(events.events.length >= 2);
      assert.ok(events.events.every((e: { currencyCode: string }) => e.currencyCode === currency));
      assert.deepEqual((await ma.call("financial_calendar", { ...dates, currencyCode: currency })).body, events);
    }
    const template = async (price: number, quantity = 100, options: { next?: string; max?: number; generated?: number; end?: string; org?: string; contactId?: string; frequency?: "weekly" | "monthly" } = {}) => {
      const [t] = await db.insert(recurringTemplate).values({ organizationId: options.org ?? a.id, contactId: options.contactId ?? local.id, type: "invoice",
        name: "Recurring", frequency: options.frequency ?? "weekly", startDate: "2024-01-01", nextRunDate: options.next ?? "2024-01-01", endDate: options.end,
        maxOccurrences: options.max, occurrencesGenerated: options.generated ?? 0 }).returning();
      await db.insert(recurringTemplateLine).values({ templateId: t.id, description: "Estimate", quantity, unitPrice: price }); return t.id;
    };
    const weekly = await template(1, 50); await template(-1, 50, { max: 1 }); await template(3, 100, { max: 2 });
    const month = await template(1250, 100, { next: "2024-01-31", frequency: "monthly", max: 2 });
    await template(900, 100, { org: b.id, contactId: foreign.id });
    await template(900, 100, { max: 1, generated: 1 }); await template(900, 100, { end: "2023-12-31" });
    await template(7, 100, { next: "2023-12-25", max: 2, contactId: foreign.id });
    const [account] = await db.insert(chartAccount).values({ organizationId: a.id, name: "Budget account", code: "6100", type: "expense" }).returning();
    const [bud] = await db.insert(budget).values({ organizationId: a.id, name: "Budget", startDate: "2024-01-01", endDate: "2024-12-31" }).returning();
    const [line] = await db.insert(budgetLine).values({ budgetId: bud.id, accountId: account.id }).returning();
    const [period] = await db.insert(budgetPeriod).values({ budgetLineId: line.id, startDate: "2024-01-01", endDate: "2024-01-31", label: "Jan", amount: 1250 }).returning();
    const before = await snapshot(), cal = await read(calendar, query);
    assert.equal(cal.events.filter((e: { id: string }) => e.id === weekly).length, 13);
    assert.deepEqual(cal.events.filter((e: { id: string }) => e.id === month).map((e: { date: string }) => e.date), ["2024-01-31", "2024-03-02"]);
    assert.ok(cal.events.some((e: { type: string; amountMinor: string }) => e.type === "recurring_generation" && e.amountMinor === "0"));
    assert.equal(cal.events.find((e: { type: string }) => e.type === "budget_period_start").amountMinor, "1250");
    assert.ok(!JSON.stringify(cal).includes("secret")); assert.deepEqual((await ma.call("financial_calendar", dates)).body, cal);
    assert.deepEqual((await mb.call("financial_calendar", dates)).body, await read(calendar, query, keys.b));
    await read(duplicates); await ma.call("duplicate_detection"); assert.deepEqual(await snapshot(), before);
    assert.equal((await read(calendar, query + "&currencyCode=KWD")).events.filter((e: { type: string }) => e.type === "budget_period_start").length, 0);
    // Unsafe source money, per-line products and subtotal totals reject consistently without writes.
    await db.execute(sql`update budget_period set amount=9007199254740992 where id=${period.id}`); await range(calendar, "financial_calendar", query, dates);
    await db.update(budgetPeriod).set({ amount: 1250 }).where(eq(budgetPeriod.id, period.id));
    const high = await template(Number.MAX_SAFE_INTEGER, 50, { max: 1 });
    assert.equal((await read(calendar, query)).events.find((e: { id: string }) => e.id === high).amountMinor, "4503599627370496");
    await db.update(recurringTemplateLine).set({ quantity: 101 }).where(eq(recurringTemplateLine.templateId, high)); await range(calendar, "financial_calendar", query, dates);
    await db.update(recurringTemplateLine).set({ quantity: 100 }).where(eq(recurringTemplateLine.templateId, high));
    await db.insert(recurringTemplateLine).values({ templateId: high, description: "Overflow subtotal", unitPrice: 1 }); await range(calendar, "financial_calendar", query, dates);
    await db.delete(recurringTemplate).where(eq(recurringTemplate.id, high));
    const unsafePrice = await template(1, 100, { max: 1 });
    await db.execute(sql`update recurring_template_line set unit_price=9223372036854775807 where template_id=${unsafePrice}`); await range(calendar, "financial_calendar", query, dates);
    await db.delete(recurringTemplate).where(eq(recurringTemplate.id, unsafePrice));
    const unsafe = await doc(false, 1); await db.execute(sql`update invoice set amount_due=9223372036854775807 where id=${unsafe}`); await range(calendar, "financial_calendar", query, dates);
    await db.delete(invoice).where(eq(invoice.id, unsafe));
    for (const sign of [1, -1]) {
      await db.update(budgetPeriod).set({ amount: sign * Number.MAX_SAFE_INTEGER }).where(eq(budgetPeriod.id, period.id));
      assert.equal((await read(calendar, query)).events.find((e: { type: string }) => e.type === "budget_period_start").amountMinor, String(sign * Number.MAX_SAFE_INTEGER));
    }
    await db.update(budgetPeriod).set({ amount: 1250 }).where(eq(budgetPeriod.id, period.id));
    for (const sign of [1, -1]) {
      const ids = [await doc(false, sign * Number.MAX_SAFE_INTEGER), await doc(false, sign * Number.MAX_SAFE_INTEGER)];
      assert.ok((await read(duplicates)).duplicateGroups.some((g: { amountMinor: string }) => g.amountMinor === String(sign * Number.MAX_SAFE_INTEGER)));
      for (const id of ids) await db.execute(sql`update invoice set total=${sign > 0 ? "9223372036854775807" : "-9223372036854775808"}::bigint where id=${id}`);
      await range(duplicates, "duplicate_detection"); for (const id of ids) await db.delete(invoice).where(eq(invoice.id, id));
    }
    await db.update(recurringTemplate).set({ occurrencesGenerated: -1 }).where(eq(recurringTemplate.id, weekly)); await range(calendar, "financial_calendar", query, dates);
    await db.update(recurringTemplate).set({ occurrencesGenerated: 0, nextRunDate: "0001-01-01" }).where(eq(recurringTemplate.id, weekly)); await range(calendar, "financial_calendar", query, dates);
    console.log("REST and MCP operational reports verified");
  } finally { await ma.close(); await mb.close(); await noRead.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
