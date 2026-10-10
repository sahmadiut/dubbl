import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { apiKey, contact, customRole, invoice, member, organization, portalAccessToken, users } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { documentMoneyText } from "../../lib/documents/render-wire";
import { getPublicInvoiceSignature } from "../../lib/api/invoice-signatures";
import { POST as create } from "../../app/api/v1/invoices/route";
import { GET as snapshot, PATCH as correct } from "../../app/api/v1/invoices/[id]/snapshot/route";
import { GET as audit } from "../../app/api/v1/audit-log/route";
import { GET as render } from "../../app/api/v1/invoices/[id]/pdf/route";
import { POST as requestSignature } from "../../app/api/v1/invoices/[id]/signature/route";
import { POST as sign } from "../../app/api/sign/[token]/route";
import { GET as portalRender } from "../../app/api/portal/[token]/invoices/[id]/pdf/route";
import { GET as payRender } from "../../app/api/pay/[token]/pdf/route";
import { GET as adminRead, PATCH as adminWrite } from "../../app/api/v1/admin/organizations/[id]/route";
import SignPage from "../../app/sign/[token]/page";

Object.assign(globalThis, { React }); // tsx JSX-preserve runtime; no browser/server.
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "MON-034", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Integration", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { async call(name: string, args: object) {
    const result = await client.callTool({ name, arguments: { ...args } });
    const text = (result.content as { text: string }[])[0].text;
    return { error: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Boundary A", slug: "boundary-a", billApprovalThreshold: 1250, mileageRate: 25 },
    { name: "Boundary B", slug: "boundary-b" },
  ]).returning();
  const [owner, denied] = await db.insert(users).values([
    { email: "boundary-owner@example.test", isSiteAdmin: true }, { email: "boundary-denied@example.test" },
  ]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No grants", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" },
    { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "owner", customRoleId: role.id }]);
  const keys = { a: "dk_boundary_a", b: "dk_boundary_b", denied: "dk_boundary_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyPrefix: "dk_boundary", keyHash: createHash("sha256").update(key).digest("hex") });
  const [customer] = await db.insert(contact).values({ organizationId: a.id, name: "Live contact", type: "customer" }).returning();
  const [portal] = await db.insert(portalAccessToken).values({ organizationId: a.id, contactId: customer.id, token: randomUUID() }).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), no = await connect({ ...ctx, userId: denied.id, permissions: [] });
  const request = (query = "", input?: unknown, key = keys.a, method?: string) => new Request(`http://fixture.test/boundary${query}`, {
    method: method ?? (input === undefined ? "GET" : "POST"), headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const tokens = (token: string, id = "") => ({ params: Promise.resolve({ token, id }) });
  const body = async (response: Response, status = 200) => { const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data; };
  const good = async (name: string, args: object) => { const result = await ma.call(name, args); assert.equal(result.error, false, JSON.stringify(result)); return result.body; };
  const state = async () => (await db.execute(sql.raw(["invoice", "invoice_line", "invoice_signature", "audit_log", "subscription", "document_email_log", "portal_activity_log"].map(name =>
    `select '${name}' as name, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as rows from "${name}" t`).join(" union all ")))).rows;
  const unchanged = async (operation: () => Promise<unknown>) => { const before = await state(); await operation(); assert.deepEqual(await state(), before); };
  const signer = { signerName: "Signer", signerEmail: "signer@example.test" };
  const summaries = async (id: string, paymentToken: string, expectedName: string, amount: string, currency: string) => {
    const result = await good("render_invoice", { id }); assert.equal(result.document.totalMinor, amount); assert.equal(result.document.currencyCode, currency);
    assert.ok(result.content.includes(expectedName)); assert.ok(result.content.includes(documentMoneyText(Number(amount), currency)));
    const response = await render(request(), params(id)); assert.equal(response.status, 200); assert.equal(await response.text(), result.content);
    for (const [name, args] of [["render_payment_link_invoice", { token: paymentToken }], ["render_portal_invoice", { token: portal.token, id }]] as const) {
      const out = await good(name, args); assert.equal(out.content, result.content);
    }
    const portalHtml = await portalRender(request(), tokens(portal.token, id)); assert.equal(portalHtml.status, 200); assert.equal(await portalHtml.text(), result.content);
    const payPdf = await payRender(request(), tokens(paymentToken)); assert.equal(payPdf.status, 200);
    assert.equal(Buffer.from(await payPdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    const pdf = await good("render_invoice", { id, format: "pdf" }); assert.equal(pdf.document.totalMinor, amount);
    assert.equal(Buffer.from(pdf.content, "base64").subarray(0, 5).toString(), "%PDF-");
    return result;
  };
  try {
    // Both real writers feed all four boundary families; physical quantity is still hundredths.
    for (const [currencyCode, legacyPrice, exactPrice, amount] of [["USD", 12.5, "12.50", "1250"], ["IRR", 1250, "1250", "1250"], ["KWD", 1.25, "1.250", "1250"]] as const) {
      const common = { contactId: customer.id, issueDate: "2024-01-01", dueDate: "2024-01-31", currencyCode };
      const legacy = (await body(await create(request("", { ...common, lines: [{ description: "Legacy", unitPrice: legacyPrice }] })), 201)).invoice;
      const exact = (await good("create_invoice", { ...common, lines: [{ description: "Exact", unitPriceMinor: amount, unitPriceExact: exactPrice }] })).invoice;
      for (const [index, row] of [legacy, exact].entries()) {
        assert.equal(row.total, 1250); assert.equal(row.totalMinor, amount);
        const paymentToken = randomUUID();
        const opaque = { name: "Frozen sender", identifier: "001250", amountMinor: "9223372036854775807", fx: "0.000000000000000001", fraction: 0.5 };
        await db.update(invoice).set({ status: "sent", senderSnapshot: opaque, recipientSnapshot: { name: "Frozen recipient" }, paymentLinkToken: paymentToken }).where(eq(invoice.id, row.id));
        const name = `Corrected ${currencyCode} ${index}`;
        const input = { recipient: { name } };
        const corrected = index === 0 ? await body(await correct(request("", input, keys.a, "PATCH"), params(row.id)))
          : await good("update_invoice_snapshot", { invoiceId: row.id, ...input });
        assert.deepEqual(corrected.sender, opaque);
        assert.deepEqual(await body(await snapshot(request(), params(row.id))), await good("get_invoice_snapshot", { invoiceId: row.id }));
        const filter = { entityId: row.id, action: "update_snapshot" };
        const history = await body(await audit(request(`?entityId=${row.id}&action=update_snapshot`)));
        assert.deepEqual(history, await good("list_audit_log", filter)); assert.equal(history.data.length, 1);
        assert.deepEqual(history.data[0].changes.after.sender, opaque); assert.equal(history.data[0].changes.after.recipient.name, name);
        assert.equal(history.data[0].changes.before.recipient.name, "Frozen recipient");
        const signing = index === 0 ? await body(await requestSignature(request("", signer), params(row.id)), 201)
          : await good("request_invoice_signature", { invoiceId: row.id, ...signer });
        assert.equal(signing.emailSent, false);
        const summary = await getPublicInvoiceSignature(signing.signature.token);
        assert.equal(summary.invoice.totalMinor, amount); assert.equal(summary.invoice.contact!.name, name);
        assert.ok(renderToStaticMarkup(await SignPage(tokens(signing.signature.token))).includes(summary.invoice.totalFormatted));
        await unchanged(() => summaries(row.id, paymentToken, name, amount, currencyCode));
        await body(await sign(request("", { signatureDataUrl: png }), tokens(signing.signature.token)));
        await unchanged(async () => {
          await body(await correct(request("", { recipient: { name: "Overwrite" } }, keys.a, "PATCH"), params(row.id)), 409);
          assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: row.id, recipient: { name: "Overwrite" } })).body.status, 409);
          await body(await sign(request("", { signatureDataUrl: png }), tokens(signing.signature.token)), 400);
          await summaries(row.id, paymentToken, name, amount, currencyCode);
          assert.deepEqual(await good("list_audit_log", filter), history);
        });
      }
    }
    // Admin quotas are counts; monetary organization aliases remain cents, independently of opaque strings.
    await body(await adminWrite(request("", { overrideInvoicesPerMonth: "25" }, keys.a, "PATCH"), params(a.id)));
    await good("update_admin_organization", { overrideContacts: 30 });
    const admin = await body(await adminRead(request(), params(a.id))); assert.deepEqual(admin, await good("get_admin_organization", {}));
    assert.equal(admin.subscription.overrideInvoicesPerMonth, 25); assert.equal(admin.subscription.overrideContacts, 30);
    assert.equal(admin.organization.billApprovalThresholdMinor, "1250"); assert.equal(admin.organization.mileageRateMinor, "25");
    const [target] = await db.insert(invoice).values({ organizationId: a.id, contactId: customer.id, invoiceNumber: "UNSIGNED", issueDate: "2024-01-01", dueDate: "2024-01-31",
      status: "sent", subtotal: 1250, total: 1250, amountDue: 1250, paymentLinkToken: randomUUID(), senderSnapshot: { name: "Saved" }, recipientSnapshot: { name: "Saved" } }).returning();
    const pending = await good("request_invoice_signature", { invoiceId: target.id, ...signer });
    await unchanged(async () => {
      for (const [key, client, status] of [[keys.b, mb, 404], [keys.denied, no, 403], ["dk_invalid", null, 401]] as const) {
        await body(await snapshot(request("", undefined, key), params(target.id)), status);
        await body(await correct(request("", { recipient: { name: "No" } }, key, "PATCH"), params(target.id)), status);
        await body(await requestSignature(request("", signer, key), params(target.id)), status);
        await body(await render(request("", undefined, key), params(target.id)), status);
        if (client) for (const [name, args] of [["get_invoice_snapshot", { invoiceId: target.id }], ["update_invoice_snapshot", { invoiceId: target.id, recipient: { name: "No" } }],
          ["request_invoice_signature", { invoiceId: target.id, ...signer }], ["render_invoice", { id: target.id }],
          ["render_payment_link_invoice", { token: target.paymentLinkToken }], ["render_portal_invoice", { token: portal.token, id: target.id }]] as const) {
          assert.equal((await client.call(name, args)).body.status, status);
        }
      }
      assert.equal((await mb.call("list_audit_log", { entityId: target.id })).body.data.length, 0);
      assert.equal((await no.call("list_audit_log", {})).body.status, 403);
      await body(await adminWrite(request("", { overrideContacts: 1 }, keys.b, "PATCH"), params(a.id)), 404);
      await body(await adminWrite(request("", { overrideContacts: 1 }, keys.denied, "PATCH"), params(a.id)), 403);
      for (const input of [{ recipient: { name: 1250 } }, { recipient: { name: "No", amountMinor: "1250" } }, { recipient: {} }, { recipient: { name: "No" }, organizationId: b.id }]) {
        await body(await correct(request("", input, keys.a, "PATCH"), params(target.id)), 400);
        assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: target.id, ...input })).error, true);
      }
    });
    // Same unsupported history is rejected before correction, signing, rendering or audit mutation.
    for (const source of ['{"name":"Saved","amount":1.0000000000000001}', '{"name":"Saved","amount":9007199254740993}', '{"name":"Saved","fx":1e-400}']) {
      await db.execute(sql`update invoice set sender_snapshot=${source}::jsonb where id=${target.id}`);
      await unchanged(async () => {
        for (const response of [await snapshot(request(), params(target.id)), await correct(request("", { recipient: { name: "No" } }, keys.a, "PATCH"), params(target.id)),
          await requestSignature(request("", signer), params(target.id)), await sign(request("", { signatureDataUrl: png }), tokens(pending.signature.token)),
          await render(request(), params(target.id)), await portalRender(request(), tokens(portal.token, target.id)), await payRender(request(), tokens(target.paymentLinkToken!))]) {
          assert.equal((await body(response, 422)).code, "LEGACY_NUMERIC_RANGE");
        }
        for (const [name, args] of [["get_invoice_snapshot", { invoiceId: target.id }], ["update_invoice_snapshot", { invoiceId: target.id, recipient: { name: "No" } }],
          ["request_invoice_signature", { invoiceId: target.id, ...signer }], ["render_invoice", { id: target.id }],
          ["render_portal_invoice", { token: portal.token, id: target.id }], ["render_payment_link_invoice", { token: target.paymentLinkToken }]] as const) {
          assert.equal((await ma.call(name, args)).body.code, "LEGACY_NUMERIC_RANGE");
        }
        assert.match(renderToStaticMarkup(await SignPage(tokens(pending.signature.token))), /cannot be displayed safely/);
      });
    }
    await db.update(invoice).set({ senderSnapshot: { name: "Safe" } }).where(eq(invoice.id, target.id));
    await db.execute(sql`update invoice set total=9007199254740992 where id=${target.id}`);
    await unchanged(async () => {
      // Party-only operations intentionally do not decode unrelated monetary headers.
      assert.equal((await body(await snapshot(request(), params(target.id)))).sender.name, "Safe");
      await good("get_invoice_snapshot", { invoiceId: target.id });
      for (const response of [await requestSignature(request("", signer), params(target.id)), await sign(request("", { signatureDataUrl: png }), tokens(pending.signature.token)),
        await render(request(), params(target.id)), await payRender(request(), tokens(target.paymentLinkToken!))]) assert.equal((await body(response, 422)).code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("render_invoice", { id: target.id })).body.code, "LEGACY_NUMERIC_RANGE");
    });
    console.log("Combined opaque public contracts verified");
  } finally { await ma.close(); await mb.close(); await no.close(); }
}
try { await run(); process.exit(0); } catch (error) { console.error(error); process.exit(1); }
