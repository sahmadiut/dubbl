import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, project, timeEntry, projectMember,
  projectMilestone, bill, billLine, invoice, invoiceLine, expenseClaim, expenseItem,
  journalEntry, journalLine, chartAccount, periodLock } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";

const operations = {
  list: { name: "list_project_billable_items", path: "billable-items", method: "GET" },
  register: { name: "register_project_billable_items", path: "billable-items", method: "POST" },
  unregister: { name: "unregister_project_billable_item", path: "billable-items", method: "DELETE" },
  preview: { name: "get_project_billing_preview", path: "progress-invoice", method: "GET" },
  invoice: { name: "generate_project_invoice", path: "invoice", method: "POST" },
  progress: { name: "generate_project_progress_invoice", path: "progress-invoice", method: "POST" },
  profitability: { name: "get_project_profitability", path: "reports/profitability", method: "GET" },
};
type Op = keyof typeof operations;
async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Billing fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of [...Object.values(operations).map(o => o.name), "register_project_billable_item"]) {
    const tool = tools.find(t => t.name === name)!; assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const [key, value] of Object.entries(tool.inputSchema.properties ?? {})) assert.ok((value as { description?: string }).description, `${name}.${key}`);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Billing A", slug: "billing-a" }, { name: "Billing B", slug: "billing-b" }]).returning();
  const [u, viewer, outsider] = await db.insert(users).values([{ email: "billing@example.test", passwordHash: "PRIVATE" }, { email: "billing-viewer@example.test" }, { email: "billing-foreign@example.test" }]).returning();
  const [none] = await db.insert(customRole).values({ organizationId: a.id, name: "None", permissions: [] }).returning();
  const [m] = await db.insert(member).values([{ organizationId: a.id, userId: u.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, role: "member", customRoleId: none.id }, { organizationId: b.id, userId: outsider.id, role: "owner" }]).returning();
  const [c, fc] = await db.insert(contact).values([{ organizationId: a.id, name: "Owned" }, { organizationId: b.id, name: "Foreign" }]).returning();
  const keys = { a: "dk_billing_a", b: "dk_billing_b", viewer: "dk_billing_viewer", expired: "dk_billing_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "b" ? b.id : a.id,
    createdBy: name === "b" ? outsider.id : name === "viewer" ? viewer.id : u.id, name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_billing", expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: u.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id, userId: outsider.id }), ro = await connect({ ...ctx, role: "member", permissions: [], userId: viewer.id });
  const managed = await connect({ ...ctx, role: "member", permissions: ["manage:projects"] });
  async function rest(op: Op, args: Record<string, unknown>, key = keys.a) {
    const { path: segment, method } = operations[op], { projectId, ...body } = args, query = new URLSearchParams();
    if (method !== "POST") for (const [key, value] of Object.entries(op === "profitability" ? args : body)) query.set(key, String(value));
    if (op === "profitability") query.set("groupBy", "project");
    const file = op === "profitability" ? `app/api/v1/${segment}/route.ts` : `app/api/v1/projects/[id]/${segment}/route.ts`;
    const mod = await import(pathToFileURL(path.resolve(file)).href);
    const r: Response = await mod[method](new Request(`http://fixture.test/billing?${query}`, { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}) }), { params: Promise.resolve({ id: projectId }) });
    return { isError: !r.ok, status: r.status, body: await r.json() };
  }
  async function snapshot() {
    const names = ["project", "time_entry", "project_milestone", "project_billable_item", "invoice", "invoice_line", "number_sequence", "audit_log"];
    const r = await db.execute(sql.raw(`select jsonb_build_object(${names.map(n => `'${n}',(select jsonb_agg(to_jsonb(t) order by id) from ${n} t)`).join(",")}) as state`));
    return JSON.stringify(r.rows[0].state);
  }
  async function denied(op: Op, args: Record<string, unknown>, mode: string, status?: number, key = keys.a, client = ma) {
    const before = await snapshot(), original = console.error; console.error = () => {};
    let r;
    try { r = mode === "rest" ? await rest(op, args, key) : await client.call(operations[op].name, args); } finally { console.error = original; }
    assert.equal(r.isError, true, `${mode}/${op}: ${JSON.stringify(r)}`);
    if (status && mode === "rest") assert.equal((r as Awaited<ReturnType<typeof rest>>).status, status, JSON.stringify(r));
    assert.equal(await snapshot(), before, `${mode}/${op} mutated on failure`); return r;
  }
  async function newProject(billingType: "hourly" | "fixed" | "milestone" | "non_billable" = "hourly", currency = "USD", org = a.id, customerId = c.id) {
    const [p] = await db.insert(project).values({ organizationId: org, name: "Same name", contactId: customerId, billingType, currency, fixedPrice: 10000, hourlyRate: 9000, budget: 5000, estimatedHours: 120 }).returning(); return p;
  }
  async function newTime(pid: string, rate = 1250, minutes = 60) {
    const [t] = await db.insert(timeEntry).values({ projectId: pid, userId: u.id, date: "2024-02-29", hourlyRate: rate, minutes, isBillable: true }).returning(); return t;
  }
  let billNo = 0;
  async function newBill(pid: string, amount = 1250, currency = "USD", org = a.id, customerId = c.id) {
    const [head] = await db.insert(bill).values({ organizationId: org, contactId: customerId, billNumber: `B-${++billNo}`, issueDate: "2024-02-29", dueDate: "2024-03-30", status: "received", currencyCode: currency }).returning();
    const [line] = await db.insert(billLine).values({ billId: head.id, projectId: pid, description: "Materials", amount, unitPrice: amount }).returning(); return { head, line };
  }
  const covered = new Set<string>();
  try {
    for (const mode of ["rest", "mcp"]) {
      async function call(op: Op, args: Record<string, unknown>) {
        const r = mode === "rest" ? await rest(op, args) : await ma.call(operations[op].name, args);
        assert.equal(r.isError, false, `${mode}/${op}: ${JSON.stringify(r)}`); covered.add(`${mode}:${op}`); return r.body;
      }
      const p = await newProject(), root = { projectId: p.id }, t = await newTime(p.id), zero = await newTime(p.id, 0, 30), cost = await newBill(p.id);
      await db.insert(projectMember).values({ projectId: p.id, memberId: m.id, costRate: 600 });
      assert.equal((await call("list", root)).candidates[0].costAmountMinor, "1250");
      const registered = await call("register", { ...root, items: [{ sourceLineId: cost.line.id, costAmountMinor: "1250", costAmount: 1250, markupBasisPoints: 1000 }] });
      const itemId = registered.items[0].id; assert.equal(registered.items[0].billableAmountMinor, "1375");
      const beforeCount = (await call("list", root)).registeredCount;
      const single = await ma.call("register_project_billable_item", { ...root, sourceLineId: cost.line.id, markupBasisPoints: 1000 }); assert.equal(single.isError, false); assert.equal(single.body.id, itemId);
      assert.equal((await call("list", root)).registeredCount, beforeCount);
      const preview = await call("preview", root); assert.equal(preview.totalAmountMinor, "1250"); assert.equal(preview.timeEntries.find((r: { id: string }) => r.id === zero.id).hourlyRate, 0);
      assert.equal(JSON.stringify(preview).includes("passwordHash"), false);
      await denied("register", { ...root, items: [{ sourceLineId: cost.line.id, costAmountMinor: "9007199254740992" }] }, mode, 422);
      await denied("register", { ...root, items: [{ sourceLineId: cost.line.id, costAmount: 1, costAmountMinor: "2" }] }, mode, 400);
      await denied("register", { ...root, items: [{ sourceLineId: cost.line.id }, { sourceLineId: randomUUID() }] }, mode, 404);
      await denied("register", { ...root, items: [{ sourceLineId: cost.line.id }, { sourceLineId: cost.line.id }] }, mode, 422);
      const foreign = await newProject("hourly", "USD", b.id, fc.id), fb = await newBill(foreign.id, 1, "USD", b.id, fc.id);
      const other = await newProject(), ob = await newBill(other.id);
      for (const id of [fb.line.id, ob.line.id]) await denied("register", { ...root, items: [{ sourceLineId: id, costAmount: 1 }] }, mode, 404);
      const mismatched = await newBill(p.id, 1, "JPY"); await denied("register", { ...root, items: [{ sourceLineId: mismatched.line.id }] }, mode, 422);
      await db.delete(billLine).where(eq(billLine.id, mismatched.line.id)); await db.delete(bill).where(eq(bill.id, mismatched.head.id));
      const inputs: Record<Op, Record<string, unknown>> = { list: root, preview: root, profitability: root, register: { ...root, items: [{ sourceLineId: cost.line.id }] }, unregister: { ...root, itemId }, invoice: root, progress: { ...root, timeEntryIds: [t.id] } };
      for (const op of Object.keys(operations) as Op[]) {
        await denied(op, inputs[op], mode, 404, keys.b, mb);
        if (!["list", "preview", "profitability"].includes(op)) await denied(op, inputs[op], mode, 403, keys.viewer, ro);
      }
      await denied("list", root, "rest", 401, "dk_billing_invalid"); await denied("list", root, "rest", 401, keys.expired);
      await denied("progress", { ...root, timeEntryIds: [t.id], contactId: fc.id }, mode, 404);
      await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2024-03-01" });
      await denied("invoice", { ...root, issueDate: "2024-02-29" }, mode, 422);
      await denied("register", { ...root, items: [{ sourceLineId: cost.line.id }] }, mode, 422);
      await denied("unregister", { ...root, itemId }, mode, 422);
      await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
      await db.execute(sql.raw("create function billing_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'fixture audit fault'; end $$; create trigger billing_audit_fault before insert on audit_log for each row execute function billing_fail_audit()"));
      for (const op of ["register", "unregister", "invoice", "progress"] as const) await denied(op, { ...inputs[op], ...(op === "invoice" || op === "progress" ? { issueDate: "2024-02-29" } : {}) }, mode, 500);
      await db.execute(sql.raw("drop trigger billing_audit_fault on audit_log; drop function billing_fail_audit()"));
      await db.execute(sql.raw("create function billing_poison_invoice() returns trigger language plpgsql as $$ begin NEW.total := 9007199254740992; return NEW; end $$; create trigger billing_output_fault before insert on invoice for each row execute function billing_poison_invoice()"));
      await denied("invoice", { ...root, issueDate: "2024-02-29" }, mode, 422);
      await db.execute(sql.raw("drop trigger billing_output_fault on invoice; drop function billing_poison_invoice()"));
      const requestKey = randomUUID(), args = { ...root, issueDate: "2024-02-29", requestKey };
      const inv = (await call("invoice", args)).invoice; assert.equal(inv.totalMinor, "2625"); assert.equal(inv.currencyCode, "USD");
      const replayState = await snapshot(); assert.equal((await call("invoice", args)).invoice.id, inv.id); assert.equal(await snapshot(), replayState);
      await denied("invoice", { ...args, notes: "different" }, mode, 409);
      await denied("invoice", root, mode, 409); await denied("unregister", { ...root, itemId }, mode, 409);
      await denied("register", inputs.register, mode, 409);
      const unregCost = await newBill(p.id); const unreg = (await call("register", { ...root, items: [{ sourceLineId: unregCost.line.id }] })).items[0];
      await call("unregister", { ...root, itemId: unreg.id });
      const msProject = await newProject("milestone"), [ms] = await db.insert(projectMilestone).values({ projectId: msProject.id, title: "Milestone", amount: 1250, invoicedAmountCents: 250 }).returning();
      assert.equal((await call("preview", { projectId: msProject.id })).totalRemainingMinor, "1000");
      assert.equal((await call("progress", { projectId: msProject.id, milestoneIds: [ms.id], issueDate: "2024-02-29" })).invoice.totalMinor, "1000");
      await denied("progress", { projectId: msProject.id, milestoneIds: [ms.id] }, mode, 409);
      await denied("progress", { ...root, timeEntryIds: [zero.id] }, mode, 409);
      const fixed = await newProject("fixed"), fixedArgs = { projectId: fixed.id, percentageToInvoice: 25.5, issueDate: "2024-02-29", requestKey: randomUUID() };
      const fcost = await newBill(fixed.id, 100); await call("register", { projectId: fixed.id, items: [{ sourceLineId: fcost.line.id }] });
      assert.equal((await call("progress", { ...fixedArgs, includeBillableExpenses: true })).invoice.totalMinor, "2650");
      await db.update(project).set({ name: "Renamed" }).where(eq(project.id, fixed.id));
      assert.equal((await call("preview", { projectId: fixed.id })).totalInvoicedMinor, "2550");
      await denied("progress", { projectId: fixed.id, percentageToInvoice: 75 }, mode, 409);
      await call("progress", { projectId: fixed.id, percentageToInvoice: 74.5, issueDate: "2024-02-29" });
      assert.equal((await call("preview", { projectId: fixed.id })).remainingMinor, "0");
      const hp = await newProject(), ht = await newTime(hp.id, Number.MAX_SAFE_INTEGER, 1);
      assert.equal((await call("progress", { projectId: hp.id, timeEntryIds: [ht.id], issueDate: "2024-02-29" })).invoice.totalMinor, "150119987579017");
      const huge = await newTime(hp.id, Number.MAX_SAFE_INTEGER, 61); await denied("invoice", { projectId: hp.id }, mode, 422);
      await db.delete(timeEntry).where(eq(timeEntry.id, huge.id));
      const maxProject = await newProject(), maxCost = await newBill(maxProject.id, Number.MAX_SAFE_INTEGER);
      const maxRoot = { projectId: maxProject.id };
      await call("register", { ...maxRoot, items: [{ sourceLineId: maxCost.line.id, costAmountMinor: "9007199254740991" }] });
      assert.equal((await call("list", maxRoot)).registeredBillableTotalMinor, "9007199254740991");
      await denied("register", { ...maxRoot, items: [{ sourceLineId: maxCost.line.id, markupBasisPoints: 1 }] }, mode, 422);
      await newTime(maxProject.id, 1);
      await denied("invoice", maxRoot, mode, 422); // Individually safe lines, unsafe exact sum.
      await db.delete(timeEntry).where(eq(timeEntry.projectId, maxProject.id));
      const maxInv = (await call("invoice", { ...maxRoot, issueDate: "2024-02-29" })).invoice;
      assert.equal(maxInv.totalMinor, "9007199254740991");
      await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, maxInv.id));
      await denied("profitability", { ...maxRoot, startDate: "2024-01-01", endDate: "2024-12-31" }, mode, 422); // Scaled variance percent cannot be represented.
      const billedRows = await db.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, inv.id)); assert.ok(billedRows.every(l => l.projectId === p.id));
      await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, inv.id));
      const report = await call("profitability", { ...root, startDate: "2024-01-01", endDate: "2024-12-31" });
      assert.equal(report.totalRevenueMinor, "2625"); assert.equal(report.entries[0].laborCostMinor, "900"); assert.equal(report.entries[0].materialCostMinor, "2500"); assert.equal(report.totalProfitMinor, "-775");
      assert.deepEqual((await rest("profitability", { ...root, startDate: "2024-01-01", endDate: "2024-12-31" })).body, (await ma.call(operations.profitability.name, { ...root, startDate: "2024-01-01", endDate: "2024-12-31" })).body);
      const jpy = await newProject("fixed", "JPY"); assert.equal((await call("progress", { projectId: jpy.id, percentageToInvoice: 12.5 })).invoice.totalMinor, "1250");
      for (const currency of ["KWD", "IRR"]) {
        const currencyProject = await newProject("fixed", currency);
        const currencyInvoice = (await call("progress", { projectId: currencyProject.id, percentageToInvoice: 12.5 })).invoice;
        assert.equal(currencyInvoice.totalMinor, "1250"); assert.equal(currencyInvoice.currencyCode, currency);
      }
      await denied("profitability", {}, mode, 422); await call("profitability", { currency: "JPY" });
      await denied("progress", { ...root, percentageToInvoice: 10 }, mode, 422);
      await denied("progress", { ...root, issueDate: "2024-02-30" }, mode, 400);
      await denied("invoice", { ...root, issueDate: "9999-12-31" }, mode, 400);
      const nb = await newProject("non_billable"); assert.equal((await call("preview", { projectId: nb.id })).message, "Non-billable project");
      await denied("progress", { projectId: nb.id }, mode, 422);
      assert.equal((await managed.call(operations.register.name, { ...root, items: [{ sourceLineId: unregCost.line.id }] })).isError, false);
    }
    // Two requests racing for one source create only one allocation; keyed races replay.
    const concurrent = await newProject(); await newTime(concurrent.id); const args = { projectId: concurrent.id, issueDate: "2024-02-29", requestKey: randomUUID() };
    const race = await Promise.all([rest("invoice", args), ma.call(operations.invoice.name, args)]);
    assert.ok(race.every(r => !r.isError)); assert.equal(race[0].body.invoice.id, race[1].body.invoice.id);
    const noKey = await newProject(); await newTime(noKey.id);
    const unkeyed = await Promise.all([rest("invoice", { projectId: noKey.id }), ma.call(operations.invoice.name, { projectId: noKey.id })]);
    assert.equal(unkeyed.filter(r => !r.isError).length, 1);
    const fixed = await newProject("fixed");
    const fixedRace = await Promise.all([rest("progress", { projectId: fixed.id, percentageToInvoice: 60 }), ma.call(operations.progress.name, { projectId: fixed.id, percentageToInvoice: 60 })]);
    assert.equal(fixedRace.filter(r => !r.isError).length, 1);
    // All three source types are actually resolved and checked; manual journals include NULL sources.
    const sp = await newProject(), [ec] = await db.insert(expenseClaim).values({ organizationId: a.id, title: "Approved", status: "approved", submittedBy: u.id }).returning();
    const [ei] = await db.insert(expenseItem).values({ expenseClaimId: ec.id, date: "2024-02-29", description: "Expense", amount: 1250 }).returning();
    const [account] = await db.insert(chartAccount).values({ organizationId: a.id, code: "5000", name: "Cost", type: "expense" }).returning();
    const [je] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 1, date: "2024-02-29", description: "Manual", status: "posted", sourceType: null }).returning();
    const [jl] = await db.insert(journalLine).values({ journalEntryId: je.id, accountId: account.id, projectId: sp.id, debitAmount: 100, creditAmount: 0 }).returning();
    assert.equal((await ma.call(operations.register.name, { projectId: sp.id, items: [{ sourceType: "expense_item", sourceLineId: ei.id }, { sourceType: "journal_line", sourceLineId: jl.id }] })).isError, false);
    const expenseOnly = await newProject();
    assert.equal((await ma.call(operations.register.name, { projectId: expenseOnly.id, items: [{ sourceType: "expense_item", sourceLineId: ei.id }] })).isError, false);
    const beforeCurrency = await snapshot();
    const masterRoute = await import("../../app/api/v1/projects/[id]/route");
    const currencyResponse = await masterRoute.PATCH(new Request("http://fixture.test/project", { method: "PATCH", headers: { authorization: `Bearer ${keys.a}`, "content-type": "application/json" }, body: JSON.stringify({ currency: "JPY" }) }), { params: Promise.resolve({ id: expenseOnly.id }) });
    assert.equal(currencyResponse.status, 409);
    assert.equal((await ma.call("update_project", { projectId: expenseOnly.id, currency: "JPY" })).isError, true);
    assert.equal(await snapshot(), beforeCurrency);
    assert.equal((await rest("profitability", { projectId: sp.id, startDate: "2024-01-01", endDate: "2024-12-31" })).body.entries[0].otherCostMinor, "100");
    await db.update(journalLine).set({ debitAmount: 0, creditAmount: 100 }).where(eq(journalLine.id, jl.id));
    assert.equal((await rest("profitability", { projectId: sp.id, startDate: "2024-01-01", endDate: "2024-12-31" })).body.entries[0].otherCostMinor, "-100");
    await db.update(journalLine).set({ exchangeRate: 2000000 }).where(eq(journalLine.id, jl.id));
    await denied("profitability", { projectId: sp.id, startDate: "2024-01-01", endDate: "2024-12-31" }, "rest", 422);
    // Real source kinds reject foreign records and unsupported saved history in both transports.
    const [foreignClaim] = await db.insert(expenseClaim).values({ organizationId: b.id, title: "Foreign", status: "approved", submittedBy: outsider.id }).returning();
    const [foreignExpense] = await db.insert(expenseItem).values({ expenseClaimId: foreignClaim.id, date: "2024-02-29", description: "Foreign", amount: 1 }).returning();
    const [foreignAccount] = await db.insert(chartAccount).values({ organizationId: b.id, code: "5000", name: "Foreign", type: "expense" }).returning();
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: "2024-02-29", description: "Foreign", status: "posted" }).returning();
    const [foreignLine] = await db.insert(journalLine).values({ journalEntryId: foreignJournal.id, accountId: foreignAccount.id, projectId: sp.id, debitAmount: 1 }).returning();
    for (const mode of ["rest", "mcp"]) {
      for (const item of [{ sourceType: "expense_item", sourceLineId: foreignExpense.id }, { sourceType: "journal_line", sourceLineId: foreignLine.id }])
        await denied("register", { projectId: sp.id, items: [item] }, mode, 404);
      await denied("register", { projectId: sp.id, items: [{ sourceType: "journal_line", sourceLineId: jl.id }] }, mode, 422);
      await denied("progress", { projectId: sp.id, timeEntryIds: [randomUUID()] }, mode, 409);
      await denied("progress", { projectId: sp.id, milestoneIds: [randomUUID()] }, mode, 422);
      await denied("progress", { projectId: sp.id, billableItemIds: [randomUUID()] }, mode, 422);
    }
    // Old name-only fixed invoices fail closed rather than resetting allocation to zero.
    const legacy = await newProject("fixed");
    const [oldInvoice] = await db.insert(invoice).values({ organizationId: a.id, contactId: c.id, invoiceNumber: "OLD-99999", issueDate: "2024-02-29", dueDate: "2024-03-30", reference: `Project: ${legacy.name}` }).returning();
    await db.insert(invoiceLine).values({ invoiceId: oldInvoice.id, description: "Name-only legacy", amount: 100 });
    for (const mode of ["rest", "mcp"]) await denied("progress", { projectId: legacy.id, percentageToInvoice: 1 }, mode, 422);
    // Corrupt returned allocations must undo invoice, numbering, project total and audit.
    const poisonedProject = await newProject("milestone"), [poisonedMs] = await db.insert(projectMilestone).values({ projectId: poisonedProject.id, title: "Poison", amount: 100 }).returning();
    await db.execute(sql.raw("create function billing_poison_milestone() returns trigger language plpgsql as $$ begin NEW.invoiced_amount_cents := 9007199254740992; return NEW; end $$; create trigger billing_milestone_fault before update on project_milestone for each row execute function billing_poison_milestone()"));
    for (const mode of ["rest", "mcp"]) await denied("progress", { projectId: poisonedProject.id, milestoneIds: [poisonedMs.id] }, mode, 422);
    await db.execute(sql.raw("drop trigger billing_milestone_fault on project_milestone; drop function billing_poison_milestone()"));
    for (const mode of ["rest", "mcp"]) for (const op of Object.keys(operations)) assert.ok(covered.has(`${mode}:${op}`));
    console.log("Project billing contracts verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); await managed.close(); }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
