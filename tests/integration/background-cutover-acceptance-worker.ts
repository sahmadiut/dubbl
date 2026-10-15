import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, contact, exchangeRate, periodLock,
  journalEntry, journalLine, invoice, fixedAsset, notification } from "../../lib/db/schema";
import { registerAllTools } from "../../lib/mcp/tools";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { GET as getEntry } from "../../app/api/v1/entries/[id]/route";
import { processBookkeepingMaintenance } from "../../lib/api/bookkeeping-maintenance";
import { processRecurringJournalsMaintenance } from "../../lib/api/recurring-generate";
import { processFxRevaluationForOrg } from "../../lib/api/fx-revaluation";
import { processAutoReversals } from "../../lib/api/auto-reverse";

const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7) + "-01";
const asOf = new Date(Date.parse(month + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
const issue = asOf.slice(0, 7) + "-01";
const server = new McpServer({ name: "Background parent fixture", version: "1" });
const client = new Client({ name: "Fixture", version: "1" });
async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { text: string }[])[0].text;
  assert.equal(result.isError === true, false, `${name}: ${text}`);
  return JSON.parse(text);
}
async function snapshot() {
  const result = [];
  for (const table of ["organization", "invoice", "invoice_line", "fixed_asset", "depreciation_entry", "bank_account",
    "chart_account", "recurring_template", "recurring_template_line", "journal_entry", "journal_line", "number_sequence", "notification", "audit_log"]) {
    result.push((await db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text as state from ${table} t`))).rows[0].state);
  }
  return JSON.stringify(result);
}
async function run() {
  const [org] = await db.insert(organization).values({ name: "Background parent", slug: "background-parent", defaultCurrency: "USD" }).returning();
  const [owner] = await db.insert(users).values({ email: "background-parent@example.test" }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
  const key = "dk_background_parent";
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_background",
    keyHash: createHash("sha256").update(key).digest("hex") });
  registerAllTools(server, { organizationId: org.id, userId: owner.id, role: "owner" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const req = (body?: unknown) => new Request("http://fixture.test", { method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const [expense, accumulated, cash, revenue, ar] = await db.insert(chartAccount).values([
    { code: "5900", name: "Depreciation", type: "expense" as const }, { code: "1590", name: "Accumulated", type: "asset" as const },
    { code: "1100", name: "Cash", type: "asset" as const }, { code: "4000", name: "Revenue", type: "revenue" as const },
    { code: "1200", name: "AR", type: "asset" as const },
  ].map(row => ({ ...row, organizationId: org.id, currencyCode: "USD" }))).returning();
  const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Customer", type: "customer" }).returning();
  await db.insert(exchangeRate).values([
    { organizationId: org.id, baseCurrency: "EUR", targetCurrency: "USD", rate: 1200000, date: issue, source: "manual" },
    { organizationId: org.id, baseCurrency: "EUR", targetCurrency: "USD", rate: 1300000, date: asOf, source: "manual" },
  ]);
  const response = await createInvoice(req({ contactId: party.id, currencyCode: "EUR", issueDate: issue, dueDate: "2099-12-31",
    lines: [{ description: "Foreign receivable", accountId: revenue.id, unitPriceMinor: "3000000001" }] }));
  const body = await response.json(); assert.equal(response.status, 201, JSON.stringify(body));
  const doc = (await call("send_invoice", { invoiceId: body.invoice.id })).invoice;
  const asset = (await call("create_fixed_asset", { name: "Parent asset", assetNumber: "PARENT", purchaseDate: "2024-01-01",
    purchasePriceMinor: "3000000001", usefulLifeMonths: 3, depreciationAccountId: expense.id, accumulatedDepAccountId: accumulated.id })).asset;
  const manual = (await call("create_entry", { date: issue, description: "Tagged saved units", lines: [
    { accountId: expense.id, debitAmountMinor: "3000000001", currencyCode: "KWD", rateExact: "1.234567" },
    { accountId: cash.id, creditAmountMinor: "3000000001", currencyCode: "KWD", rateExact: "1.234567" },
  ] })).entry;
  await call("post_entry", { entryId: manual.id });
  await call("set_auto_reverse_date", { entryId: manual.id, autoReverseDate: today });
  const original = (await db.execute(sql`select jsonb_agg(to_jsonb(l) order by l.id)::text as state from journal_line l
    where journal_entry_id in (${doc.journalEntryId},${manual.id})`)).rows;

  // A shared period lock must block both child families without escaping financial writes.
  await db.insert(periodLock).values({ organizationId: org.id, lockDate: today });
  const locked = await snapshot();
  assert.deepEqual((await processBookkeepingMaintenance()).depreciation, { processed: 0, skipped: 1 });
  assert.equal((await processFxRevaluationForOrg(org.id, asOf, month)).reason, "period locked");
  assert.deepEqual(await processAutoReversals(), { checked: 1, reversed: 0, failed: 1 });
  assert.equal(await snapshot(), locked);
  await db.delete(periodLock).where(eq(periodLock.organizationId, org.id));

  // Malformed saved values in either child family stay unchanged and retryable.
  await db.update(fixedAsset).set({ netBookValue: 3000000000 }).where(eq(fixedAsset.id, asset.id));
  await db.update(invoice).set({ amountDue: 3000000000 }).where(eq(invoice.id, doc.id));
  const corrupt = await snapshot();
  assert.equal((await processBookkeepingMaintenance()).depreciation.processed, 0);
  await assert.rejects(processFxRevaluationForOrg(org.id, asOf, month));
  assert.equal(await snapshot(), corrupt);
  await db.update(fixedAsset).set({ netBookValue: 3000000001 }).where(eq(fixedAsset.id, asset.id));
  await db.update(invoice).set({ amountDue: 3000000001 }).where(eq(invoice.id, doc.id));

  const template = (await call("create_recurring_journal", { name: "Parent recurring", frequency: "monthly", startDate: today,
    maxOccurrences: 1, currencyCode: "JPY", lines: [
      { description: "DR", accountId: expense.id, debitAmountMinor: "3000000001" },
      { description: "CR", accountId: cash.id, creditAmountMinor: "3000000001" },
    ] })).template;
  const bank = (await call("create_bank_account", { accountName: "Parent cash", chartAccountId: cash.id, balanceMinor: "-3000000001" })).bankAccount;
  await call("set_bank_balance_alert", { bankAccountId: bank.id, thresholdMinor: "-3000000000" });
  // An edited issue-date rate must not alter the original 1.2 carrying recognition.
  await db.update(exchangeRate).set({ rate: 900000 }).where(and(eq(exchangeRate.organizationId, org.id), eq(exchangeRate.date, issue)));
  const [bookkeeping, recurring, fx] = await Promise.all([
    processBookkeepingMaintenance(), processRecurringJournalsMaintenance(), processFxRevaluationForOrg(org.id, asOf, month),
  ]);
  assert.deepEqual(bookkeeping.depreciation, { processed: 1, skipped: 0 });
  assert.deepEqual(bookkeeping.balanceAlerts, { checked: 1, alerted: 1 });
  assert.equal(recurring.journalsPosted, 1); assert.equal(fx.posted, true);
  assert.deepEqual(await processAutoReversals(), { checked: 1, reversed: 1, failed: 0 });
  const totals = (await db.execute(sql`select source_type, count(*)::text as entries, sum(debit)::text as debit from (
    select j.id, j.source_type, sum(l.debit_amount) as debit from journal_entry j join journal_line l on l.journal_entry_id=j.id
    where j.organization_id=${org.id} group by j.id) t group by source_type order by source_type`)).rows;
  assert.deepEqual(totals, [
    { source_type: "auto_reversal", entries: "1", debit: "3000000001" },
    { source_type: "depreciation", entries: "1", debit: "1000000000" },
    { source_type: "fx_revaluation", entries: "1", debit: "300000000" },
    { source_type: "fx_revaluation_reversal", entries: "1", debit: "300000000" },
    { source_type: "invoice", entries: "1", debit: "3600000001" },
    { source_type: "recurring_journal", entries: "1", debit: "3000000001" },
    { source_type: null, entries: "1", debit: "3000000001" },
  ]);
  assert.deepEqual((await db.execute(sql`select jsonb_agg(to_jsonb(l) order by l.id)::text as state from journal_line l
    where journal_entry_id in (${doc.journalEntryId},${manual.id})`)).rows, original);
  assert.deepEqual((await db.execute(sql`select j.id from journal_entry j join journal_line l on l.journal_entry_id=j.id
    group by j.id having sum(l.debit_amount)<>sum(l.credit_amount)`)).rows, []);
  assert.equal((await db.execute(sql`select count(distinct entry_number)::text as n from journal_entry where organization_id=${org.id}`)).rows[0].n, "7");
  const fxNet = (await db.execute(sql`select sum(l.debit_amount-l.credit_amount)::text as net from journal_line l join journal_entry j on j.id=l.journal_entry_id
    where l.account_id=${ar.id} and j.source_type like 'fx_revaluation%'`)).rows[0].net;
  assert.equal(fxNet, "0");
  const [notice] = await db.select().from(notification); assert.equal(notice.entityId, bank.id);
  assert.equal(notice.body, "Balance USD -30000000.01 is below threshold USD -30000000.00");
  const recurringEntry = (await db.select().from(journalEntry).where(eq(journalEntry.sourceId, template.id)))[0];
  const tagged = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, recurringEntry.id));
  assert.ok(tagged.every(line => line.currencyCode === "JPY" && line.rateExact === "1"));
  const completed = await snapshot();
  for (const entry of await db.select().from(journalEntry)) {
    const res = await getEntry(req(), { params: Promise.resolve({ id: entry.id }) });
    const rest = (await res.json()).entry; assert.equal(res.status, 200);
    const mcp = (await call("get_entry", { entryId: entry.id })).entry;
    assert.deepEqual(rest.lines.map((l: { debitAmountMinor: string }) => l.debitAmountMinor).sort(),
      mcp.lines.map((l: { debitAmountMinor: string }) => l.debitAmountMinor).sort());
    assert.ok(rest.lines.every((l: { debitAmount: string }) => /^\d+\.\d{2}$/.test(l.debitAmount)));
    assert.ok(mcp.lines.every((l: { debitAmount: number }) => Number.isSafeInteger(l.debitAmount)));
  }
  await Promise.all([processBookkeepingMaintenance(), processRecurringJournalsMaintenance(), processFxRevaluationForOrg(org.id, asOf, month), processAutoReversals()]);
  assert.equal(await snapshot(), completed);
  console.log("Background parent REST MCP SQL acceptance verified");
}
run().then(async () => { await client.close(); await server.close(); process.exit(0); })
  .catch(error => { console.error(error); process.exit(1); });
