import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { apiKey, auditLog, contact, customRole, invoice, invoiceSignature, member, organization, users } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { GET, PATCH } from "../../app/api/v1/invoices/[id]/snapshot/route";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Snapshot fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { tools: (await client.listTools()).tools, async call(name: string, input: object) {
    const r = await client.callTool({ name, arguments: { ...input } }); const text = (r.content as { text: string }[])[0].text;
    return { error: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Snapshot A", slug: "snapshot-a" }, { name: "Snapshot B", slug: "snapshot-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "snapshot-owner@example.test" }, { email: "snapshot-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No grants", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "owner", customRoleId: role.id }]);
  const keys = { a: "dk_snapshot_a", b: "dk_snapshot_b", denied: "dk_snapshot_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyPrefix: "dk_snapshot", keyHash: createHash("sha256").update(key).digest("hex") });
  const historical = { name: "Saved sender", amount: 1250, amountMinor: "9223372036854775807",
    nested: { credit: -Number.MAX_SAFE_INTEGER, count: 0.5, fx: "0.000000000000000001", taxId: "001250" } };
  const [localContact, foreignContact] = await db.insert(contact).values([
    { organizationId: a.id, name: "Current local name" }, { organizationId: b.id, name: "FOREIGN_SECRET" },
  ]).returning();
  const [sent, draft, foreign, deleted, empty] = await db.insert(invoice).values([
    { organizationId: a.id, invoiceNumber: "SENT", status: "sent" as const, senderSnapshot: historical, recipientSnapshot: { name: "Saved recipient", taxNumber: "00029" } },
    { organizationId: a.id, invoiceNumber: "DRAFT" },
    { organizationId: b.id, invoiceNumber: "FOREIGN", status: "sent" as const, senderSnapshot: { name: "FOREIGN_SECRET" } },
    { organizationId: a.id, invoiceNumber: "DELETED", status: "sent" as const, deletedAt: new Date() },
    { organizationId: a.id, invoiceNumber: "EMPTY", status: "sent" as const },
  ].map(row => ({ ...row, contactId: row.organizationId === a.id ? localContact.id : foreignContact.id,
    issueDate: "2024-01-01", dueDate: "2024-01-31", currencyCode: "IRR" }))).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), no = await connect({ ...ctx, userId: denied.id, permissions: [] });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const req = (id: string, body?: unknown, key = keys.a) => new Request(`http://fixture.test/api/v1/invoices/${id}/snapshot`, {
    method: body === undefined ? "GET" : "PATCH", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const body = async (r: Response, status = 200) => { const data = await r.json(); assert.equal(r.status, status, JSON.stringify(data)); return data; };
  const good = async (name: string, args: object) => { const r = await ma.call(name, args); assert.equal(r.error, false, JSON.stringify(r)); return r.body; };
  const snapshot = async () => (await db.execute(sql.raw(["invoice", "invoice_signature", "audit_log"].map(n =>
    `select '${n}' as name, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as rows from "${n}" t`).join(" union all ")))).rows;
  const unchanged = async (fn: () => Promise<unknown>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  try {
    for (const name of ["get_invoice_snapshot", "update_invoice_snapshot"]) {
      const tool = ma.tools.find(t => t.name === name)!; assert.equal(tool.inputSchema.additionalProperties, false);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
    }
    await unchanged(async () => {
      const result = await body(await GET(req(sent.id), params(sent.id)));
      assert.deepEqual(result, await good("get_invoice_snapshot", { invoiceId: sent.id }));
      assert.deepEqual(result.sender, historical); // Conflicting opaque aliases are not reinterpreted.
      assert.deepEqual(await body(await GET(req(draft.id), params(draft.id))), { sender: null, recipient: null });
      assert.deepEqual(await good("get_invoice_snapshot", { invoiceId: empty.id }), { sender: null, recipient: null });
    });
    const corrected = await body(await PATCH(req(sent.id, { sender: { address: "Tehran", email: null } }), params(sent.id)));
    assert.deepEqual(corrected.sender, { ...historical, address: "Tehran", email: null });
    const mcpCorrected = await good("update_invoice_snapshot", { invoiceId: sent.id, recipient: { name: "Corrected recipient" } });
    assert.equal(mcpCorrected.recipient.taxNumber, "00029");
    assert.deepEqual(mcpCorrected, await body(await GET(req(sent.id), params(sent.id))));
    const audits = await db.select().from(auditLog).where(eq(auditLog.entityId, sent.id));
    assert.equal(audits.length, 2); assert.ok(audits.every(row => row.action === "update_snapshot" && row.organizationId === a.id));
    assert.deepEqual((audits[0].changes!.before as { sender: unknown }).sender, historical);
    await body(await PATCH(req(empty.id, { sender: { name: "First saved name" } }), params(empty.id)));
    for (const input of [{}, { sender: {} }, { recipient: {} }, { sender: { name: "" } }, { sender: { name: null } },
      { sender: { name: 1250 } }, { sender: { amount: 1250 } }, { sender: { amountMinor: "1250" } }, { recipient: { name: "X", currencyCode: "USD" } },
      { sender: null }, { recipient: { address: "a".repeat(10001) } }, { sender: { name: "X" }, organizationId: b.id }]) {
      await unchanged(async () => {
        await body(await PATCH(req(sent.id, input), params(sent.id)), 400);
        assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: sent.id, ...input })).error, true);
      });
    }
    await unchanged(async () => {
      const malformed = new Request(req(sent.id, {}).url, { method: "PATCH", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
      await body(await PATCH(malformed, params(sent.id)), 400);
      for (const id of [foreign.id, deleted.id, "00000000-0000-4000-8000-000000000000"]) {
        await body(await GET(req(id), params(id)), 404);
        await body(await PATCH(req(id, { sender: { name: "X" } }), params(id)), 404);
        assert.equal((await ma.call("get_invoice_snapshot", { invoiceId: id })).body.status, 404);
        assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: id, sender: { name: "X" } })).body.status, 404);
      }
      assert.equal((await mb.call("get_invoice_snapshot", { invoiceId: sent.id })).body.status, 404);
      assert.equal((await mb.call("update_invoice_snapshot", { invoiceId: sent.id, sender: { name: "X" } })).body.status, 404);
      await body(await GET(req(sent.id, undefined, "dk_invalid"), params(sent.id)), 401);
      await body(await PATCH(req(sent.id, { sender: { name: "X" } }, "dk_invalid"), params(sent.id)), 401);
      await body(await GET(req(sent.id, undefined, keys.denied), params(sent.id)), 403);
      await body(await PATCH(req(sent.id, { sender: { name: "X" } }, keys.denied), params(sent.id)), 403);
      assert.equal((await no.call("get_invoice_snapshot", { invoiceId: sent.id })).body.status, 403);
      assert.equal((await no.call("update_invoice_snapshot", { invoiceId: sent.id, sender: { name: "X" } })).body.status, 403);
      await body(await GET(req("bad-id"), params("bad-id")), 400);
      await body(await PATCH(req(draft.id, { sender: { name: "X" } }), params(draft.id)), 400);
      assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: draft.id, sender: { name: "X" } })).body.status, 400);
      assert.equal((await ma.call("get_invoice_snapshot", { invoiceId: sent.id, organizationId: b.id })).error, true);
    });
    // Snapshot-only reads do not accidentally decode unrelated unsafe invoice money.
    await db.execute(sql`update invoice set total=9007199254740992 where id=${sent.id}`);
    assert.equal((await good("get_invoice_snapshot", { invoiceId: sent.id })).sender.amountMinor, "9223372036854775807");
    await body(await PATCH(req(sent.id, { sender: { phone: "Preserved" } }), params(sent.id)));
    await db.execute(sql`update invoice set total=0 where id=${sent.id}`);
    for (const unsafe of [{ nested: { amount: 9007199254740992 } }, ["invalid envelope"], "invalid envelope"]) {
      await db.update(invoice).set({ senderSnapshot: unsafe }).where(eq(invoice.id, empty.id));
      await unchanged(async () => {
        assert.equal((await body(await GET(req(empty.id), params(empty.id)), 422)).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call("get_invoice_snapshot", { invoiceId: empty.id })).body.code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await body(await PATCH(req(empty.id, { sender: { name: "X" } }), params(empty.id)), 422)).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: empty.id, recipient: { name: "X" } })).body.code, "LEGACY_NUMERIC_RANGE");
      });
    }
    // PostgreSQL preserves these decimals, but the default pg JSON decoder would
    // silently turn them into a different safe-range Number before serialization.
    for (const source of ['{"amount":9007199254740990.5}', '{"amount":1.0000000000000001}', '{"amount":0.000000000000000000000000000000000000000000000000001234567890123456789}']) {
      await db.execute(sql`update invoice set sender_snapshot=${source}::jsonb where id=${empty.id}`);
      await unchanged(async () => {
        assert.equal((await body(await GET(req(empty.id), params(empty.id)), 422)).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call("get_invoice_snapshot", { invoiceId: empty.id })).body.code, "LEGACY_NUMERIC_RANGE");
        await body(await PATCH(req(empty.id, { sender: { name: "Cannot repair precision" } }), params(empty.id)), 422);
        assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: empty.id, sender: { name: "Cannot repair precision" } })).body.code, "LEGACY_NUMERIC_RANGE");
      });
    }
    const safeSource = '{"amount":0.2900,"tiny":0.0000001,"text":' + JSON.stringify('escaped "1.0000000000000001"') + '}';
    await db.execute(sql`update invoice set sender_snapshot=${safeSource}::jsonb where id=${empty.id}`);
    assert.equal((await good("get_invoice_snapshot", { invoiceId: empty.id })).sender.amount, 0.29);
    await body(await PATCH(req(empty.id, { sender: { name: "Safe decimals" } }), params(empty.id)));
    // Concurrent corrections to different fields must both survive.
    await Promise.all([
      PATCH(req(sent.id, { sender: { phone: "Concurrent phone" } }), params(sent.id)).then(r => body(r)),
      good("update_invoice_snapshot", { invoiceId: sent.id, sender: { address: "Concurrent address" } }),
    ]);
    const merged = await good("get_invoice_snapshot", { invoiceId: sent.id });
    assert.equal(merged.sender.phone, "Concurrent phone"); assert.equal(merged.sender.address, "Concurrent address");
    // A lifecycle writer can hold organization and then acquire the invoice:
    // snapshot correction must wait at organization before taking the child lock.
    const lifecycle = await pool.connect(); let correction: Promise<Response> | undefined;
    try {
      await lifecycle.query("begin");
      await lifecycle.query("select id from organization where id=$1 for update", [a.id]);
      correction = PATCH(req(sent.id, { sender: { phone: "Concurrent phone" } }), params(sent.id));
      const deadline = Date.now() + 10000; let waiting = false;
      while (Date.now() < deadline) {
        const { rows } = await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%organization%' and pid<>pg_backend_pid()");
        if (rows.length) { waiting = true; break; } await setTimeout(10);
      }
      assert.ok(waiting, "Correction must wait at the organization lock");
      await lifecycle.query("select id from invoice where id=$1 for update nowait", [sent.id]);
      await lifecycle.query("commit"); await body(await correction);
    } finally { await lifecycle.query("rollback"); lifecycle.release(); if (correction) await correction; }
    await db.execute(sql.raw("create function reject_snapshot_audit() returns trigger language plpgsql as $$ begin if NEW.action='update_snapshot' then raise exception 'fixture audit rejection'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger reject_snapshot_audit before insert on audit_log for each row execute function reject_snapshot_audit()"));
    await unchanged(async () => {
      await body(await PATCH(req(sent.id, { sender: { name: "Roll back REST" } }), params(sent.id)), 500);
      assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: sent.id, sender: { name: "Roll back MCP" } })).error, true);
    });
    await db.execute(sql.raw("drop trigger reject_snapshot_audit on audit_log"));
    const [sig] = await db.insert(invoiceSignature).values({ invoiceId: sent.id, token: "snapshot-token", signerName: "Signer", signerEmail: "signer@example.test" }).returning();
    // Hold the same row lock as public signing, then prove correction waits and
    // sees committed signed status rather than mutating immutable party history.
    const signer = await pool.connect(); let pending: Promise<Response> | undefined;
    try {
      await signer.query("begin");
      await signer.query("update invoice_signature set status='signed', signed_at=now() where id=$1", [sig.id]);
      pending = PATCH(req(sent.id, { sender: { name: "Cannot race signer" } }), params(sent.id));
      const deadline = Date.now() + 10000;
      let waiting = false;
      while (Date.now() < deadline) {
        const { rows } = await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%invoice_signature%' and pid<>pg_backend_pid()");
        if (rows.length) { waiting = true; break; } await setTimeout(10);
      }
      assert.ok(waiting, "Correction must wait for the signing row lock");
      await signer.query("commit"); await body(await pending, 409);
    } finally { await signer.query("rollback"); signer.release(); if (pending) await pending; }
    await unchanged(async () => {
      await body(await PATCH(req(sent.id, { sender: { name: "Already signed" } }), params(sent.id)), 409);
      assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: sent.id, recipient: { name: "Already signed" } })).body.status, 409);
      assert.deepEqual(await good("get_invoice_snapshot", { invoiceId: sent.id }), merged);
    });
    console.log("Invoice snapshot contracts verified: REST/full SDK MCP, legacy/exact opaque history, tenant/role isolation, locked merges, signer race and audit rollback");
  } finally { await ma.close(); await mb.close(); await no.close(); await pool.end(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
