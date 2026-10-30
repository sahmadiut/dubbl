import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, journalLine, aiProvider, aiProviderConfig, aiToolPolicy,
  aiActionConsumption, aiRun, aiStep, approvalWorkflow, approvalWorkflowStep, periodLock, payment, paymentAllocation, fiscalYear, invoice, bill, contact, bankAccount, exchangeRate } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const store = await import("../../lib/ai/persistence"), runs = await import("../../lib/ai/run-lifecycle"), batches = await import("../../lib/ai/action-batches");
  if (process.env.AI053_EXECUTE) { console.log(JSON.stringify(await batches.executeApprovedSettlement(JSON.parse(process.env.AI053_EXECUTE)))); return; }
  if (process.env.AI053_RECOVER === "true") { await runs.maintainRuns(); console.log("Fresh process recovered consumed operation"); return; }
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const approveRoute = await import("../../app/api/v1/ai/runs/[id]/action-batch/approve/route");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const [owner, other] = await db.insert(users).values(["owner", "other"].map(name => ({ name, email: `ai053-${name}@test.invalid` }))).returning();
  const [org] = await db.insert(organization).values({ name: "Execute", slug: "execute" }).returning();
  const permissions = ["use:ai", "view:ai-history", "view:data", "post:entries", "edit:entries", "manage:payments"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Operator", permissions }).returning();
  const [ownerMember] = await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: org.id, userId: other.id, role: "owner" }]).returning();
  const [debit, credit, , , expense] = await db.insert(chartAccount).values([
    { code: "1100", name: "Cash", type: "asset" as const }, { code: "4000", name: "Revenue", type: "revenue" as const },
    { code: "1200", name: "AR", type: "asset" as const }, { code: "2100", name: "AP", type: "liability" as const }, { code: "5000", name: "Expense", type: "expense" as const },
    { code: "4910", name: "FX gain", type: "revenue" as const }, { code: "5930", name: "FX loss", type: "expense" as const },
  ].map(a => ({ ...a, organizationId: org.id }))).returning();
  const [party] = await db.insert(contact).values({ organizationId: org.id, name: "Counterparty", type: "both" }).returning();
  const [bank] = await db.insert(bankAccount).values({ organizationId: org.id, accountName: "USD", chartAccountId: debit.id }).returning();
  const { createInvoice } = await import("../../lib/api/invoice-writes");
  const { sendInvoice } = await import("../../lib/api/invoice-lifecycle");
  const { createBill } = await import("../../lib/api/bill-writes");
  const { receiveBill } = await import("../../lib/api/bill-lifecycle");
  const fixtureCtx = { userId: owner.id, organizationId: org.id, role: "owner" as const };
  let seq = 0;
  session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
  const req = (body?: unknown) => new Request("http://test.invalid/api/v1/ai/runs/consume", { method: body ? "POST" : "GET", headers: { "x-organization-id": org.id, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const ctx = await getAuthContext(req());
  const [provider] = await db.insert(aiProvider).values({ name: "Fixture", adapter: "responses", endpoint: "https://fixture.invalid/v1/responses", enabled: true, defaultModel: "fixture", timeoutMs: 1000,
    delegatedOrganizations: [org.id], models: [{ id: "fixture", contextTokens: 10000, outputTokens: 1000, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-10-31" }] }).returning();
  await db.insert(aiProviderConfig).values({ providerId: provider.id, organizationId: org.id, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, credential: "synthetic", keyVersion: "fixture" });
  await db.insert(aiToolPolicy).values(["organization", "agent:default"].map(subject => ({ organizationId: org.id, subject, enabled: true, allowedTools: ["list_contacts"] })));
  const server = new McpServer({ name: "ai053", version: "1" }); registerAiActionPreviewTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  async function mcp(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }); assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  const runRow = async (id: string) => (await db.select().from(aiRun).where(eq(aiRun.id, id)))[0];
  const stepRows = (id: string) => db.select().from(aiStep).where(eq(aiStep.runId, id)).orderBy(aiStep.id);
  const consumedRows = (id: string) => db.select().from(aiActionConsumption).where(eq(aiActionConsumption.runId, id));
  const decisionBody = (view: Awaited<ReturnType<typeof mcp>>) => ({ batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, bindingDigest: view.batch.bindingDigest,
    selectedItemIds: view.batch.display.items.filter((i: { selected: boolean }) => i.selected).map((i: { itemId: string }) => i.itemId).sort(), requestKey: `approve-${++seq}` });
  async function propose(kind: "invoice" | "bill" = "invoice", amount = "500", currencyCode = "USD", existing?: string[]) {
    const items: { itemId: string; action: "settle_document"; arguments: { documentType: "invoice" | "bill"; documentId: string; amountMinor: string; date: string; method: "bank_transfer"; bankAccountId?: string; reference: string }; dependsOn: string[] }[] = [];
    for (let n = 0; n < 3; n++) {
      const input = { contactId: party.id, issueDate: "2026-10-01", dueDate: "2026-10-31", currencyCode, lines: [{ description: "Fixture", unitPriceMinor: currencyCode === "IRR" ? "2147483648" : "1250", accountId: kind === "invoice" ? credit.id : expense.id }] };
      const doc = existing ? { id: existing[n] } : kind === "invoice" ? (await sendInvoice(fixtureCtx, (await createInvoice(fixtureCtx, input, "rest")).invoice.id)).invoice
        : (await receiveBill(fixtureCtx, (await createBill(fixtureCtx, input, "rest")).bill.id)).bill;
      items.push({ itemId: randomUUID(), action: "settle_document", arguments: { documentType: kind, documentId: doc.id, amountMinor: amount, date: "2026-10-31", method: "bank_transfer", ...(currencyCode === "USD" ? { bankAccountId: bank.id } : {}), reference: "Exact approved reference" }, dependsOn: n === 1 ? [items[0].itemId] : [] });
    }
    const c = await store.createConversation(ctx), r = await runs.submitRun(ctx, { conversationId: c.id, requestKey: `run-${++seq}`, message: "Prepare actions" });
    const claimed = await runs.claimNextRun(); assert.equal(claimed?.id, r.id);
    await batches.requestActionBatch(r.id, claimed!.leaseOwner!, claimed!.version, { requestKey: "initial", items, selectedItemIds: [] });
    let view = await mcp("get_ai_action_batch", { runId: r.id });
    await mcp("revise_ai_action_batch", { runId: r.id, batchId: view.batch.id, expectedVersion: view.batch.version, expectedRunVersion: view.runVersion, requestKey: "selection", items, selectedItemIds: items.slice(0, 2).map(i => i.itemId) });
    view = await mcp("get_ai_action_batch", { runId: r.id });
    {
      const response = await approveRoute.POST(req(decisionBody(view)), { params: Promise.resolve({ id: r.id }) });
      assert.equal(response.status, 200); assert.equal((await response.json()).code, "DECISION_APPROVED");
    }
    return { id: r.id, view, items, c };
  }
  // Foundation qualification supplies this SQL setup explicitly. No application
  // resume route, automatic queue transition or sensitive worker dispatch exists.
  async function claim(p: Awaited<ReturnType<typeof propose>>) {
    await db.update(aiRun).set({ state: "queued" }).where(eq(aiRun.id, p.id));
    const r = await runs.claimNextRun(); assert.equal(r?.id, p.id);
    return { runId: p.id, lease: r!.leaseOwner!, batchId: p.view.batch.id, itemId: p.items[0].itemId };
  }
  const docRow = async (id: string, kind: "invoice" | "bill" = "invoice") => (kind === "invoice" ? await db.select().from(invoice).where(eq(invoice.id, id)) : await db.select().from(bill).where(eq(bill.id, id)))[0];
  const lines = (id: string) => db.select().from(journalLine).where(eq(journalLine.journalEntryId, id)).orderBy(journalLine.id);
  const paymentCount = async () => (await pool.query("select count(*)::int n from payment")).rows[0].n;
  const moneyCounts = async () => (await pool.query(`select
    (select count(*) from payment)::int payments, (select count(*) from payment_allocation)::int allocations,
    (select count(*) from journal_entry)::int journals, (select count(*) from journal_line)::int lines,
    (select coalesce(sum(last_number),0) from number_sequence)::text numbers,
    (select count(*) from audit_log where entity_type='payment')::int audits`)).rows[0];
  async function waitFor(query: string) {
    for (let i = 0; i < 400; i++) {
      if ((await pool.query("select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like $1", [query])).rowCount) return;
      await delay(10);
    }
    throw new Error(`No expected SQL wait: ${query}`);
  }
  async function stop(p: Awaited<ReturnType<typeof propose>>) { await runs.cancelRun(ctx, { runId: p.id }); }
  try {
    for (const kind of ["invoice", "bill"] as const) for (const currency of ["USD", "IRR"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, org.id));
      await pool.query("update chart_account set currency_code=$1", [currency]);
      const amount = currency === "IRR" ? "2147483648" : kind === "bill" ? "1250" : "500";
      const p = await propose(kind, amount, currency), input = await claim(p), before = await paymentCount();
      await assert.rejects(batches.executeApprovedJournal(input)); // Wrong adapter cannot consume cash.
      assert.equal((await consumedRows(p.id)).length, 0);
      await assert.rejects(batches.executeApprovedSettlement({ ...input, itemId: p.items[1].itemId })); // dependency
      await assert.rejects(batches.executeApprovedSettlement({ ...input, itemId: p.items[2].itemId })); // unselected
      const results = await Promise.all([batches.executeApprovedSettlement(input), batches.executeApprovedSettlement(input)]);
      assert.equal(results.filter(r => r.code === "ACTION_EXECUTED").length, 1);
      assert.equal(results.filter(r => r.code === "ACTION_ALREADY_CONSUMED").length, 1);
      const receipt = results.find(r => r.code === "ACTION_EXECUTED")!.receipt;
      assert.equal(receipt.state, "succeeded"); assert.equal(receipt.recordIds.length, 3);
      assert.equal(receipt.recordIds[0], p.items[0].arguments.documentId);
      const saved = (await db.select().from(payment).where(eq(payment.id, receipt.recordIds[1])))[0];
      assert.equal(String(saved.amount), amount); assert.equal(saved.currencyCode, currency); assert.equal(saved.reference, "Exact approved reference");
      assert.equal(saved.type, kind === "invoice" ? "received" : "made"); assert.equal(saved.journalEntryId, receipt.recordIds[2]);
      const allocations = await db.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId, saved.id));
      assert.equal(allocations.length, 1); assert.equal(String(allocations[0].amount), amount); assert.equal(allocations[0].documentType, kind);
      const legs = await lines(saved.journalEntryId!);
      assert.equal(legs.reduce((v, l) => v + BigInt(l.debitAmount), 0n), BigInt(amount));
      assert.equal(legs.reduce((v, l) => v + BigInt(l.creditAmount), 0n), BigInt(amount));
      const changed = await docRow(p.items[0].arguments.documentId, kind);
      assert.equal(String(changed.amountPaid), amount); assert.equal(String(changed.amountDue), String(BigInt(changed.total) - BigInt(amount)));
      assert.equal(changed.status, changed.amountDue === 0 ? "paid" : "partial");
      assert.equal((await docRow(p.items[1].arguments.documentId, kind)).amountPaid, 0);
      assert.equal((await docRow(p.items[2].arguments.documentId, kind)).amountPaid, 0);
      assert.equal((await batches.executeApprovedSettlement({ ...input, itemId: p.items[1].itemId })).receipt.state, "succeeded");
      const retry = await batches.executeApprovedSettlement(input); assert.equal(retry.code, "ACTION_ALREADY_CONSUMED"); assert.deepEqual(retry.receipt, receipt);
      assert.equal(await paymentCount(), before + 2);
      assert.equal((await consumedRows(p.id)).length, 2); await stop(p);
      assert.equal((await pool.query("select count(*)::int n from audit_log where changes->>'consumptionId'=$1", [results.find(r => r.code === "ACTION_EXECUTED")!.consumptionId])).rows[0].n, 1);
    }
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, org.id));
    await pool.query("update chart_account set currency_code='USD'");
    // Saved recognition at 2 USD/EUR, cash at 3. Successive partial payments
    // release cumulative carrying rounding without revaluing old journal lines.
    await db.insert(exchangeRate).values(["2026-10-01", "2026-10-31"].map((date, i) => ({ organizationId: org.id, baseCurrency: "EUR", targetCurrency: "USD", date,
      rate: (i + 2) * 1000000, rateExact: String(i + 2), rateFormatVersion: 1, rateDirection: "quote_per_base" as const, rateMigrationStatus: "exact" as const, source: "manual" as const })));
    for (const kind of ["invoice", "bill"] as const) {
      const p = await propose(kind, "417", "EUR"), input = await claim(p);
      const target = p.items[0].arguments.documentId, doc = await docRow(target, kind), recognition = await lines(doc.journalEntryId!);
      const first = await batches.executeApprovedSettlement(input); assert.equal(first.receipt.state, "succeeded");
      const legs = await lines(first.receipt.recordIds[2]);
      const cash = legs.find(l => l.accountId === debit.id)!, fx = legs.find(l => ![debit.id].includes(l.accountId) && (l.debitAmount === 417 || l.creditAmount === 417))!;
      assert.equal(kind === "invoice" ? cash.debitAmount : cash.creditAmount, 1251);
      assert.equal(kind === "invoice" ? fx.creditAmount : fx.debitAmount, 417);
      assert.equal(legs.reduce((v, l) => v + BigInt(l.debitAmount), 0n), 1251n);
      assert.ok(legs.every(l => l.rateExact === "3" && l.currencyCode === "EUR"));
      assert.equal((await docRow(target, kind)).amountDue, 833); await stop(p);
      const follow = await propose(kind, "833", "EUR", p.items.map(i => i.arguments.documentId)), followInput = await claim(follow);
      const final = await batches.executeApprovedSettlement(followInput); assert.equal(final.receipt.state, "succeeded");
      const remaining = await lines(final.receipt.recordIds[2]);
      const control = remaining.find(l => ![debit.id].includes(l.accountId) && (l.debitAmount === 1666 || l.creditAmount === 1666)); assert.ok(control);
      assert.equal((await docRow(target, kind)).status, "paid"); assert.equal((await docRow(target, kind)).amountPaid, 1250);
      assert.deepEqual(await lines(doc.journalEntryId!), recognition); await stop(follow);
    }
    // Lose only the acknowledgement AFTER a real domain/receipt COMMIT. The
    // adapter reconciles the immutable receipt and does not execute a second time.
    const ack = await propose(), ackInput = await claim(ack);
    const originalTransaction = db.transaction.bind(db);
    const lostAck = mock.method(db, "transaction", async (...args: Parameters<typeof db.transaction>) => {
      const result = await originalTransaction(...args);
      if (result && typeof result === "object" && "state" in result && result.state === "succeeded" && "stepId" in result) throw new Error("Fixture lost commit acknowledgement");
      return result;
    });
    try {
      const reconciled = await batches.executeApprovedSettlement(ackInput);
      assert.equal(reconciled.code, "ACTION_EXECUTED"); assert.equal(reconciled.receipt.state, "succeeded");
      assert.equal((await docRow(ack.items[0].arguments.documentId)).status, "partial");
    } finally { lostAck.mock.restore(); }
    assert.equal((await batches.executeApprovedSettlement(ackInput)).code, "ACTION_ALREADY_CONSUMED");
    assert.equal((await consumedRows(ack.id)).length, 1); await stop(ack);

    // Handoff loss, unknown IDs and argument injection cannot reacquire execution.
    const lost = await propose(), lostInput = await claim(lost);
    const handed = await batches.consumeApprovedAction(lostInput); assert.equal(handed.code, "ACTION_CONSUMED");
    assert.equal((await batches.executeApprovedSettlement(lostInput)).code, "ACTION_ALREADY_CONSUMED");
    assert.equal((await docRow(lost.items[0].arguments.documentId)).amountPaid, 0);
    await assert.rejects(batches.executeApprovedSettlement({ ...lostInput, arguments: { documentId: lost.items[2].arguments.documentId } }));
    await assert.rejects(batches.executeApprovedSettlement({ ...lostInput, lease: randomUUID() }));
    await stop(lost);
    await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 100) }).where(eq(aiRun.id, lost.id));
    await runs.maintainRuns();

    // Actual effect-boundary lock waits happen AFTER durable consumption. A
    // committed resource/authority/Stop change during that gap must prevent writes.
    for (const kind of ["invoice", "bill"] as const) for (const mode of ["resource", "line", "permission", "session", "policy", "period", "fiscal", "account", "bank", "bankLink", "party", "stop", "lease", "config", "runtime", "balance", "recognition", "base", "rate"] as const) {
      const p = await propose(kind, "500", mode === "rate" ? "EUR" : "USD"), input = await claim(p), target = p.items[0].arguments.documentId;
      const before = await paymentCount();
      const blocker = await pool.connect();
      await blocker.query("begin"); await blocker.query("lock table journal_entry, journal_line in row exclusive mode");
      const pending = batches.executeApprovedSettlement(input); const observed = pending.then(value => ({ value }), error => ({ error }));
      let workflow: string | undefined, fy: string | undefined;
      try {
        await waitFor('lock table "journal_entry"%');
        assert.equal((await consumedRows(p.id)).length, 1);
        if (mode === "resource") await blocker.query(`update ${kind} set reference='changed without timestamp' where id=$1`, [target]);
        if (mode === "line") await blocker.query(`update journal_line set description='Changed line' where journal_entry_id=(select journal_entry_id from ${kind} where id=$1)`, [target]);
        if (mode === "permission") await db.update(customRole).set({ permissions: permissions.filter(v => v !== "manage:payments") }).where(eq(customRole.id, role.id));
        if (mode === "session") await db.update(users).set({ sessionRevokedAt: new Date() }).where(eq(users.id, owner.id));
        if (mode === "account") await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, debit.id));
        if (mode === "policy") {
          const [w] = await db.insert(approvalWorkflow).values({ organizationId: org.id, name: "Late rule", entityType: kind, conditions: [], isActive: true }).returning(); workflow = w.id;
          await db.insert(approvalWorkflowStep).values({ workflowId: w.id, stepOrder: 1, approverId: ownerMember.id });
        }
        if (mode === "period") await db.insert(periodLock).values({ organizationId: org.id, lockDate: "2026-10-31" });
        if (mode === "fiscal") { const [f] = await db.insert(fiscalYear).values({ organizationId: org.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true }).returning(); fy = f.id; }
        if (mode === "stop") await stop(p);
        if (mode === "lease") await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 100) }).where(eq(aiRun.id, p.id));
        if (mode === "config") await db.update(aiProvider).set({ version: provider.version + 1 }).where(eq(aiProvider.id, provider.id));
        if (mode === "runtime") process.env.AI_RUNTIME_ENABLED = "false";
        if (mode === "bank") await db.update(bankAccount).set({ isActive: false }).where(eq(bankAccount.id, bank.id));
        if (mode === "party") await db.update(contact).set({ deletedAt: new Date() }).where(eq(contact.id, party.id));
        if (mode === "balance") await blocker.query(`update ${kind} set amount_due=1 where id=$1`, [target]);
        if (mode === "recognition") await blocker.query(`update journal_entry set status='draft' where id=(select journal_entry_id from ${kind} where id=$1)`, [target]);
        if (mode === "base") await db.update(organization).set({ defaultCurrency: "EUR" }).where(eq(organization.id, org.id));
        if (mode === "bankLink") await db.update(bankAccount).set({ chartAccountId: credit.id }).where(eq(bankAccount.id, bank.id));
        if (mode === "rate") await db.update(exchangeRate).set({ rate: 4000000, rateExact: "4" }).where(eq(exchangeRate.date, "2026-10-31"));
        await blocker.query("commit");
        const result = await observed; assert.ok("value" in result, JSON.stringify(result));
        assert.notEqual(result.value.code, "ACTION_EXECUTED", `${kind}/${mode}`);
        assert.notEqual(result.value.receipt.state, "succeeded");
        assert.equal((await docRow(target, kind)).amountPaid, 0); assert.equal(await paymentCount(), before);
        assert.equal((await pool.query("select count(*)::int n from audit_log where changes->>'consumptionId'=$1", [(await consumedRows(p.id))[0].id])).rows[0].n, 0);
      } finally {
        await blocker.query("rollback"); blocker.release(); await observed;
        process.env.AI_RUNTIME_ENABLED = "true";
        await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
        await db.update(users).set({ sessionRevokedAt: null }).where(eq(users.id, owner.id));
        await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, debit.id));
        await db.update(bankAccount).set({ isActive: true, chartAccountId: debit.id }).where(eq(bankAccount.id, bank.id));
        await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, org.id));
        await db.update(exchangeRate).set({ rate: 3000000, rateExact: "3" }).where(eq(exchangeRate.date, "2026-10-31"));
        await db.update(contact).set({ deletedAt: null }).where(eq(contact.id, party.id));
        await db.update(aiProvider).set({ version: provider.version }).where(eq(aiProvider.id, provider.id));
        if (workflow) await db.delete(approvalWorkflow).where(eq(approvalWorkflow.id, workflow));
        if (fy) await db.delete(fiscalYear).where(eq(fiscalYear.id, fy));
        await db.delete(periodLock).where(eq(periodLock.organizationId, org.id));
        await stop(p);
      }
    }

    // Expire while the success event is blocked, after money writes. Everything rolls back.
    for (const kind of ["invoice", "bill"] as const) {
      const p = await propose(kind), input = await claim(p), target = p.items[0].arguments.documentId, before = await paymentCount();
      const originalMoney = await moneyCounts();
      const resource = await pool.connect(), event = await pool.connect();
      await resource.query("begin"); await resource.query("lock table journal_entry in row exclusive mode");
      const pending = batches.executeApprovedSettlement(input); const observed = pending.then(value => ({ value }), error => ({ error }));
      try {
        await waitFor('lock table "journal_entry"%');
        await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() + 1200) }).where(eq(aiRun.id, p.id));
        await event.query("begin"); await event.query("lock table ai_event in share mode");
        await resource.query("commit"); await waitFor('insert into "ai_event"%');
        const revoke = pool.query("update custom_role set permissions='[]'::jsonb where id=$1", [role.id]);
        await waitFor('update custom_role%');
        await delay(1300); await event.query("commit"); await revoke;
        const result = await observed; assert.ok("value" in result); assert.equal(result.value.receipt.state, "failed");
        assert.equal((await docRow(target, kind)).amountPaid, 0); assert.equal(await paymentCount(), before);
        assert.deepEqual(await moneyCounts(), originalMoney);
        await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id)); await stop(p);
      } finally { await resource.query("rollback"); await event.query("rollback"); resource.release(); event.release(); await observed; }
    }

    // A database failure after the second mutation preserves the first committed
    // effect and rolls back the second effect/receipt/audit as one transaction.
    const partial = await propose(), partialInput = await claim(partial);
    const confirmed = await batches.executeApprovedSettlement(partialInput); assert.equal(confirmed.receipt.state, "succeeded");
    const afterFirst = await moneyCounts();
    await pool.query(`create function ai053_fail_receipt() returns trigger language plpgsql as $$ begin
      if exists(select 1 from ai_step where run_id=new.run_id and state='succeeded' and id <> '${confirmed.receipt.stepId}') then
        raise exception 'fixture receipt failure'; end if; return new; end $$`);
    await pool.query("create trigger ai053_receipt before insert on ai_event for each row execute function ai053_fail_receipt()");
    try {
      const failed = await batches.executeApprovedSettlement({ ...partialInput, itemId: partial.items[1].itemId });
      assert.equal(failed.code, "ACTION_RECONCILIATION_REQUIRED"); assert.equal(failed.receipt.state, "uncertain");
      assert.equal((await docRow(partial.items[0].arguments.documentId)).status, "partial");
      assert.equal((await docRow(partial.items[1].arguments.documentId)).amountPaid, 0);
      assert.deepEqual(await moneyCounts(), afterFirst);
      assert.deepEqual((await stepRows(partial.id)).find(s => s.id === confirmed.receipt.stepId)?.recordIds, confirmed.receipt.recordIds);
      assert.equal((await runRow(partial.id)).state, "reconciliation_required");
      await assert.rejects(batches.executeApprovedSettlement({ ...partialInput, itemId: partial.items[1].itemId }));
    } finally { await pool.query("drop trigger ai053_receipt on ai_event"); await pool.query("drop function ai053_fail_receipt()"); }

    // Kill a fresh worker with an uncommitted mutation, then recover in another
    // process. PostgreSQL rolls back the journal; recovery keeps uncertainty and
    // never replays the consumed operation, including on an old lease.
    const crash = await propose(), crashInput = await claim(crash), target = crash.items[0].arguments.documentId;
    const beforeCrash = await moneyCounts();
    const resource = await pool.connect(), audit = await pool.connect();
    await resource.query("begin"); await resource.query("lock table journal_entry in row exclusive mode");
    const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-settlement-execution-worker.ts"], {
      env: { ...process.env, AI053_EXECUTE: JSON.stringify(crashInput) }, stdio: "pipe",
    });
    const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
    try {
      await waitFor('lock table "journal_entry"%');
      await audit.query("begin"); await audit.query("lock table ai_event in share mode");
      await resource.query("commit"); await waitFor('insert into "ai_event"%');
      child.kill(); await closed; await audit.query("commit");
      assert.equal((await docRow(target)).amountPaid, 0);
      assert.deepEqual(await moneyCounts(), beforeCrash);
      await db.update(aiRun).set({ leaseExpiresAt: new Date(Date.now() - 100) }).where(eq(aiRun.id, crash.id));
      const recovered = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "tests/integration/ai-settlement-execution-worker.ts"], { env: { ...process.env, AI053_RECOVER: "true" }, encoding: "utf8", timeout: 30000 });
      assert.equal(recovered.status, 0, recovered.stderr);
      assert.equal((await runRow(crash.id)).state, "reconciliation_required");
      assert.ok((await stepRows(crash.id)).some(s => s.state === "uncertain"));
      await assert.rejects(batches.executeApprovedSettlement(crashInput));
      assert.equal((await docRow(target)).amountPaid, 0);
    } finally { child.kill(); await closed; await resource.query("rollback"); await audit.query("rollback"); resource.release(); audit.release(); }

    console.log("AI settlement effects/SQL/restart verified");
  } finally { await pool.end(); await client.close(); await server.close(); }
}
main().then(() => process.exit(0), err => { console.error(err); process.exit(1); });
