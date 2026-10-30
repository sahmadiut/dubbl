import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { mock } from "node:test";
import { eq } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, customRole, chartAccount, journalEntry, journalLine, periodLock, approvalWorkflow, approvalRequest } from "../../lib/db/schema";

let session: { user: { id: string }; iat: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function main() {
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const { previewJournalPost } = await import("../../lib/ai/action-preview");
  const route = await import("../../app/api/v1/ai/previews/journal-post/route");
  const { registerAiActionPreviewTools } = await import("../../lib/mcp/tools/ai-action-previews");
  const { AI_TOOL_NAMES } = await import("../../lib/ai/tool-catalog");
  assert.ok(!AI_TOOL_NAMES.some(n => String(n) === "preview_ai_journal_post"));
  assert.ok(!AI_TOOL_NAMES.some(n => String(n) === "post_entry"));
  const [owner, otherUser] = await db.insert(users).values(["owner", "other"].map(name => ({ name, email: `ai041-${name}@test.invalid` }))).returning();
  const [org, foreign] = await db.insert(organization).values([{ name: "Preview", slug: "preview-local" }, { name: "Foreign", slug: "preview-foreign" }]).returning();
  const permissions = ["use:ai", "view:data", "post:entries"];
  const [role] = await db.insert(customRole).values({ organizationId: org.id, name: "Poster", permissions }).returning();
  const [membership] = await db.insert(member).values([{ organizationId: org.id, userId: owner.id, role: "member", customRoleId: role.id }, { organizationId: foreign.id, userId: otherUser.id, role: "owner" }]).returning();
  const [debit, credit, foreignAccount] = await db.insert(chartAccount).values([
    { organizationId: org.id, code: "100", name: "Cash", type: "asset" as const },
    { organizationId: org.id, code: "200", name: "Equity", type: "equity" as const },
    { organizationId: foreign.id, code: "SECRET", name: "FOREIGN_ACCOUNT_SECRET", type: "asset" as const },
  ]).returning();
  let number = 0;
  async function journal(extra: Partial<typeof journalEntry.$inferInsert> = {}, pairs = 1) {
    const [entry] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: ++number, date: "2026-10-30", description: "Owner's journal", ...extra }).returning();
    const lines = await db.insert(journalLine).values(Array.from({ length: pairs }, (_, i) => [
      { journalEntryId: entry.id, accountId: debit.id, debitAmount: 1250, creditAmount: 0, currencyCode: i ? "IRR" : "USD" },
      { journalEntryId: entry.id, accountId: credit.id, debitAmount: 0, creditAmount: 1250, currencyCode: i ? "IRR" : "USD" },
    ]).flat()).returning();
    return { entry, lines };
  }
  session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 3600000).toISOString() };
  const req = (body: unknown, query = "") => new Request(`http://test.invalid/api/v1/ai/previews/journal-post${query}`, { method: "POST", headers: { "x-organization-id": org.id, "content-type": "application/json" }, body: JSON.stringify(body) });
  const ctx = await getAuthContext(req({}));
  const server = new McpServer({ name: "ai041", version: "1" }); registerAiActionPreviewTools(server, ctx);
  const client = new Client({ name: "test", version: "1" }), [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const read = async (body: unknown, status = 200) => {
    const response = await route.POST(req(body));
    assert.equal(response.status, status, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "private, no-store"); return response.json();
  };
  async function mcp(body: Record<string, unknown>, error = false) {
    const result = await client.callTool({ name: "preview_ai_journal_post", arguments: body });
    assert.equal(!!result.isError, error, JSON.stringify(result));
    return error ? result : JSON.parse((result.content as { text: string }[])[0].text);
  }
  async function unchanged<T>(fn: () => Promise<T>) {
    const snapshot = async () => (await pool.query(`select
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from journal_entry t) as headers,
      (select md5(coalesce(jsonb_agg(t order by t.id)::text,'')) from journal_line t) as lines,
      (select count(*)::text from ai_approval) as approvals,
      (select count(*)::text from ai_run) as runs,
      (select count(*)::text from ai_step) as steps,
      (select count(*)::text from ai_event) as events,
      (select count(*)::text from audit_log) as audits,
      (select count(*)::text from approval_request) as business_approvals`)).rows[0];
    const before = await snapshot(), result = await fn(); assert.deepEqual(await snapshot(), before); return result;
  }
  const semantic = (value: { preview: Record<string, unknown> }) => { const p = { ...value.preview }; delete p.observedAt; delete p.expiresAt; return { ...value, preview: p }; };
  try {
    const local = await journal({ autoReverseDate: "2026-11-01" }, 2);
    const body = { entryId: local.entry.id };
    const rest = await unchanged(() => read(body));
    assert.equal(rest.code, "PREVIEW_ONLY"); assert.equal(rest.preview.canApprove, false);
    assert.equal(rest.preview.authority, "preview_only"); assert.deepEqual(rest.preview.before, { status: "draft" }); assert.deepEqual(rest.preview.after, { status: "posted" });
    assert.deepEqual(rest.preview.amounts, [{ currencyCode: "IRR", debitAmountMinor: "1250", creditAmountMinor: "1250" }, { currencyCode: "USD", debitAmountMinor: "1250", creditAmountMinor: "1250" }]);
    assert.deepEqual(rest.preview.recipients, []); assert.ok(rest.preview.effects.includes("scheduled_reversal"));
    assert.equal(Date.parse(rest.preview.expiresAt) - Date.parse(rest.preview.observedAt), 300000);
    assert.equal(rest.preview.businessApproval.evaluation, "not_evaluated");
    assert.doesNotMatch(JSON.stringify(rest), /FOREIGN_ACCOUNT_SECRET|credential|leaseOwner|identity|argumentHash/);
    assert.deepEqual(semantic(await unchanged(() => mcp(body))), semantic(rest));
    assert.equal((await unchanged(() => read({ ...body, expectedResourceVersion: rest.preview.resourceVersion }))).code, "PREVIEW_ONLY");
    // Exact snapshot changes even when direct SQL leaves updated_at untouched.
    await pool.query("update journal_line set description='revised' where id=$1", [local.lines[0].id]);
    assert.equal((await read({ ...body, expectedResourceVersion: rest.preview.resourceVersion })).code, "PREVIEW_STALE");
    const refreshed = await read(body); assert.notEqual(refreshed.preview.resourceVersion, rest.preview.resourceVersion);
    await db.update(chartAccount).set({ name: "New Cash" }).where(eq(chartAccount.id, debit.id));
    assert.equal((await read({ ...body, expectedResourceVersion: refreshed.preview.resourceVersion })).code, "PREVIEW_STALE");
    await db.update(journalEntry).set({ reference: "new reference" }).where(eq(journalEntry.id, local.entry.id));
    assert.equal((await read({ ...body, expectedResourceVersion: refreshed.preview.resourceVersion })).code, "PREVIEW_STALE");
    const [workflow] = await db.insert(approvalWorkflow).values({ organizationId: org.id, name: "Private approver name", entityType: "journal_entry" }).returning();
    const [approval] = await db.insert(approvalRequest).values({ organizationId: org.id, workflowId: workflow.id, entityType: "journal_entry", entityId: local.entry.id, requestedById: membership.id }).returning();
    const pending = await read(body); assert.deepEqual(pending.preview.businessApproval, { evaluation: "not_evaluated", activeWorkflowPresent: true, latestRequestStatus: "pending" });
    assert.doesNotMatch(JSON.stringify(pending), /Private approver name|approverId|workflowId|requestedById/);
    await db.update(approvalRequest).set({ status: "approved" }).where(eq(approvalRequest.id, approval.id));
    assert.equal((await mcp({ ...body, expectedResourceVersion: pending.preview.resourceVersion })).code, "PREVIEW_STALE");
    assert.equal((await read(body)).preview.canApprove, false);
    // Unknown keys and forged scope/approval/execution fields are rejected by both transports.
    for (const invalid of [{ ...body, organizationId: foreign.id }, { ...body, approved: true }, { ...body, arguments: {} }, { ...body, action: "delete_entry" }, { entryId: "bad" }, { ...body, expectedResourceVersion: "bad" }]) {
      await read(invalid, 400); await mcp(invalid, true);
    }
    assert.equal((await route.POST(req(body, "?approved=true"))).status, 400);
    assert.equal((await route.POST(new Request("http://test.invalid", { method: "POST", headers: { "x-organization-id": org.id }, body: "{" }))).status, 400);
    const hidden = await journal({ organizationId: foreign.id, description: "FOREIGN_HEADER_SECRET" });
    const deleted = await journal({ deletedAt: new Date() });
    for (const id of [hidden.entry.id, deleted.entry.id, randomUUID()]) {
      const result = await read({ entryId: id }); assert.equal(result.code, "PREVIEW_NOT_FOUND"); assert.equal(result.preview, null);
    }
    for (const extra of [{ sourceType: "invoice" }, { status: "posted" as const }, { status: "void" as const }, { sourceType: "manual_reversal" }]) {
      const j = await journal(extra); assert.equal((await read({ entryId: j.entry.id })).code, "PREVIEW_UNSUPPORTED");
    }
    const corrupt = await journal();
    await db.update(journalLine).set({ accountId: foreignAccount.id }).where(eq(journalLine.id, corrupt.lines[0].id));
    assert.equal((await read({ entryId: corrupt.entry.id })).code, "PREVIEW_INVALID_RECORD");
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, debit.id));
    assert.equal((await read(body)).code, "PREVIEW_INVALID_RECORD");
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, debit.id));
    const [lock] = await db.insert(periodLock).values({ organizationId: org.id, lockDate: "2026-10-30" }).returning();
    assert.equal((await read(body)).code, "PREVIEW_PERIOD_LOCKED");
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const large = await journal();
    await pool.query("update journal_line set debit_amount=case when debit_amount>0 then 9007199254740992 else 0 end,credit_amount=case when credit_amount>0 then 9007199254740992 else 0 end where journal_entry_id=$1", [large.entry.id]);
    assert.equal((await read({ entryId: large.entry.id })).code, "PREVIEW_INVALID_RECORD");
    await pool.query("update journal_line set debit_amount=case when debit_amount>0 then 9007199254740991 else 0 end,credit_amount=case when credit_amount>0 then 9007199254740991 else 0 end where journal_entry_id=$1", [large.entry.id]);
    assert.equal((await read({ entryId: large.entry.id })).preview.amounts[0].debitAmountMinor, "9007199254740991");
    for (const currencyCode of ["usd", "BAD"]) {
      const invalid = await journal(); await db.update(journalLine).set({ currencyCode }).where(eq(journalLine.journalEntryId, invalid.entry.id));
      assert.equal((await read({ entryId: invalid.entry.id })).code, "PREVIEW_INVALID_RECORD");
    }
    const badRate = await journal();
    // Existing database guards reject mismatched FX before it can be previewed.
    await assert.rejects(db.update(journalLine).set({ rateExact: "2", rateDirection: "quote_per_base" }).where(eq(journalLine.id, badRate.lines[0].id)));
    assert.equal((await read({ entryId: badRate.entry.id })).code, "PREVIEW_ONLY");
    const many = await journal({}, 51); assert.equal((await read({ entryId: many.entry.id })).code, "PREVIEW_TOO_LARGE");
    const long = await journal({ description: "x".repeat(2001) }); assert.equal((await read({ entryId: long.entry.id })).code, "PREVIEW_TOO_LARGE");
    const payload = await journal({}, 10);
    await db.update(journalLine).set({ description: "x".repeat(2000) }).where(eq(journalLine.journalEntryId, payload.entry.id));
    assert.equal((await read({ entryId: payload.entry.id })).code, "PREVIEW_TOO_LARGE");
    const unbalanced = await journal(); await db.update(journalLine).set({ debitAmount: 1251 }).where(eq(journalLine.id, unbalanced.lines[0].id));
    assert.equal((await read({ entryId: unbalanced.entry.id })).code, "PREVIEW_INVALID_RECORD");
    for (const p of permissions) {
      await db.update(customRole).set({ permissions: permissions.filter(v => v !== p) }).where(eq(customRole.id, role.id));
      assert.equal((await read(body)).code, "PREVIEW_DENIED"); assert.equal((await mcp(body)).code, "PREVIEW_DENIED");
    }
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    assert.equal((await unchanged(() => read(body))).code, "PREVIEW_ONLY");
    // Revoke access during a real database wait, after the initial permission
    // check. The repeatable snapshot must not preserve disclosure rights.
    const locker = await pool.connect();
    let waiting: ReturnType<typeof previewJournalPost> | undefined;
    try {
      await locker.query("BEGIN"); await locker.query("LOCK TABLE journal_line IN ACCESS EXCLUSIVE MODE");
      waiting = previewJournalPost(ctx, body);
      let blocked = false;
      for (let i = 0; i < 200; i++) {
        const observed = await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%from \"journal_line\"%' and pid<>pg_backend_pid()");
        if (observed.rowCount) { blocked = true; break; }
        await delay(10);
      }
      assert.equal(blocked, true, "Preview should be waiting on actual line read");
      await db.update(customRole).set({ permissions: permissions.filter(p => p !== "view:data") }).where(eq(customRole.id, role.id));
      await locker.query("COMMIT");
      assert.equal((await waiting).code, "PREVIEW_DENIED");
    } finally { await locker.query("ROLLBACK"); locker.release(); await waiting; }
    await db.update(customRole).set({ permissions }).where(eq(customRole.id, role.id));
    // Previously obtained contexts do not preserve deleted membership rights.
    await db.delete(member).where(eq(member.id, membership.id));
    assert.equal((await previewJournalPost(ctx, body)).code, "PREVIEW_DENIED");
    session = null; assert.equal((await route.POST(req(body))).status, 401);
    console.log("AI preview REST/MCP/SQL verified");
  } finally { await client.close(); await server.close(); await pool.end(); }
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
