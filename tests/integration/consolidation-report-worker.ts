import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, consolidationGroup, consolidationGroupMember,
  consolidationRate, consolidationEliminationRule, consolidationEliminationEntry, chartAccount, journalEntry, journalLine,
  contact, invoice, bill, exchangeRate, periodLock, fiscalYear } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { GET, POST } from "../../app/api/v1/consolidation/groups/[id]/report/route";
import { PATCH } from "../../app/api/v1/consolidation/groups/[id]/route";
import { registerAllTools } from "../../lib/mcp/tools";
import { translateConsolidationCents } from "../../lib/api/consolidation-translate";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Report fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  for (const name of ["get_consolidation_report", "recalculate_consolidation_report"]) {
    const tool = (await client.listTools()).tools.find(t => t.name === name); assert.ok(tool);
    assert.equal(tool.inputSchema.additionalProperties, false);
    for (const f of Object.values(tool.inputSchema.properties ?? {})) assert.ok((f as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const r = await client.callTool({ name, arguments: args }), text = (r.content as { text: string }[])[0].text;
    return { isError: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b, c, d] = await db.insert(organization).values([
    { name: "Parent", slug: "report-parent" }, { name: "JPY child", slug: "report-jpy", defaultCurrency: "JPY" },
    { name: "Outsider", slug: "report-outsider" }, { name: "USD child", slug: "report-usd" },
  ]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "report-owner@example.test" }, { email: "report-viewer@example.test" }]).returning();
  const [none] = await db.insert(customRole).values({ organizationId: a.id, name: "None", permissions: [] }).returning();
  await db.insert(member).values([a, b, d].map(o => ({ organizationId: o.id, userId: owner.id, role: "owner" as const })));
  await db.insert(member).values({ organizationId: a.id, userId: viewer.id, role: "member", customRoleId: none.id });
  const keys = { owner: "dk_report_owner", viewer: "dk_report_viewer", expired: "dk_report_expired" };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: a.id,
    createdBy: name === "viewer" ? viewer.id : owner.id, name, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_report", expiresAt: name === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const mc = await connect(ctx), ro = await connect({ ...ctx, role: "member", permissions: [] });
  const managed = await connect({ ...ctx, role: "member", permissions: ["manage:reports"] });
  const [g, foreign, empty] = await db.insert(consolidationGroup).values([
    { parentOrgId: a.id, name: "Worksheet", presentationCurrency: "USD" },
    { parentOrgId: c.id, name: "Foreign", presentationCurrency: "USD" }, { parentOrgId: a.id, name: "Empty", presentationCurrency: "USD" },
  ]).returning();
  await db.insert(consolidationGroupMember).values([{ groupId: g.id, orgId: b.id }, { groupId: g.id, orgId: d.id }]);
  const dates = { startDate: "2024-01-01", endDate: "2024-01-31" }, args = { groupId: g.id, ...dates };
  const req = (window: Record<string, unknown> = dates, key = keys.owner) => new Request(`http://fixture.test/report?${new URLSearchParams(Object.entries(window).map(([k, v]) => [k, String(v)]))}`, {
    method: "POST", headers: { authorization: `Bearer ${key}`, "x-organization-id": c.id },
  });
  const p = (id = g.id) => ({ params: Promise.resolve({ id }) });
  const data = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  async function snapshot() {
    const r = await db.execute(sql.raw("select jsonb_build_object('entries',(select jsonb_agg(to_jsonb(t) order by id) from consolidation_elimination_entry t),'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_log t),'gl',(select jsonb_agg(to_jsonb(t) order by id) from journal_line t)) as state"));
    return JSON.stringify(r.rows[0].state);
  }
  async function denied(fn: () => Promise<Response>, status: number, code?: string) {
    const before = await snapshot(), r = await data(await fn(), status); if (code) assert.equal(r.code, code); assert.equal(await snapshot(), before);
  }
  async function mdenied(input: Record<string, unknown>, persist = false, status?: number, client = mc) {
    const before = await snapshot(), r = await client.call(persist ? "recalculate_consolidation_report" : "get_consolidation_report", input);
    assert.equal(r.isError, true, JSON.stringify(r)); if (status) assert.equal(r.body.status, status, JSON.stringify(r)); assert.equal(await snapshot(), before);
  }
  let entryNumber = 0;
  async function account(orgId: string, code: string, type: "asset" | "liability" | "equity" | "revenue" | "expense", debit: number, credit: number, date = "2024-01-10") {
    const [acc] = await db.insert(chartAccount).values({ organizationId: orgId, code, name: code, type }).returning();
    const [entry] = await db.insert(journalEntry).values({ organizationId: orgId, entryNumber: ++entryNumber, date, description: "Fixture", status: "posted" }).returning();
    const [line] = await db.insert(journalLine).values({ journalEntryId: entry.id, accountId: acc.id, debitAmount: debit, creditAmount: credit }).returning();
    return { acc, entry, line };
  }
  const cash = await account(b.id, "1000", "asset", 1000, 0);
  await account(b.id, "1200", "asset", 300, 0); await account(b.id, "2100", "liability", 0, 200);
  await account(b.id, "3000", "equity", 0, 800); await account(b.id, "4000", "revenue", 0, 300);
  await account(d.id, "1000", "asset", 400, 0); await account(d.id, "2100", "liability", 0, 400);
  const [rule, stub] = await db.insert(consolidationEliminationRule).values([
    { groupId: g.id, name: "AR/AP", kind: "ar_ap", debitAccountMatch: "1200", creditAccountMatch: "2100" },
    { groupId: g.id, name: "Unimplemented", kind: "investment_equity", debitAccountMatch: "1000", creditAccountMatch: "3000" },
  ]).returning();
  for (const [rateType, rate, rateExact] of [["closing", 2000000, "2"], ["average", 1500000, "1.5"], ["historical", 1000000, "1"]] as const)
    await db.insert(consolidationRate).values({ groupId: g.id, currencyCode: "JPY", rateType, rate, rateExact, rateMigrationStatus: "exact", periodEndDate: "2024-01-01" });
  const [cb, cd] = await db.insert(contact).values([{ organizationId: b.id, name: "USD affiliate", linkedOrgId: d.id }, { organizationId: d.id, name: "JPY affiliate", linkedOrgId: b.id }]).returning();
  await db.insert(invoice).values({ organizationId: b.id, contactId: cb.id, invoiceNumber: "IC", issueDate: "2024-01-10", dueDate: "2024-02-01", status: "sent", subtotal: 200, amountDue: 200, currencyCode: "JPY" });
  await db.insert(bill).values({ organizationId: d.id, contactId: cd.id, billNumber: "IC", issueDate: "2024-01-10", dueDate: "2024-02-01", status: "paid", subtotal: 300, amountDue: 400, currencyCode: "USD" });
  // Foreign documents referencing a member contact must not affect the cap.
  await db.insert(invoice).values({ organizationId: c.id, contactId: cb.id, invoiceNumber: "Foreign", issueDate: "2024-01-10", dueDate: "2024-02-01", status: "sent", subtotal: 999999, amountDue: 999999, currencyCode: "USD" });
  try {
    const before = await snapshot(), report = await data(await GET(req(), p()));
    assert.deepEqual(report, (await mc.call("get_consolidation_report", args)).body); assert.equal(await snapshot(), before);
    assert.equal(report.consolidatedPnL.totalRevenue, 450); assert.equal(report.consolidatedPnL.totalRevenueMinor, "450");
    assert.equal(report.translation.totalCta, 950); assert.equal(report.translation.totalCtaMinor, "950");
    assert.equal(report.consolidatedBalanceSheet.totalAssets, 2600); assert.equal(report.consolidatedBalanceSheet.balanceCheckMinor, "0");
    assert.equal(report.elimination.totalEliminatedMinor, "400"); assert.equal(report.elimination.totalVarianceMinor, "400");
    assert.equal(report.elimination.entries.find((r: { ruleId: string }) => r.ruleId === stub.id).skipped, true);
    assert.equal(report.consolidatedBalanceSheet.accounts.find((r: { code: string }) => r.code === "1000").byEntityMinor[b.id], "2000");
    assert.ok(report.translation.rates.some((r: { rateExact: string; rateDirection: string; baseCurrency: string }) => r.rateExact === "2" && r.rateDirection === "quote_per_base" && r.baseCurrency === "JPY"));
    const saved = await data(await POST(req(), p())); assert.deepEqual(saved, { persisted: true, ...report });
    assert.deepEqual((await managed.call("recalculate_consolidation_report", args)).body, saved);
    let entries = await db.select().from(consolidationEliminationEntry).where(eq(consolidationEliminationEntry.groupId, g.id));
    assert.equal(entries.length, 1); assert.equal(entries[0].amount, 400); assert.equal(entries[0].varianceAmount, 400);
    const raced = await Promise.all([POST(req(), p()), mc.call("recalculate_consolidation_report", args)]);
    await data(raced[0]); assert.equal(raced[1].isError, false);
    assert.equal((await db.select().from(consolidationEliminationEntry).where(eq(consolidationEliminationEntry.groupId, g.id))).length, 1);
    // Safe legacy clients, exact aliases and empty reports retain all supported currency units.
    for (const currency of ["USD", "JPY", "KWD", "IRR"]) {
      await db.update(consolidationGroup).set({ presentationCurrency: currency }).where(eq(consolidationGroup.id, empty.id));
      const r = await data(await GET(req(), p(empty.id))); assert.equal(r.consolidatedPnL.netIncomeMinor, "0"); assert.equal(r.presentationCurrency, currency);
      assert.deepEqual(r, (await mc.call("get_consolidation_report", { groupId: empty.id, ...dates })).body);
    }
    const [unitGroup] = await db.insert(consolidationGroup).values({ parentOrgId: a.id, name: "Unit fixtures", presentationCurrency: "USD" }).returning();
    const [unitMember] = await db.insert(consolidationGroupMember).values({ groupId: unitGroup.id, orgId: d.id, functionalCurrency: "USD" }).returning();
    for (const currency of ["USD", "JPY", "KWD", "IRR"]) {
      await db.update(consolidationGroup).set({ presentationCurrency: currency }).where(eq(consolidationGroup.id, unitGroup.id));
      await db.update(consolidationGroupMember).set({ functionalCurrency: currency }).where(eq(consolidationGroupMember.id, unitMember.id));
      const r = await data(await GET(req(), p(unitGroup.id)));
      assert.equal(r.consolidatedBalanceSheet.totalAssets, 400); assert.equal(r.consolidatedBalanceSheet.totalAssetsMinor, "400");
      assert.equal(r.consolidatedBalanceSheet.totalLiabilitiesMinor, "400"); assert.equal(r.presentationCurrency, currency);
      assert.deepEqual(r, (await mc.call("get_consolidation_report", { groupId: unitGroup.id, ...dates })).body);
    }
    // A large safe result with an exact FX product far beyond JS precision.
    await db.update(consolidationGroup).set({ presentationCurrency: "USD" }).where(eq(consolidationGroup.id, unitGroup.id));
    await db.update(consolidationGroupMember).set({ functionalCurrency: "KWD" }).where(eq(consolidationGroupMember.id, unitMember.id));
    await db.insert(consolidationRate).values({ groupId: unitGroup.id, currencyCode: "KWD", rateType: "closing", rate: 999999, rateExact: "0.999999", rateMigrationStatus: "exact", periodEndDate: "2024-01-01" });
    const wide = await account(d.id, "1020", "asset", 9007199254730001, 0);
    const wideReport = await data(await GET(req(), p(unitGroup.id)));
    assert.equal(wideReport.consolidatedBalanceSheet.accounts.find((r: { code: string }) => r.code === "1020").totalMinor, "9007190247530746");
    assert.deepEqual(wideReport, (await mc.call("get_consolidation_report", { groupId: unitGroup.id, ...dates })).body);
    await db.delete(journalLine).where(eq(journalLine.journalEntryId, wide.entry.id));
    // CTA entity adjustments survive cancellation of the group's total CTA.
    const cancelA = await account(d.id, "1030", "asset", 1, 0);
    const cancelB = await account(b.id, "1030", "asset", 0, 1);
    const [ctaGroup] = await db.insert(consolidationGroup).values({ parentOrgId: a.id, name: "CTA cancellation" }).returning();
    await db.insert(consolidationGroupMember).values([{ groupId: ctaGroup.id, orgId: b.id, functionalCurrency: "USD" }, { groupId: ctaGroup.id, orgId: d.id }]);
    for (const rateType of ["closing", "average"] as const) await db.insert(consolidationRate).values({ groupId: ctaGroup.id, currencyCode: "JPY", rateType, rate: 1000000, periodEndDate: "2024-01-01" });
    const cancelling = await data(await GET(req(), p(ctaGroup.id)));
    assert.equal(cancelling.translation.totalCtaMinor, "0");
    const ctaAccount = cancelling.consolidatedBalanceSheet.accounts.find((r: { code: string }) => r.code === "3900");
    assert.equal(ctaAccount.byEntityMinor[b.id], "-1"); assert.equal(ctaAccount.byEntityMinor[d.id], "1");
    const child = cancelling.consolidatedBalanceSheet.byEntity.find((r: { orgId: string }) => r.orgId === d.id);
    assert.equal(child.assets - child.liabilities - child.equity, 0);
    await db.delete(journalLine).where(eq(journalLine.journalEntryId, cancelA.entry.id));
    await db.delete(journalLine).where(eq(journalLine.journalEntryId, cancelB.entry.id));
    for (const bad of [{ startDate: "2024-02-30" }, { endDate: "2024-01-00" }, { startDate: "2025-01-01" }, { endDate: "2024-1-31" }, { amountMinor: "1" }, { startDate: "" }]) {
      await denied(() => GET(req({ ...dates, ...bad }), p()), 400); await denied(() => POST(req({ ...dates, ...bad }), p()), 400);
      await mdenied({ ...args, ...bad }); await mdenied({ ...args, ...bad }, true);
    }
    await denied(() => GET(req(), p("bad")), 400); await mdenied({ ...args, groupId: "bad" });
    for (const key of ["dk_report_bad", keys.expired]) { await denied(() => GET(req(dates, key), p()), 401); await denied(() => POST(req(dates, key), p()), 401); }
    await denied(() => GET(req(), p(foreign.id)), 404); await denied(() => POST(req(), p(foreign.id)), 404);
    await mdenied({ ...args, groupId: foreign.id }, false, 404); await mdenied({ ...args, groupId: foreign.id }, true, 404);
    await denied(() => POST(req(dates, keys.viewer), p()), 403); await mdenied(args, true, 403, ro);
    await denied(() => GET(req(dates, keys.viewer), p()), 403);
    await db.delete(member).where(and(eq(member.organizationId, b.id), eq(member.userId, owner.id)));
    await denied(() => GET(req(), p()), 403); await denied(() => POST(req(), p()), 403); await mdenied(args, false, 403); await mdenied(args, true, 403);
    await db.insert(member).values({ organizationId: b.id, userId: owner.id, role: "owner" });
    await db.update(organization).set({ deletedAt: new Date() }).where(eq(organization.id, b.id));
    await denied(() => GET(req(), p()), 403); await mdenied(args, true, 403);
    await db.update(organization).set({ deletedAt: null }).where(eq(organization.id, b.id));
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: dates.endDate });
    await denied(() => POST(req(), p()), 422); await mdenied(args, true, 422); await data(await GET(req(), p()));
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: dates.startDate, endDate: "2024-12-31", isClosed: true });
    await denied(() => POST(req(), p()), 422); await mdenied(args, true, 422);
    await db.delete(fiscalYear).where(eq(fiscalYear.organizationId, a.id));
    // Saved FX corruption never silently falls through to another source.
    const rates = await db.select().from(consolidationRate).where(eq(consolidationRate.groupId, g.id)), closing = rates.find(r => r.rateType === "closing")!;
    await db.execute(sql.raw("alter table consolidation_rate disable trigger user"));
    for (const bad of [{ rate: 0 }, { rateExact: "2.0000001" }, { rateDirection: "base_per_quote" }, { rateMigrationStatus: "invalid" }, { rate: 1000000 }]) {
      await db.update(consolidationRate).set(bad).where(eq(consolidationRate.id, closing.id));
      await denied(() => GET(req(), p()), 422, "LEGACY_NUMERIC_RANGE"); await mdenied(args, true, 422);
      await db.update(consolidationRate).set(closing).where(eq(consolidationRate.id, closing.id));
    }
    await db.update(consolidationRate).set({ rateExact: null, rateMigrationStatus: "pending" }).where(eq(consolidationRate.id, closing.id));
    assert.deepEqual(await data(await GET(req(), p())), report);
    await db.delete(consolidationRate).where(eq(consolidationRate.id, closing.id));
    await denied(() => GET(req(), p()), 422); await mdenied(args, true, 422);
    // Parent-scoped historical fallback including exact reciprocal rates.
    const [fx] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "USD", targetCurrency: "JPY", rate: 500000, rateExact: "0.5", rateMigrationStatus: "exact", date: "2024-01-01" }).returning();
    assert.equal((await data(await GET(req(), p()))).translation.rates.find((r: { baseCurrency: string; rateType: string }) => r.baseCurrency === "JPY" && r.rateType === "closing").inverse, true);
    await db.update(exchangeRate).set({ rateExact: "0.3", rate: 300000 }).where(eq(exchangeRate.id, fx.id));
    await denied(() => GET(req(), p()), 422, "LEGACY_NUMERIC_RANGE"); await mdenied(args, true, 422);
    await db.delete(exchangeRate).where(eq(exchangeRate.id, fx.id)); await db.insert(consolidationRate).values(closing);
    await db.execute(sql.raw("alter table consolidation_rate enable trigger user"));
    // SQL sums can exceed JS precision and still cancel to a safe exact net.
    const cancellation = await account(d.id, "1010", "asset", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1);
    await db.insert(journalLine).values({ journalEntryId: cancellation.entry.id, accountId: cancellation.acc.id, debitAmount: Number.MAX_SAFE_INTEGER, creditAmount: Number.MAX_SAFE_INTEGER - 1 });
    const exact = await data(await GET(req(), p())); assert.equal(exact.consolidatedBalanceSheet.accounts.find((r: { code: string }) => r.code === "1010").totalMinor, "2");
    await db.execute(sql`update journal_line set debit_amount=9007199254740992, credit_amount=0 where id=${cancellation.line.id}`);
    await denied(() => GET(req(), p()), 422, "LEGACY_NUMERIC_RANGE"); await denied(() => POST(req(), p()), 422, "LEGACY_NUMERIC_RANGE"); await mdenied(args, true, 422);
    await db.execute(sql`update journal_line set debit_amount=9223372036854775807, credit_amount=0 where journal_entry_id=${cancellation.entry.id}`);
    await denied(() => GET(req(), p()), 422, "LEGACY_NUMERIC_RANGE"); await mdenied(args, true, 422);
    await db.delete(journalLine).where(eq(journalLine.journalEntryId, cancellation.entry.id));
    // Preserve signed v1 tie rounding with exact products beyond Number precision.
    assert.equal(translateConsolidationCents(BigInt(-1), "0.5"), BigInt(0)); assert.equal(translateConsolidationCents(BigInt(1), "0.5"), BigInt(1));
    assert.equal(translateConsolidationCents(BigInt("9007199254730001"), "1.000001"), BigInt("9007208261929256"));
    await db.execute(sql.raw("create function report_audit_fault() returns trigger language plpgsql as $$ begin raise exception 'fixture audit fault'; end $$"));
    await db.execute(sql.raw("create trigger report_audit_fault before insert on audit_log for each row execute function report_audit_fault()"));
    await denied(() => POST(req(), p()), 500); await mdenied(args, true);
    await db.execute(sql.raw("drop trigger report_audit_fault on audit_log; drop function report_audit_fault()"));
    await db.execute(sql.raw("create function report_output_fault() returns trigger language plpgsql as $$ begin NEW.amount=NEW.amount+1; return NEW; end $$"));
    await db.execute(sql.raw("create trigger report_output_fault before insert on consolidation_elimination_entry for each row execute function report_output_fault()"));
    await denied(() => POST(req(), p()), 422); await mdenied(args, true, 422);
    await db.execute(sql.raw("drop trigger report_output_fault on consolidation_elimination_entry; drop function report_output_fault()"));
    // Stale deleted/skipped/zero entries are cleared even when there are no active rules.
    await db.update(consolidationEliminationRule).set({ deletedAt: new Date() }).where(eq(consolidationEliminationRule.id, rule.id));
    await data(await POST(req(), p())); entries = await db.select().from(consolidationEliminationEntry).where(eq(consolidationEliminationEntry.groupId, g.id)); assert.equal(entries.length, 0);
    await db.update(consolidationEliminationRule).set({ deletedAt: null }).where(eq(consolidationEliminationRule.id, rule.id));
    const race = await Promise.all([POST(req(), p()), PATCH(new Request("http://fixture.test", { method: "PATCH", headers: { authorization: `Bearer ${keys.owner}`, "content-type": "application/json" }, body: JSON.stringify({ presentationCurrency: "IRR" }) }), p())]);
    await data(race[0]); await data(race[1], 409);
    const deleting = await Promise.all([POST(req(), p()), mc.call("delete_consolidation_group", { groupId: g.id })]);
    assert.ok([200, 404].includes(deleting[0].status)); assert.equal(deleting[1].isError, false);
    await denied(() => GET(req(), p()), 404); await mdenied(args, true, 404);
    assert.equal((await db.select().from(journalLine).where(eq(journalLine.id, cash.line.id)))[0].debitAmount, 1000);
    console.log("Consolidation report contracts verified: actual REST/MCP read/recalculate, exact translation/aggregates/CTA/caps, auth/scope, locks, rollback and concurrency");
  } finally { await mc.close(); await ro.close(); await managed.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
