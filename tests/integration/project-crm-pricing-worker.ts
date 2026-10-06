import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, contact, inventoryItem, invoice, bill, billLine } from "../../lib/db/schema";
import { projectOperations } from "../../lib/api/project-master-operations";
import { registerAllTools } from "../../lib/mcp/tools";
import type { AuthContext } from "../../lib/api/auth-context";

const endpoints: Record<string, { path: string; method: string }> = {
  create_price_list: { path: "/price-lists", method: "POST" },
  update_price_list: { path: "/price-lists/[priceListId]", method: "PATCH" },
  add_price_list_item: { path: "/price-lists/[priceListId]/items", method: "POST" },
  update_price_list_item: { path: "/price-lists/[priceListId]/items/[priceListItemId]", method: "PATCH" },
  resolve_price: { path: "/price-lists/[priceListId]/resolve", method: "GET" },
  create_invoice: { path: "/invoices", method: "POST" },
  get_invoice: { path: "/invoices/[invoiceId]", method: "GET" },
  create_pipeline: { path: "/crm/pipelines", method: "POST" },
  create_deal: { path: "/crm/deals", method: "POST" },
  get_crm_analytics: { path: "/crm/analytics", method: "GET" },
  generate_project_invoice: { path: "/projects/[projectId]/invoice", method: "POST" },
  generate_project_progress_invoice: { path: "/projects/[projectId]/progress-invoice", method: "POST" },
  get_project_billing_preview: { path: "/projects/[projectId]/progress-invoice", method: "GET" },
  register_project_billable_items: { path: "/projects/[projectId]/billable-items", method: "POST" },
  get_project_profitability: { path: "/reports/profitability", method: "GET" },
};
async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined fixture", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Combined client", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Combined A", slug: "combined-a" }, { name: "Combined B", slug: "combined-b" },
  ]).returning();
  const [owner, outsider] = await db.insert(users).values([
    { email: "combined@example.test", passwordHash: "PRIVATE" }, { email: "combined-foreign@example.test" },
  ]).returning();
  const [m] = await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: outsider.id, role: "owner" },
  ]).returning();
  const [c, foreignContact] = await db.insert(contact).values([
    { organizationId: a.id, name: "Shared customer" }, { organizationId: b.id, name: "Foreign customer" },
  ]).returning();
  const [stock, foreignStock] = await db.insert(inventoryItem).values([
    { organizationId: a.id, code: "COMBINED", name: "Stock", salePrice: 77 },
    { organizationId: b.id, code: "COMBINED", name: "Foreign stock", salePrice: 1 },
  ]).returning();
  const keys = { a: "dk_combined_a", b: "dk_combined_b" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({
    organizationId: name === "a" ? a.id : b.id, createdBy: name === "a" ? owner.id : outsider.id,
    name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_combined",
  });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id, userId: outsider.id });
  async function rest(name: string, args: Record<string, unknown>, key = keys.a) {
    const master = projectOperations.find(o => o.name === name);
    const op = master ? { ...master, path: `/projects${master.path}` } : endpoints[name];
    assert.ok(op, name);
    const params: Record<string, string> = {}, body = { ...args }, query = new URLSearchParams();
    for (const match of op.path.matchAll(/\[([^\]]+)\]/g)) {
      const field = match[1] === "id" ? "projectId" : match[1];
      params[match[1]] = String(body[field]); delete body[field];
    }
    // Public price-list/invoice handlers retain their historical path parameter names.
    if (params.priceListId) { params.id = params.priceListId; delete params.priceListId; }
    if (params.priceListItemId) { params.itemId = params.priceListItemId; delete params.priceListItemId; }
    if (params.invoiceId) { params.id = params.invoiceId; delete params.invoiceId; }
    if (params.projectId) { params.id = params.projectId; delete params.projectId; }
    if (name === "get_project_profitability") query.set("groupBy", "project");
    if (op.method === "GET") for (const [key, value] of Object.entries(body)) query.set(key, String(value));
    const routePath = op.path.replace("[priceListId]", "[id]").replace("[priceListItemId]", "[itemId]")
      .replace("[invoiceId]", "[id]").replace("[projectId]", "[id]");
    const mod = await import(pathToFileURL(path.resolve(`app/api/v1${routePath}/route.ts`)).href);
    const response: Response = await mod[op.method](new Request(`http://fixture.test/combined?${query}`, {
      method: op.method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
      ...(["POST", "PATCH"].includes(op.method) ? { body: JSON.stringify(body) } : {}),
    }), { params: Promise.resolve(params) });
    return { isError: !response.ok, status: response.status, body: await response.json() };
  }
  type Mode = "rest" | "mcp";
  async function raw(mode: Mode, name: string, args: Record<string, unknown>, foreign = false) {
    return mode === "rest" ? rest(name, args, foreign ? keys.b : keys.a) : (foreign ? mb : ma).call(name, args);
  }
  async function call(mode: Mode, name: string, args: Record<string, unknown>) {
    const r = await raw(mode, name, args); assert.equal(r.isError, false, `${mode}/${name}: ${JSON.stringify(r)}`); return r.body;
  }
  async function snapshot() {
    const names = ["project", "project_member", "time_entry", "project_milestone", "project_billable_item", "invoice", "invoice_line", "number_sequence", "price_list", "price_list_item", "pipeline", "deal", "audit_log"];
    const result = await db.execute(sql.raw(`select jsonb_build_object(${names.map(n => `'${n}',(select jsonb_agg(to_jsonb(t) order by id) from ${n} t)`).join(",")}) as state`));
    return JSON.stringify(result.rows[0].state);
  }
  async function denied(mode: Mode, name: string, args: Record<string, unknown>, foreign = false, expectedStatus?: number) {
    const before = await snapshot(), r = await raw(mode, name, args, foreign);
    assert.equal(r.isError, true, `${mode}/${name}: ${JSON.stringify(r)}`);
    if (expectedStatus !== undefined) assert.equal("status" in r ? r.status : r.body.status, expectedStatus);
    assert.equal(await snapshot(), before, `${name} changed combined state on failure`);
    return r.body;
  }
  try {
    for (const mode of ["rest", "mcp"] as const) {
      const other: Mode = mode === "rest" ? "mcp" : "rest";
      const p = (await call(mode, "create_project", { name: mode, contactId: c.id, hourlyRateMinor: "1250", budget: 10000, currency: "USD" })).project;
      const root = { projectId: p.id };
      await call(other, "add_project_member", { ...root, memberId: m.id, hourlyRate: 1500, costRateMinor: "600" });
      const first = (await call(mode, "create_project_time_entry", { ...root, minutes: 30, date: "2024-02-29" })).timeEntry;
      await call(other, "update_project_member", { ...root, memberId: m.id, hourlyRateMinor: "2000" });
      await call(mode, "update_project", { ...root, hourlyRate: 9999 });
      const second = (await call(other, "create_project_time_entry", { ...root, minutes: 15, date: "2024-02-29" })).timeEntry;
      const zero = (await call(mode, "create_project_time_entry", { ...root, minutes: 15, date: "2024-02-29", hourlyRateMinor: "0" })).timeEntry;
      assert.equal(first.hourlyRateMinor, "1500"); assert.equal(second.hourlyRateMinor, "2000"); assert.equal(zero.hourlyRateMinor, "0");
      assert.equal((await call(other, "get_project_billing_preview", root)).totalAmountMinor, "1250");
      const args = { ...root, issueDate: "2024-02-29", requestKey: randomUUID() };
      const billed = (await call(mode, "generate_project_invoice", args)).invoice;
      assert.equal(billed.totalMinor, "1250"); assert.equal(billed.total, 1250);
      const state = await snapshot();
      assert.equal((await call(other, "generate_project_invoice", args)).invoice.id, billed.id);
      assert.equal(await snapshot(), state);
      for (const transport of [mode, other]) {
        await denied(transport, "update_project", { ...root, currency: "JPY" });
        await denied(transport, "update_project_time_entry", { ...root, entryId: first.id, hourlyRate: 1 });
        await denied(transport, "delete_project_time_entry", { ...root, entryId: second.id });
        await denied(transport, "get_project", root, true);
      }
      const saved = (await call(other, "get_project", root)).project;
      assert.equal(saved.totalHours, 60); assert.equal(saved.totalBilledMinor, "1250");
      assert.equal(saved.timeEntries.length, 3); assert.ok(saved.timeEntries.every((t: { invoiceId: string }) => t.invoiceId === billed.id));
      assert.equal(JSON.stringify(saved).includes("passwordHash"), false);
      await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, billed.id));
      const report = await call(other, "get_project_profitability", { ...root, startDate: "2024-01-01", endDate: "2024-12-31" });
      assert.equal(report.totalRevenueMinor, "1250"); assert.equal(report.totalCostsMinor, "600"); assert.equal(report.totalProfitMinor, "650");

      const list = (await call(mode, "create_price_list", { name: `${mode} book`, currencyCode: "USD" })).priceList;
      const tier = (await call(other, "add_price_list_item", { priceListId: list.id, inventoryItemId: stock.id, unitPriceMinor: "1250" })).priceListItem;
      await call(mode, "add_price_list_item", { priceListId: list.id, inventoryItemId: stock.id, unitPrice: 1000, minQuantity: 10 });
      const resolved = (await call(other, "resolve_price", { priceListId: list.id, inventoryItemId: stock.id, quantity: 10, asOf: "2024-02-29" })).resolved;
      assert.equal(resolved.unitPriceMinor, "1000");
      const invoiceArgs = { contactId: c.id, currencyCode: "USD", issueDate: "2024-02-29", priceListId: list.id,
        lines: [{ description: "Tiered", inventoryItemId: stock.id, projectId: p.id, quantity: 10 }] };
      const priced = (await call(mode, "create_invoice", invoiceArgs)).invoice;
      assert.equal(priced.totalMinor, "10000");
      await call(other, "update_price_list", { priceListId: list.id, currencyCode: "JPY" });
      await denied(mode, "create_invoice", invoiceArgs);
      const historical = (await call(other, "get_invoice", { invoiceId: priced.id })).invoice;
      assert.equal(historical.currencyCode, "USD"); assert.equal(historical.totalMinor, "10000");
      assert.equal(historical.lines[0].unitPriceMinor, "1000");
      await call(mode, "update_price_list", { priceListId: list.id, currencyCode: "USD" });
      await denied(other, "add_price_list_item", { priceListId: list.id, inventoryItemId: foreignStock.id, unitPrice: 1 });
      await denied(mode, "create_project", { name: "Foreign contact", contactId: foreignContact.id });

      const pipeline = (await call(other, "create_pipeline", { name: mode, stages: [{ id: "new", name: "New", color: "#123456" }] })).pipeline;
      const deal = (await call(mode, "create_deal", { title: mode, pipelineId: pipeline.id, stageId: "new", contactId: c.id, valueCentsMinor: billed.totalMinor, currency: "USD", probability: 50 })).deal;
      assert.equal(deal.valueCents, billed.total); // Explicit client value transfer, no automatic CRM accounting.
      await call(other, "create_deal", { title: `${mode} JPY`, pipelineId: pipeline.id, stageId: "new", valueCents: 1250, currency: "JPY" });
      await denied(mode, "get_crm_analytics", {});
      const analytics = await call(other, "get_crm_analytics", { currency: "JPY" });
      assert.equal(analytics.currency, "JPY");
      await denied(other, "create_deal", { title: "Bad alias", pipelineId: pipeline.id, stageId: "new", valueCents: 1, valueCentsMinor: "2" });
      await denied(mode, "create_deal", { title: "Unsafe", pipelineId: pipeline.id, stageId: "new", valueCentsMinor: "9007199254740992" });

      // Organization-first locking must serialize different child writers, not merely each operation's own races.
      const race = (await call(mode, "create_project", { name: "Time race", contactId: c.id, hourlyRate: 1250 })).project;
      const raceRoot = { projectId: race.id };
      const entry = (await call(other, "create_project_time_entry", { ...raceRoot, date: "2024-02-29", minutes: 60 })).timeEntry;
      await db.execute(sql.raw("create function combined_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'combined fixture audit fault'; end $$; create trigger combined_audit_fault before insert on audit_log for each row execute function combined_fail_audit()"));
      const originalError = console.error;
      try {
        console.error = () => {};
        await denied(other, "generate_project_invoice", { ...raceRoot, issueDate: "2024-02-29" });
      } finally { console.error = originalError; }
      await db.execute(sql.raw("drop trigger combined_audit_fault on audit_log; drop function combined_fail_audit()"));
      const [edit, generation] = await Promise.all([
        raw(mode, "update_project_time_entry", { ...raceRoot, entryId: entry.id, hourlyRateMinor: "2000" }),
        raw(other, "generate_project_invoice", { ...raceRoot, issueDate: "2024-02-29" }),
      ]);
      assert.equal(generation.isError, false);
      assert.equal(generation.body.invoice.totalMinor, edit.isError ? "1250" : "2000");
      assert.equal((await call(mode, "get_project", raceRoot)).project.totalBilledMinor, generation.body.invoice.totalMinor);
      const [priceEdit, priceGeneration] = await Promise.all([
        raw(other, "update_price_list_item", { priceListId: list.id, priceListItemId: tier.id, unitPriceMinor: "2500" }),
        raw(mode, "create_invoice", { ...invoiceArgs, lines: [{ description: "Racing price", inventoryItemId: stock.id, quantity: 1 }] }),
      ]);
      assert.equal(priceEdit.isError, false); assert.equal(priceGeneration.isError, false);
      assert.ok(["1250", "2500"].includes(priceGeneration.body.invoice.totalMinor));
      const invoiceRead = (await call(other, "get_invoice", { invoiceId: priceGeneration.body.invoice.id })).invoice;
      assert.equal(invoiceRead.lines[0].amountMinor, invoiceRead.totalMinor);

      const milestoneProject = (await call(mode, "create_project", { name: "Milestones", contactId: c.id, billingType: "milestone" })).project;
      const milestoneRoot = { projectId: milestoneProject.id };
      const milestone = (await call(other, "create_project_milestone", { ...milestoneRoot, title: "Delivery", amountMinor: "1250" })).milestone;
      assert.equal((await call(mode, "generate_project_progress_invoice", { ...milestoneRoot, milestoneIds: [milestone.id], issueDate: "2024-02-29" })).invoice.totalMinor, "1250");
      await denied(other, "update_project_milestone", { ...milestoneRoot, milestoneId: milestone.id, amount: 1249 });
      await denied(mode, "delete_project_milestone", { ...milestoneRoot, milestoneId: milestone.id });
      assert.equal((await call(other, "get_project_billing_preview", milestoneRoot)).totalRemainingMinor, "0");

      const fixed = (await call(mode, "create_project", { name: "Fixed race", contactId: c.id, billingType: "fixed", fixedPrice: 10000 })).project;
      const fixedRoot = { projectId: fixed.id };
      await call(other, "generate_project_progress_invoice", { ...fixedRoot, percentageToInvoice: 50, issueDate: "2024-02-29" });
      const [reduction, allocation] = await Promise.all([
        raw(mode, "update_project", { ...fixedRoot, fixedPriceMinor: "5000" }),
        raw(other, "generate_project_progress_invoice", { ...fixedRoot, percentageToInvoice: 50, issueDate: "2024-02-29" }),
      ]);
      assert.equal(Number(reduction.isError) + Number(allocation.isError), 1);
      const fixedPreview = await call(mode, "get_project_billing_preview", fixedRoot);
      assert.equal(fixedPreview.remainingMinor, "0");
      assert.equal(fixedPreview.fixedPriceMinor, fixedPreview.totalInvoicedMinor);

      const withExpenses = (await call(mode, "create_project", { name: "Fixed plus expenses", contactId: c.id, billingType: "fixed", fixedPrice: 10000 })).project;
      const expenseRoot = { projectId: withExpenses.id };
      const [head] = await db.insert(bill).values({ organizationId: a.id, contactId: c.id, billNumber: `B-${mode}`, issueDate: "2024-02-29", dueDate: "2024-03-30", status: "received" }).returning();
      const [cost] = await db.insert(billLine).values({ billId: head.id, projectId: withExpenses.id, description: "Materials", amount: 2000, unitPrice: 2000 }).returning();
      await call(other, "register_project_billable_items", { ...expenseRoot, items: [{ sourceLineId: cost.id }] });
      assert.equal((await call(mode, "generate_project_progress_invoice", { ...expenseRoot, percentageToInvoice: 25, includeBillableExpenses: true, issueDate: "2024-02-29" })).invoice.totalMinor, "4500");
      await call(other, "update_project", { ...expenseRoot, fixedPriceMinor: "2500" }); // Recharged costs are outside the fixed allocation.
      assert.equal((await call(mode, "get_project_billing_preview", expenseRoot)).remainingMinor, "0");
      await denied(mode, "update_project", { ...expenseRoot, fixedPrice: 2499 }, false, 409);
    }
    const jpy = (await call("rest", "create_project", { name: "JPY fixed", contactId: c.id, billingType: "fixed", currency: "JPY", fixedPriceMinor: "10000" })).project;
    assert.equal((await call("mcp", "generate_project_progress_invoice", { projectId: jpy.id, percentageToInvoice: 12.5, issueDate: "2024-02-29" })).invoice.totalMinor, "1250");
    for (const mode of ["rest", "mcp"] as const) await denied(mode, "update_project", { projectId: jpy.id, fixedPriceMinor: "1249" }, false, 409);
    await call("rest", "update_project", { projectId: jpy.id, fixedPriceMinor: "1250" });
    assert.equal((await call("mcp", "get_project_billing_preview", { projectId: jpy.id })).remainingMinor, "0");
    await denied("rest", "get_project_profitability", {});
    assert.equal((await call("mcp", "get_project_profitability", { currency: "JPY" })).currency, "JPY");
    console.log("Combined project CRM pricing contracts verified");
  } finally { await ma.close(); await mb.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
