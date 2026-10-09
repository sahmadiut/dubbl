import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, contact, invoice, invoiceLine, bill,
  expenseClaim, journalEntry, journalLine, consolidationEliminationEntry, fiscalYear, periodLock } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { POST as createAccrual } from "../../app/api/v1/accrual-schedules/route";
import { DELETE as cancelAccrual } from "../../app/api/v1/accrual-schedules/[id]/route";
import { POST as postAccrual } from "../../app/api/v1/accrual-schedules/[id]/post/route";
import { POST as createRevenue } from "../../app/api/v1/revenue-schedules/route";
import { POST as recognize } from "../../app/api/v1/revenue-schedules/[id]/recognize/route";
import { POST as createRecurring } from "../../app/api/v1/recurring/route";
import { POST as createGroup } from "../../app/api/v1/consolidation/groups/route";
import { POST as addMember } from "../../app/api/v1/consolidation/groups/[id]/members/route";
import { GET as report, POST as recalculate } from "../../app/api/v1/consolidation/groups/[id]/report/route";
import { PATCH as settings } from "../../app/api/v1/organization/route";
import { processRecurringPayableTemplate } from "../../lib/api/recurring-payable";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Auxiliary integration", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["create_accrual_schedule", "post_accrual_entry", "create_revenue_schedule", "recognize_revenue_entry",
    "create_recurring_template", "get_consolidation_report", "recalculate_consolidation_report", "set_organization_currency"]) {
    const tool = tools.find(t => t.name === name); assert.ok(tool, name); assert.equal(tool.inputSchema.additionalProperties, false, name);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [owner] = await db.insert(users).values({ email: "auxiliary@example.test" }).returning();
  let sequence = 0;
  const clients: Awaited<ReturnType<typeof connect>>[] = [];
  async function tenant() {
    const n = ++sequence;
    const [org] = await db.insert(organization).values({ name: `Auxiliary ${n}`, slug: `auxiliary-${n}` }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    const key = `dk_auxiliary_${n}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_auxiliary",
      keyHash: createHash("sha256").update(key).digest("hex") });
    const ctx: AuthContext = { organizationId: org.id, userId: owner.id, role: "owner" };
    const mcp = await connect(ctx); clients.push(mcp);
    const req = (body: unknown = {}, query = "") => new Request(`http://fixture.test${query}`, { method: "POST", headers: {
      authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": "00000000-0000-4000-8000-000000000099",
    }, body: JSON.stringify(body) });
    return { org, ctx, mcp, req };
  }
  type Tenant = Awaited<ReturnType<typeof tenant>>;
  const p = (id: string) => ({ params: Promise.resolve({ id }) });
  async function data(response: Response, status = 200) {
    const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
  }
  async function md(t: Tenant, name: string, args: Record<string, unknown>) {
    const result = await t.mcp.call(name, args); assert.equal(result.isError, false, JSON.stringify(result)); return result.body;
  }
  async function snapshot() {
    const tables = ["organization", "accrual_schedule", "accrual_entry", "revenue_schedule", "revenue_entry", "recurring_template",
      "recurring_template_line", "invoice", "invoice_line", "bill", "bill_line", "expense_claim", "expense_item", "number_sequence",
      "journal_entry", "journal_line", "consolidation_group", "consolidation_group_member", "consolidation_elimination_rule",
      "consolidation_elimination_entry", "audit_log"];
    const result = await db.execute(sql.raw("select jsonb_build_object(" + tables.map(t =>
      `'${t}',(select jsonb_agg(to_jsonb(t) order by id) from ${t} t)`).join(",") + ") as state"));
    return JSON.stringify(result.rows[0].state);
  }
  async function unchanged(fn: () => Promise<unknown>) { const before = await snapshot(); await fn(); assert.equal(await snapshot(), before); }
  async function denied(fn: () => Promise<Response>, status: number) { await unchanged(async () => data(await fn(), status)); }
  async function mdenied(t: Tenant, name: string, args: Record<string, unknown>, status?: number) {
    await unchanged(async () => { const r = await t.mcp.call(name, args); assert.equal(r.isError, true, JSON.stringify(r));
      if (status !== undefined) assert.equal(r.body.status, status, JSON.stringify(r)); });
  }
  async function accounts(t: Tenant, currencyCode = "USD") {
    const [prepaid, cost, deferred, sales] = await db.insert(chartAccount).values([
      { organizationId: t.org.id, currencyCode, code: "1500", name: "Prepaid", type: "asset" as const },
      { organizationId: t.org.id, currencyCode, code: "5900", name: "Cost", type: "expense" as const },
      { organizationId: t.org.id, currencyCode, code: "2300", name: "Deferred", type: "liability" as const },
      { organizationId: t.org.id, currencyCode, code: "4000", name: "Sales", type: "revenue" as const },
    ]).returning(); return { prepaid, cost, deferred, sales };
  }
  const window = { startDate: "2024-01-01", endDate: "2024-03-31" };
  const query = "?" + new URLSearchParams(window);
  const accrualBase = (a: Awaited<ReturnType<typeof accounts>>) => ({ description: "Prepaid allocation", ...window, periods: 3,
    accountId: a.prepaid.id, reverseAccountId: a.cost.id });
  try {
    // Currency changes cannot reinterpret even unposted/cancelled implicit-currency history.
    const protectedOrg = await tenant(), protectedAccounts = await accounts(protectedOrg);
    const unposted = (await data(await createAccrual(protectedOrg.req({ ...accrualBase(protectedAccounts), totalAmount: 12.5 })), 201)).schedule;
    assert.equal(unposted.totalAmountMinor, "1250");
    await denied(() => settings(protectedOrg.req({ defaultCurrency: "EUR" })), 409);
    await mdenied(protectedOrg, "set_organization_currency", { currencyCode: "EUR" }, 409);
    await data(await cancelAccrual(protectedOrg.req(), p(unposted.id)));
    await denied(() => settings(protectedOrg.req({ defaultCurrency: "EUR" })), 409);
    await mdenied(protectedOrg, "update_organization", { defaultCurrency: "EUR" }, 409);
    const empty = await tenant(); await md(empty, "set_organization_currency", { currencyCode: "EUR" });
    await data(await settings(empty.req({ defaultCurrency: "USD" })));
    const racing = await tenant(), ra = await accounts(racing);
    const race = await Promise.all([createAccrual(racing.req({ ...accrualBase(ra), totalAmountMinor: "1250" })),
      racing.mcp.call("set_organization_currency", { currencyCode: "EUR" })]);
    // Either creation freezes USD or EUR wins and USD accounts reject; never both.
    assert.ok((race[0].status === 201 && race[1].isError && race[1].body.status === 409) ||
      (race[0].status === 422 && !race[1].isError));

    const parent = await tenant(), child = await tenant(), outsider = await tenant(), ca = await accounts(child);
    const reader = await connect({ ...child.ctx, permissions: [] }); clients.push(reader);
    const group = (await data(await createGroup(parent.req({ name: "Integrated worksheet", presentationCurrency: "USD" })), 201)).group;
    await data(await addMember(parent.req({ orgId: child.org.id }), p(group.id)), 201);
    const args = { groupId: group.id, ...window };
    const [supplier] = await db.insert(contact).values({ organizationId: child.org.id, name: "Supplier", paymentTermsDays: 0 }).returning();
    const [source] = await db.insert(invoice).values({ organizationId: child.org.id, contactId: supplier.id, invoiceNumber: "SOURCE",
      issueDate: window.startDate, dueDate: window.endDate, currencyCode: "USD", status: "sent", total: 2501, amountDue: 2501 }).returning();
    const [line] = await db.insert(invoiceLine).values({ invoiceId: source.id, description: "Service", accountId: ca.sales.id }).returning();
    const accrual = (await data(await createAccrual(child.req({ ...accrualBase(ca), totalAmountExact: "12.50", idempotencyKey: "accrual" })), 201)).schedule;
    const revInput = { invoiceId: source.id, invoiceLineId: line.id, ...window, idempotencyKey: "revenue" };
    const revenue = (await md(child, "create_revenue_schedule", { ...revInput, totalAmount: 2501, totalAmountMinor: "2501" })).revenueSchedule;
    await unchanged(async () => {
      for (const [name, args] of [["post_accrual_entry", { scheduleId: accrual.id }],
        ["recognize_revenue_entry", { scheduleId: revenue.id }]] as const) {
        const denied = await reader.call(name, args); assert.equal(denied.isError, true); assert.equal(denied.body.status, 403);
      }
    });
    await unchanged(async () => {
      assert.deepEqual((await md(child, "create_accrual_schedule", { ...accrualBase(ca), totalAmount: 1250, idempotencyKey: "accrual" })).accrualSchedule, accrual);
      assert.deepEqual((await data(await createRevenue(child.req({ ...revInput, totalAmountExact: "25.01" })), 201)).schedule, revenue);
    });
    const recurringBase = { contactId: supplier.id, frequency: "monthly", startDate: window.startDate, maxOccurrences: 3,
      currencyCode: "USD", lines: [{ description: "Service", accountId: ca.cost.id, unitPriceMinor: "1250", quantity: 1 }] };
    const recurringBill = (await data(await createRecurring(child.req({ ...recurringBase, type: "bill", name: "Bills", reference: "aux-bills" })), 201)).template;
    const recurringExpense = (await md(child, "create_recurring_template", { ...recurringBase, type: "expense", name: "Claims",
      lines: [{ description: "Service", accountId: ca.cost.id, unitPrice: 12.5 }] })).template;
    const preview = await md(child, "preview_recurring_payable", { templateId: recurringBill.id, count: 3 });
    assert.equal(preview.template.lineTotalMinor, "1250"); assert.equal(preview.upcoming.length, 3);
    const beforePosting = await data(await report(parent.req({}, query), p(group.id)));
    assert.equal(beforePosting.consolidatedPnL.netIncomeMinor, "0");
    const generators = await Promise.all([processRecurringPayableTemplate(child.org.id, recurringBill.id, window.endDate),
      processRecurringPayableTemplate(child.org.id, recurringBill.id, window.endDate)]);
    assert.deepEqual(generators.sort(), [0, 3]);
    assert.equal(await processRecurringPayableTemplate(child.org.id, recurringExpense.id, window.endDate), 3);
    assert.equal((await db.select().from(bill).where(eq(bill.organizationId, child.org.id))).length, 3);
    const claims = await db.select().from(expenseClaim).where(eq(expenseClaim.organizationId, child.org.id));
    assert.equal(claims.length, 3); assert.ok(claims.every(c => c.totalAmount === 1250 && c.status === "draft"));
    assert.equal((await data(await report(parent.req({}, query), p(group.id)))).consolidatedPnL.netIncomeMinor, "0");
    // Two domains allocate residuals and compete for the same journal numbering.
    for (let i = 0; i < 3; i++) {
      const [acc, rev] = await Promise.all([
        postAccrual(child.req({ entryId: accrual.entries[i].id, idempotencyKey: `acc-${i}` }), p(accrual.id)).then(r => data(r)),
        md(child, "recognize_revenue_entry", { scheduleId: revenue.id, entryId: revenue.entries[i].id, idempotencyKey: `rev-${i}` }),
      ]);
      assert.equal(acc.entry.amountMinor, ["416", "416", "418"][i]);
      assert.equal(rev.revenueEntry.amountMinor, ["833", "833", "835"][i]);
    }
    await unchanged(async () => {
      await md(child, "post_accrual_entry", { scheduleId: accrual.id, entryId: accrual.entries[0].id, idempotencyKey: "acc-0" });
      await data(await recognize(child.req({ entryId: revenue.entries[0].id, idempotencyKey: "rev-0" }), p(revenue.id)));
      assert.equal(await processRecurringPayableTemplate(child.org.id, recurringExpense.id, window.endDate), 0);
    });
    const journals = await db.select().from(journalEntry).where(eq(journalEntry.organizationId, child.org.id));
    assert.equal(journals.length, 6); assert.equal(new Set(journals.map(j => j.entryNumber)).size, 6);
    for (const j of journals) {
      const legs = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, j.id));
      assert.equal(legs.length, 2); assert.equal(legs.reduce((s, l) => s + BigInt(l.debitAmount) - BigInt(l.creditAmount), 0n), 0n);
      assert.ok(legs.every(l => l.currencyCode === "USD" && l.rateExact === "1"));
    }
    const posted = await data(await report(parent.req({}, query), p(group.id)));
    assert.deepEqual(posted, await md(parent, "get_consolidation_report", args));
    assert.equal(posted.consolidatedPnL.totalRevenueMinor, "2501"); assert.equal(posted.consolidatedPnL.totalExpensesMinor, "1250");
    assert.equal(posted.consolidatedPnL.netIncome, 1251); assert.equal(posted.consolidatedBalanceSheet.balanceCheckMinor, "0");
    const rule = (await md(parent, "create_consolidation_elimination_rule", { groupId: group.id, name: "Technical prefix fixture",
      kind: "custom", debitAccountMatch: "5900", creditAccountMatch: "4000" })).rule;
    const eliminated = await data(await recalculate(parent.req({}, query), p(group.id)));
    assert.equal(eliminated.elimination.totalEliminatedMinor, "1250"); assert.equal(eliminated.elimination.totalVarianceMinor, "1251");
    assert.equal(eliminated.consolidatedPnL.totalRevenueMinor, "1251"); assert.equal(eliminated.consolidatedPnL.totalExpensesMinor, "0");
    assert.deepEqual((await db.select().from(consolidationEliminationEntry).where(eq(consolidationEliminationEntry.groupId, group.id)))
      .map(e => [e.ruleId, e.amount, e.varianceAmount, e.currencyCode]), [[rule.id, 1250, 1251, "USD"]]);
    await mdenied(parent, "update_consolidation_group", { groupId: group.id, presentationCurrency: "EUR" }, 409);
    // Cross-domain audit failures roll back earlier financial writes and saved replacement deletion.
    await db.execute(sql.raw("create function aux_fault() returns trigger language plpgsql as $$ begin raise exception 'aux fixture audit fault'; end $$"));
    await db.execute(sql.raw("create trigger aux_fault before insert on audit_log for each row execute function aux_fault()"));
    try {
      await denied(() => recalculate(parent.req({}, query), p(group.id)), 500);
      await mdenied(parent, "recalculate_consolidation_report", args);
      await denied(() => createAccrual(child.req({ ...accrualBase(ca), totalAmountMinor: "100" })), 500);
      await mdenied(child, "create_revenue_schedule", { invoiceId: source.id, ...window, totalAmountMinor: "100" });
    } finally { await db.execute(sql.raw("drop trigger aux_fault on audit_log; drop function aux_fault()")); }
    await mdenied(outsider, "get_consolidation_report", args, 404);
    await denied(() => recognize(outsider.req(), p(revenue.id)), 404);
    await mdenied(outsider, "post_accrual_entry", { scheduleId: accrual.id }, 404);
    await mdenied(child, "create_accrual_schedule", { ...accrualBase(ca), totalAmountMinor: "9007199254740992" }, 422);
    await denied(() => createRevenue(child.req({ ...revInput, totalAmount: 1, totalAmountMinor: "2" })), 400);
    await mdenied(parent, "get_consolidation_report", { ...args, unknown: true });

    // A lock/year insert already in flight must become visible before the report snapshot.
    const lockPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    try {
      for (const table of ["period_lock", "fiscal_year"] as const) {
        const writer = await lockPool.connect();
        let pending: Promise<Response> | undefined;
        try {
          await writer.query("begin");
          if (table === "period_lock") await writer.query("insert into period_lock (organization_id,lock_date) values ($1,$2)", [parent.org.id, window.endDate]);
          else await writer.query("insert into fiscal_year (organization_id,name,start_date,end_date,is_closed) values ($1,'Closed',$2,$3,true)", [parent.org.id, window.startDate, window.endDate]);
          const before = await snapshot();
          pending = recalculate(parent.req({}, query), p(group.id));
          let waiting = false;
          const deadline = Date.now() + 10000;
          while (Date.now() < deadline) {
            const r = await lockPool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'lock table period_lock, fiscal_year%' limit 1");
            if (r.rowCount) { waiting = true; break; } await delay(25);
          }
          assert.equal(waiting, true, `Report must wait for ${table} insertion before its first snapshot`);
          await writer.query("commit");
          await data(await pending, 422); assert.equal(await snapshot(), before);
          await mdenied(parent, "recalculate_consolidation_report", args, 422);
        } finally { await writer.query("rollback"); writer.release(); await pending; }
        if (table === "period_lock") await db.delete(periodLock).where(eq(periodLock.organizationId, parent.org.id));
        else await db.delete(fiscalYear).where(eq(fiscalYear.organizationId, parent.org.id));
      }
    } finally { await lockPool.end(); }
    // Rule deletion/recalculation cleans saved entries without changing member journals.
    await md(parent, "delete_consolidation_elimination_rule", { groupId: group.id, ruleId: rule.id });
    await md(parent, "recalculate_consolidation_report", args);
    assert.equal((await db.select().from(consolidationEliminationEntry).where(eq(consolidationEliminationEntry.groupId, group.id))).length, 0);
    assert.equal((await db.select().from(journalEntry).where(and(eq(journalEntry.organizationId, child.org.id), eq(journalEntry.status, "posted")))).length, 6);
    console.log("Combined consolidation auxiliary contracts verified: exact postings/reporting, recurring drafts, currency/period races, replays, scope and atomic faults");
  } finally { for (const client of clients) await client.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => process.exit(process.exitCode ?? 0));
