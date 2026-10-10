import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock } from "node:test";
import { setTimeout } from "node:timers/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { eq, sql } from "drizzle-orm";
import pg from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { apiKey, auditLog, contact, customRole, emailConfig, invoice, invoiceSignature, member, organization, users } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";

// Only SMTP delivery is replaced; real handlers/services/SDK/database execute.
const deliveries: { to: string; subject: string; html: string }[] = [];
let failEmail = false;
const smtp = await import("../../lib/email/smtp-client");
mock.module(new URL("../../lib/email/smtp-client.ts", import.meta.url).href, {
  namedExports: { ...smtp, sendEmail: async (_cfg: unknown, message: typeof deliveries[number]) => {
    if (failEmail) throw new Error("Fixture SMTP rejection");
    deliveries.push(message);
  } },
});
Object.assign(globalThis, { React }); // tsx JSX-preserve fixture runtime only.
const { registerAllTools } = await import("../../lib/mcp/tools");
const { POST: requestSignature, GET: listSignatures } = await import("../../app/api/v1/invoices/[id]/signature/route");
const { POST: resend } = await import("../../app/api/v1/invoices/[id]/signature/resend/route");
const { POST: sign } = await import("../../app/api/sign/[token]/route");
const { PATCH: correct } = await import("../../app/api/v1/invoices/[id]/snapshot/route");
const { POST: create } = await import("../../app/api/v1/invoices/route");
const { default: SignPage } = await import("../../app/sign/[token]/page");
const { getPublicInvoiceSignature } = await import("../../lib/api/invoice-signatures");

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Signing fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { tools: (await client.listTools()).tools, async call(name: string, args: object) {
    const r = await client.callTool({ name, arguments: { ...args } }); const text = (r.content as { text: string }[])[0].text;
    return { error: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Signing A", slug: "signing-a" }, { name: "Signing B", slug: "signing-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "sign-owner@example.test" }, { email: "sign-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No grants", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "owner", customRoleId: role.id }]);
  const keys = { a: "dk_sign_a", b: "dk_sign_b", denied: "dk_sign_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyPrefix: "dk_sign", keyHash: createHash("sha256").update(key).digest("hex") });
  const [localContact, foreignContact] = await db.insert(contact).values([
    { organizationId: a.id, name: "Current name" }, { organizationId: b.id, name: "FOREIGN_SECRET" },
  ]).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), no = await connect({ ...ctx, userId: denied.id, permissions: [] });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const request = (id: string, input?: unknown, key = keys.a) => new Request(`http://fixture.test/api/v1/invoices/${id}/signature`, {
    method: input === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const tokenParams = (token: string) => ({ params: Promise.resolve({ token }) });
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  const publicRequest = (token: string, input: unknown = { signatureDataUrl: png }) => new Request(`http://fixture.test/api/sign/${token}`, {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.7, 127.0.0.8", "user-agent": "Signing fixture" }, body: JSON.stringify(input),
  });
  const body = async (r: Response, status = 200) => { const data = await r.json(); assert.equal(r.status, status, JSON.stringify(data)); return data; };
  const good = async (name: string, args: object) => { const r = await ma.call(name, args); assert.equal(r.error, false, JSON.stringify(r)); return r.body; };
  const signer = { signerName: "Signer <&>", signerEmail: "signer@example.test" };
  const snapshot = async () => (await db.execute(sql.raw(["invoice", "invoice_signature", "audit_log"].map(n =>
    `select '${n}' as name, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as rows from "${n}" t`).join(" union all ")))).rows;
  const unchanged = async (fn: () => Promise<unknown>) => { const before = await snapshot(), count = deliveries.length; await fn();
    assert.deepEqual(await snapshot(), before); assert.equal(deliveries.length, count); };
  const make = async (currencyCode = "USD", amount = 1250) => (await db.insert(invoice).values({ organizationId: a.id, contactId: localContact.id,
    invoiceNumber: `SIGN-${crypto.randomUUID()}`, issueDate: "2024-01-01", dueDate: "2024-01-31", status: "sent", currencyCode,
    subtotal: amount, total: amount, amountDue: amount, senderSnapshot: { name: "Saved sender", amountMinor: "9223372036854775807" },
    recipientSnapshot: { name: "Frozen recipient" } }).returning())[0];
  const addSig = async (id: string, patch: Partial<typeof invoiceSignature.$inferInsert> = {}) => (await db.insert(invoiceSignature).values({
    invoiceId: id, token: crypto.randomUUID(), ...signer, ...patch }).returning())[0];
  try {
    for (const name of ["request_invoice_signature", "get_invoice_signature", "resend_signature_request"]) {
      const tool = ma.tools.find(t => t.name === name)!; assert.equal(tool.inputSchema.additionalProperties, false);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
    }
    // Real legacy/exact invoice writers feed both signing transports unchanged.
    const common = { contactId: localContact.id, issueDate: "2024-01-01", dueDate: "2024-01-31", currencyCode: "USD" };
    const legacy = (await body(await create(request("", { ...common, lines: [{ description: "Legacy", unitPrice: 12.5 }] })), 201)).invoice;
    const exact = (await good("create_invoice", { ...common, lines: [{ description: "Exact", unitPriceMinor: "1250", unitPriceExact: "12.50" }] })).invoice;
    for (const row of [legacy, exact]) { assert.equal(row.total, 1250); assert.equal(row.totalMinor, "1250"); }
    const first = await body(await requestSignature(request(legacy.id, signer), params(legacy.id)), 201);
    assert.equal(first.emailSent, false); assert.equal(first.signature.status, "pending"); assert.equal(first.signature.expiresAt, null);
    const second = await good("request_invoice_signature", { invoiceId: exact.id, ...signer, expiresAt: "2099-01-01T01:00:00+01:00" });
    assert.equal(second.emailSent, false); assert.equal(second.signature.expiresAt, "2099-01-01T00:00:00.000Z");
    const sig = first.signature;
    assert.deepEqual(await body(await listSignatures(request(legacy.id), params(legacy.id))), await good("get_invoice_signature", { invoiceId: legacy.id }));
    assert.equal((await getPublicInvoiceSignature(sig.token)).invoice.totalMinor, "1250");
    const html = renderToStaticMarkup(await SignPage(tokenParams(sig.token)));
    assert.match(html, /\$12\.50/); assert.match(html, /Draw your signature/);
    await unchanged(async () => {
      await body(await resend(request(legacy.id, {}), params(legacy.id)), 400);
      assert.equal((await ma.call("resend_signature_request", { invoiceId: legacy.id })).body.status, 400);
      for (const id of [crypto.randomUUID(), "bad-id"]) {
        await body(await listSignatures(request(id), params(id)), id === "bad-id" ? 400 : 404);
      }
      for (const key of [keys.b, keys.denied, "dk_invalid"]) {
        const status = key === keys.b ? 404 : key === keys.denied ? 403 : 401;
        await body(await listSignatures(request(legacy.id, undefined, key), params(legacy.id)), status);
        await body(await requestSignature(request(legacy.id, signer, key), params(legacy.id)), status);
        await body(await resend(request(legacy.id, {}, key), params(legacy.id)), status);
      }
      for (const client of [mb, no]) for (const name of ["request_invoice_signature", "get_invoice_signature", "resend_signature_request"]) {
        const r = await client.call(name, { invoiceId: legacy.id, ...(name === "request_invoice_signature" ? signer : {}) });
        assert.equal(r.body.status, client === mb ? 404 : 403);
      }
      for (const input of [{}, { ...signer, signerName: " " }, { ...signer, signerEmail: "invalid" }, { ...signer, signerName: 1250 },
        { ...signer, expiresAt: "invalid" }, { ...signer, expiresAt: "2020-01-01T00:00:00Z" }, { ...signer, expiresAt: null },
        { ...signer, organizationId: b.id }, { ...signer, totalMinor: "1250" }]) {
        await body(await requestSignature(request(legacy.id, input), params(legacy.id)), 400);
        assert.equal((await ma.call("request_invoice_signature", { invoiceId: legacy.id, ...input })).error, true);
      }
      assert.equal((await ma.call("get_invoice_signature", { invoiceId: legacy.id, organizationId: b.id })).error, true);
      assert.equal((await ma.call("resend_signature_request", { invoiceId: legacy.id, organizationId: b.id })).error, true);
      await body(await resend(request(legacy.id, { organizationId: b.id }), params(legacy.id)), 400);
      await body(await requestSignature(new Request(request(legacy.id).url, { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" }), params(legacy.id)), 400);
      for (const input of [{}, { signatureDataUrl: "javascript:alert(1)" }, { signatureDataUrl: "data:image/svg+xml;base64,AAAA" },
        { signatureDataUrl: "data:image/png;base64,AAAA" }, { signatureDataUrl: 1 }, { signatureDataUrl: png, totalMinor: "1250" },
        { signatureDataUrl: "x".repeat(1049001) }]) await body(await sign(publicRequest(sig.token, input), tokenParams(sig.token)), 400);
      await body(await sign(publicRequest("missing-token"), tokenParams("missing-token")), 404);
      await body(await sign(publicRequest("invalid/token"), tokenParams("invalid/token")), 400);
      for (const token of ["missing-token", "invalid/token"]) await assert.rejects(() => SignPage(tokenParams(token)), /NEXT_HTTP_ERROR_FALLBACK;404/);
      await body(await sign(new Request(publicRequest(sig.token).url, { method: "POST", body: "{" }), tokenParams(sig.token)), 400);
    });
    // No extra rescaling: zero-, two- and three-decimal currencies, negative subunit and safe upper limit.
    for (const [currency, amount, expected] of [["IRR", 1250, /1,250/], ["KWD", 1250, /1\.250/], ["USD", -1, /-\$0\.01/],
      ["USD", Number.MAX_SAFE_INTEGER, /90,071,992,547,409\.91/], ["USD", Number.MIN_SAFE_INTEGER, /-\$90,071,992,547,409\.91/]] as const) {
      const inv = await make(currency, amount), s = await addSig(inv.id);
      const data = await getPublicInvoiceSignature(s.token); assert.equal(data.invoice.totalMinor, String(amount));
      assert.match(renderToStaticMarkup(await SignPage(tokenParams(s.token))), expected);
      assert.match(renderToStaticMarkup(await SignPage(tokenParams(s.token))), /Frozen recipient/);
      await body(await sign(publicRequest(s.token), tokenParams(s.token)));
    }
    const unsafe = await make(), unsafeSig = await addSig(unsafe.id);
    for (const field of ["subtotal", "tax_total", "total", "amount_paid", "amount_due"]) {
      await db.execute(sql.raw(`update invoice set ${field}=9007199254740992 where id='${unsafe.id}'`));
      await unchanged(async () => {
        assert.equal((await body(await requestSignature(request(unsafe.id, signer), params(unsafe.id)), 422)).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call("request_invoice_signature", { invoiceId: unsafe.id, ...signer })).body.code, "LEGACY_NUMERIC_RANGE");
        await body(await listSignatures(request(unsafe.id), params(unsafe.id)), 422);
        assert.equal((await ma.call("get_invoice_signature", { invoiceId: unsafe.id })).body.code, "LEGACY_NUMERIC_RANGE");
        await body(await resend(request(unsafe.id, {}), params(unsafe.id)), 422);
        assert.equal((await ma.call("resend_signature_request", { invoiceId: unsafe.id })).body.code, "LEGACY_NUMERIC_RANGE");
        await body(await sign(publicRequest(unsafeSig.token), tokenParams(unsafeSig.token)), 422);
        assert.match(renderToStaticMarkup(await SignPage(tokenParams(unsafeSig.token))), /cannot be displayed safely/);
      });
      await db.execute(sql.raw(`update invoice set ${field}=0 where id='${unsafe.id}'`));
    }
    for (const source of ['{"amount":1.0000000000000001}', '{"amount":9223372036854775807}', '["wrong envelope"]']) {
      await db.execute(sql`update invoice set sender_snapshot=${source}::jsonb where id=${unsafe.id}`);
      await unchanged(async () => {
        await body(await requestSignature(request(unsafe.id, signer), params(unsafe.id)), 422);
        assert.equal((await ma.call("request_invoice_signature", { invoiceId: unsafe.id, ...signer })).body.code, "LEGACY_NUMERIC_RANGE");
        await body(await sign(publicRequest(unsafeSig.token), tokenParams(unsafeSig.token)), 422);
      });
    }
    await db.update(invoice).set({ senderSnapshot: null, contactId: foreignContact.id }).where(eq(invoice.id, unsafe.id));
    await unchanged(async () => {
      await body(await sign(publicRequest(unsafeSig.token), tokenParams(unsafeSig.token)), 422);
      await body(await requestSignature(request(unsafe.id, signer), params(unsafe.id)), 422);
      const text = renderToStaticMarkup(await SignPage(tokenParams(unsafeSig.token))); assert.doesNotMatch(text, /FOREIGN_SECRET/);
    });
    await db.update(invoice).set({ contactId: localContact.id, deletedAt: new Date() }).where(eq(invoice.id, unsafe.id));
    await unchanged(async () => {
      for (const fn of [requestSignature, resend]) await body(await fn(request(unsafe.id, signer), params(unsafe.id)), fn === resend ? 400 : 404);
      await body(await listSignatures(request(unsafe.id), params(unsafe.id)), 404);
      await body(await sign(publicRequest(unsafeSig.token), tokenParams(unsafeSig.token)), 404);
      await assert.rejects(() => SignPage(tokenParams(unsafeSig.token)), /NEXT_HTTP_ERROR_FALLBACK;404/);
      for (const name of ["request_invoice_signature", "get_invoice_signature", "resend_signature_request"]) {
        assert.equal((await ma.call(name, { invoiceId: unsafe.id, ...(name === "request_invoice_signature" ? signer : {}) })).body.status, 404);
      }
    });
    // Explicit status/expiry rejection never rewrites history.
    for (const patch of [{ status: "signed" as const, signatureDataUrl: png, signedAt: new Date() }, { status: "declined" as const },
      { status: "expired" as const }, { expiresAt: new Date("2000-01-01T00:00:00Z") }]) {
      const s = await addSig(exact.id, patch);
      await unchanged(async () => { await body(await sign(publicRequest(s.token), tokenParams(s.token)), 400); });
      const text = renderToStaticMarkup(await SignPage(tokenParams(s.token)));
      assert.match(text, patch.status === "signed" ? /Already Signed/ : patch.status === "declined" ? /Signature Declined/ : /Link Expired/);
      assert.doesNotMatch(text, /Draw your signature/);
    }
    const inactive = await make(); await addSig(inactive.id, { status: "declined" }); await addSig(inactive.id, { status: "expired" });
    await unchanged(async () => { await body(await resend(request(inactive.id, {}), params(inactive.id)), 404);
      assert.equal((await ma.call("resend_signature_request", { invoiceId: inactive.id })).body.status, 404); });
    // Record actual email adapter calls without opening any provider connection.
    await db.insert(emailConfig).values({ organizationId: a.id, smtpHost: "fixture.test", smtpPort: 587, smtpUsername: "fixture",
      smtpPassword: "unused", fromEmail: "sender@example.test" });
    const emailed = await body(await requestSignature(request(legacy.id, signer), params(legacy.id)), 201);
    assert.equal(emailed.emailSent, true); assert.match(deliveries.at(-1)!.html, /Signer &lt;&amp;&gt;/);
    assert.match(deliveries.at(-1)!.html, new RegExp(`http://fixture.test/sign/${emailed.signature.token}`));
    const newest = await good("request_invoice_signature", { invoiceId: legacy.id, signerName: "Newest", signerEmail: "newest@example.test" });
    const expiredNewer = await addSig(legacy.id, { requestedAt: new Date("2099-01-01"), expiresAt: new Date("2000-01-01") });
    assert.equal((await good("resend_signature_request", { invoiceId: legacy.id })).resentTo, "newest@example.test");
    assert.match(deliveries.at(-1)!.html, new RegExp(newest.signature.token)); assert.doesNotMatch(deliveries.at(-1)!.html, new RegExp(expiredNewer.token));
    const noBody = new Request(request(legacy.id).url, { method: "POST", headers: { authorization: `Bearer ${keys.a}` } });
    await body(await resend(noBody, params(legacy.id)));
    failEmail = true;
    await unchanged(async () => {
      await body(await requestSignature(request(legacy.id, signer), params(legacy.id)), 500);
      assert.equal((await ma.call("request_invoice_signature", { invoiceId: legacy.id, ...signer })).error, true);
    });
    failEmail = false;
    // Two actual public handlers compete: one commits, the loser cannot replace it.
    const results = await Promise.all([sign(publicRequest(sig.token), tokenParams(sig.token)), sign(publicRequest(sig.token), tokenParams(sig.token))]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    const signed = await body(results.find(r => r.status === 200)!); assert.equal(signed.signature.ipAddress, "127.0.0.7");
    await unchanged(async () => { await body(await sign(publicRequest(sig.token), tokenParams(sig.token)), 400); });
    const race = await make(), raceSig = await addSig(race.id);
    const [signedRace, correctedRace] = await Promise.all([
      sign(publicRequest(raceSig.token), tokenParams(raceSig.token)),
      correct(new Request(`http://fixture.test/api/v1/invoices/${race.id}/snapshot`, { method: "PATCH", headers: { authorization: `Bearer ${keys.a}` },
        body: JSON.stringify({ recipient: { name: "Concurrent correction" } }) }), params(race.id)),
    ]);
    const signedRow = (await body(signedRace)).signature; assert.ok([200, 409].includes(correctedRace.status));
    const audits = await db.select().from(auditLog).where(eq(auditLog.entityId, race.id));
    if (correctedRace.status === 200) {
      assert.equal(audits.length, 1); assert.ok(audits[0].createdAt <= new Date(signedRow.signedAt));
      assert.equal((await getPublicInvoiceSignature(raceSig.token)).invoice.contact!.name, "Concurrent correction");
    } else assert.equal(audits.length, 0);
    await unchanged(async () => { await body(await correct(new Request(request(race.id).url, { method: "PATCH", headers: { authorization: `Bearer ${keys.a}` },
      body: JSON.stringify({ sender: { name: "Cannot edit signed" } }) }), params(race.id)), 409); });
    // Deterministic lock wait: signing checks expiry AFTER the snapshot/lifecycle lock releases.
    const expiring = await addSig(exact.id, { expiresAt: new Date(Date.now() + 1000) });
    const locker = await pool.connect(); let pending: Promise<Response> | undefined;
    try {
      await locker.query("begin"); await locker.query("select id from organization where id=$1 for update", [a.id]);
      pending = sign(publicRequest(expiring.token), tokenParams(expiring.token));
      const deadline = Date.now() + 5000; let waiting = false;
      while (Date.now() < deadline) {
        const { rows } = await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%organization%' and pid<>pg_backend_pid()");
        if (rows.length) { waiting = true; break; } await setTimeout(10);
      }
      assert.ok(waiting, "Signing must wait at organization before locking invoice");
      await locker.query("select id from invoice where id=$1 for update nowait", [exact.id]);
      await setTimeout(Math.max(0, expiring.expiresAt!.getTime() - Date.now() + 10));
      await locker.query("commit"); await body(await pending, 400);
      const [saved] = await db.select().from(invoiceSignature).where(eq(invoiceSignature.id, expiring.id)); assert.equal(saved.status, "pending");
    } finally { await locker.query("rollback"); locker.release(); if (pending) await pending; }
    // Deactivated organizations invalidate public capabilities too.
    await db.update(organization).set({ deletedAt: new Date() }).where(eq(organization.id, a.id));
    await unchanged(async () => { await body(await sign(publicRequest(second.signature.token), tokenParams(second.signature.token)), 404);
      await assert.rejects(() => SignPage(tokenParams(second.signature.token)), /NEXT_HTTP_ERROR_FALLBACK;404/); });
    console.log("Invoice signing contracts verified: actual REST/SSR/full SDK MCP, exact/legacy money, tenant/status/expiry guards, SMTP capture/rollback and signature/snapshot races");
  } finally { await ma.close(); await mb.close(); await no.close(); await pool.end(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
