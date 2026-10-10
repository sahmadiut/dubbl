import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mock } from "node:test";
import { setTimeout } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, invoice, invoiceLine, quote, quoteLine, creditNote, creditNoteLine,
  purchaseOrder, purchaseOrderLine, debitNote, debitNoteLine, portalAccessToken, documentTemplate, documentEmailLog, emailConfig } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { documentMoneyText } from "../../lib/documents/render-wire";

const deliveries: { attachments?: { content: Buffer; filename: string }[] }[] = [];
const smtp = await import("../../lib/email/smtp-client");
mock.module(new URL("../../lib/email/smtp-client.ts", import.meta.url).href, { namedExports: { ...smtp,
  sendEmail: async (_cfg: unknown, message: typeof deliveries[number]) => { deliveries.push(message); } } });
const { registerAllTools } = await import("../../lib/mcp/tools");
const routes = [
  ["invoice", await import("../../app/api/v1/invoices/[id]/pdf/route")],
  ["quote", await import("../../app/api/v1/quotes/[id]/pdf/route")],
  ["credit_note", await import("../../app/api/v1/credit-notes/[id]/pdf/route")],
  ["purchase_order", await import("../../app/api/v1/purchase-orders/[id]/pdf/route")],
  ["debit_note", await import("../../app/api/v1/debit-notes/[id]/pdf/route")],
] as const;
const { POST: preview } = await import("../../app/api/v1/document-templates/[id]/preview/route");
const { POST: emailPreview } = await import("../../app/api/v1/document-emails/preview/route");
const { POST: resend } = await import("../../app/api/v1/document-emails/[id]/resend/route");
const { GET: portalPdf } = await import("../../app/api/portal/[token]/invoices/[id]/pdf/route");
const { GET: payPdf } = await import("../../app/api/pay/[token]/pdf/route");
const { GET: paySummary } = await import("../../app/api/pay/[token]/route");
const { GET: statementPdf } = await import("../../app/api/portal/[token]/statements/pdf/route");
const { POST: createInvoice } = await import("../../app/api/v1/invoices/route");
const { POST: sendInvoice } = await import("../../app/api/v1/invoices/[id]/send/route");

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Rendering", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  return { tools: (await client.listTools()).tools, async call(name: string, args: object) {
    const r = await client.callTool({ name, arguments: { ...args } }); const text = (r.content as { text: string }[])[0].text;
    return { error: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Render A", slug: "render-a" }, { name: "Render B", slug: "render-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "render-owner@example.test" }, { email: "render-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Denied", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "owner", customRoleId: role.id }]);
  const keys = { a: "dk_render_a", b: "dk_render_b", denied: "dk_render_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyPrefix: "dk_render", keyHash: createHash("sha256").update(key).digest("hex") });
  const [customer, foreign] = await db.insert(contact).values([{ organizationId: a.id, name: "Customer <&>", type: "customer" }, { organizationId: b.id, name: "FOREIGN_SECRET" }]).returning();
  const [portal] = await db.insert(portalAccessToken).values({ organizationId: a.id, contactId: customer.id, token: randomUUID() }).returning();
  const [template] = await db.insert(documentTemplate).values({ organizationId: a.id, name: "Default", type: "invoice", isDefault: true, footerHtml: "Saved total {{total}}" }).returning();
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), no = await connect({ ...ctx, permissions: [] });
  const request = (query = "", input?: unknown, key = keys.a) => new Request(`http://fixture.test/render${query}`, {
    method: input === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const tokenParams = (token: string, id?: string) => ({ params: Promise.resolve({ token, id: id! }) });
  const json = async (r: Response, status = 200) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const good = async (name: string, args: object) => { const r = await ma.call(name, args); assert.equal(r.error, false, JSON.stringify(r)); return r.body; };
  const pdf = async (r: Response) => { assert.equal(r.status, 200, r.status === 200 ? "" : await r.text()); assert.equal(r.headers.get("content-type"), "application/pdf");
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString(), "%PDF-"); };
  const unchanged = async (fn: () => Promise<unknown>) => {
    const snapshot = async () => (await db.execute(sql.raw(["invoice", "quote", "credit_note", "purchase_order", "debit_note", "document_email_log", "portal_activity_log", "audit_log"].map(n =>
      `select '${n}' as name, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as rows from "${n}" t`).join(" union all ")))).rows;
    const before = await snapshot(), count = deliveries.length; await fn(); assert.deepEqual(await snapshot(), before); assert.equal(deliveries.length, count);
  };
  const makeInvoice = async (currencyCode = "USD", value = 1250) => {
    const [row] = await db.insert(invoice).values({ organizationId: a.id, contactId: customer.id, invoiceNumber: `INV-${randomUUID()}`,
      issueDate: "2024-01-01", dueDate: "2024-01-31", status: "sent", currencyCode, subtotal: value, total: value, amountDue: value,
      paymentLinkToken: randomUUID(), senderSnapshot: { name: "Frozen sender" }, recipientSnapshot: { name: "Frozen recipient", address: null } }).returning();
    await db.insert(invoiceLine).values({ invoiceId: row.id, description: "Work <&>", unitPrice: value, amount: value }); return row;
  };
  try {
    for (const name of [...routes.map(([kind]) => `render_${kind}`), "preview_document_template", "render_portal_statement", "render_portal_invoice", "render_payment_link_invoice", "preview_document_email", "resend_document_email", "send_document_email"]) {
      const tool = ma.tools.find(t => t.name === name)!; assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
      assert.equal((await ma.call(name, { id: template.id, surprise: true })).error, true);
    }
    const common = { contactId: customer.id, issueDate: "2024-01-01", dueDate: "2024-01-31", currencyCode: "USD" };
    const legacy = (await json(await createInvoice(request("", { ...common, lines: [{ description: "Legacy", unitPrice: 12.5 }] })), 201)).invoice;
    const exact = (await good("create_invoice", { ...common, lines: [{ description: "Exact", unitPriceMinor: "1250", unitPriceExact: "12.50" }] })).invoice;
    for (const row of [legacy, exact]) {
      const rendered = await good("render_invoice", { id: row.id }); assert.equal(rendered.document.totalMinor, "1250"); assert.equal(rendered.document.total, 1250);
      const response = await routes[0][1].GET(request(), params(row.id)); assert.equal(response.status, 200); assert.equal(await response.text(), rendered.content);
    }
    const inv = await makeInvoice();
    const seed = { organizationId: a.id, contactId: customer.id, issueDate: "2024-01-01", subtotal: 1250, total: 1250 };
    const [q] = await db.insert(quote).values({ ...seed, quoteNumber: "Q-1", expiryDate: "2024-02-01" }).returning();
    const [cn] = await db.insert(creditNote).values({ ...seed, creditNoteNumber: "CN-1" }).returning();
    const [po] = await db.insert(purchaseOrder).values({ ...seed, poNumber: "PO-1" }).returning();
    const [dn] = await db.insert(debitNote).values({ ...seed, debitNoteNumber: "DN-1" }).returning();
    await db.insert(quoteLine).values({ quoteId: q.id, description: "Work", unitPrice: 1250, amount: 1250 });
    await db.insert(creditNoteLine).values({ creditNoteId: cn.id, description: "Work", unitPrice: 1250, amount: 1250 });
    await db.insert(purchaseOrderLine).values({ purchaseOrderId: po.id, description: "Work", unitPrice: 1250, amount: 1250 });
    await db.insert(debitNoteLine).values({ debitNoteId: dn.id, description: "Work", unitPrice: 1250, amount: 1250 });
    const ids = [inv.id, q.id, cn.id, po.id, dn.id];
    await unchanged(async () => {
      for (let i = 0; i < routes.length; i++) {
        const [kind, route] = routes[i], id = ids[i];
        const rendered = await good(`render_${kind}`, { id }); assert.equal(rendered.document.totalMinor, "1250"); assert.match(rendered.content, /\$12\.50/);
        const html = await route.GET(request(), params(id)); assert.equal(html.status, 200); assert.equal(await html.text(), rendered.content);
        await pdf(await route.GET(request("?format=pdf"), params(id)));
        const binary = await good(`render_${kind}`, { id, format: "pdf" }); assert.equal(Buffer.from(binary.content, "base64").subarray(0, 5).toString(), "%PDF-");
        for (const key of [keys.b, keys.denied, "dk_invalid"]) await json(await route.GET(request("", undefined, key), params(id)), key === keys.b ? 404 : key === keys.denied ? 403 : 401);
        await json(await route.GET(request("?format=pdf&format=html"), params(id)), 400);
        await json(await route.GET(request(), params("bad")), 400);
        await json(await route.GET(request(), params(randomUUID())), 404);
        assert.equal((await mb.call(`render_${kind}`, { id })).body.status, 404); assert.equal((await no.call(`render_${kind}`, { id })).body.status, 403);
      }
      const sample = await good("preview_document_template", { id: template.id }); assert.equal(sample.document.totalMinor, "33000");
      const response = await preview(request("", {}), params(template.id)); assert.equal(response.status, 200); assert.equal(await response.text(), sample.content);
      await pdf(await preview(request("?format=pdf", {}), params(template.id)));
      await json(await preview(request("", {}, keys.b), params(template.id)), 404); await json(await preview(request("", {}, keys.denied), params(template.id)), 403);
      await json(await preview(request("", { total: 1 }), params(template.id)), 400);
      await json(await preview(new Request("http://fixture.test/render", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" }), params(template.id)), 400);
      const props = { organizationName: "Org", contactName: "Contact", documentType: "invoice", documentNumber: "INV", amountFormatted: "$12.50" };
      assert.deepEqual(await json(await emailPreview(request("", props))), await good("preview_document_email", props));
      await json(await emailPreview(request("", { ...props, amountFormatted: 1250 })), 400); await json(await emailPreview(request("", props, keys.denied)), 403);
    });
    for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
      const row = await makeInvoice(currencyCode, Number.MAX_SAFE_INTEGER);
      const result = await good("render_invoice", { id: row.id }); assert.ok(result.content.includes(documentMoneyText(Number.MAX_SAFE_INTEGER, currencyCode)));
      assert.equal(result.document.totalMinor, "9007199254740991");
      await pdf(await routes[0][1].GET(request("?format=pdf"), params(row.id)));
      await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, row.id));
    }
    await unchanged(async () => {
      const response = await portalPdf(request(), tokenParams(portal.token, inv.id)); assert.equal(response.status, 200); assert.match(await response.text(), /Frozen recipient/);
      const scoped = await good("render_portal_invoice", { token: portal.token, id: inv.id }); assert.equal(scoped.document.totalMinor, "1250");
      assert.equal((await good("render_payment_link_invoice", { token: inv.paymentLinkToken })).document.totalMinor, "1250");
      assert.equal((await mb.call("render_payment_link_invoice", { token: inv.paymentLinkToken })).body.status, 404);
      assert.equal((await mb.call("render_portal_invoice", { token: portal.token, id: inv.id })).body.status, 404);
      await pdf(await payPdf(request(), tokenParams(inv.paymentLinkToken!)));
      await pdf(await portalPdf(request("?format=pdf"), tokenParams(portal.token, inv.id)));
      await json(await portalPdf(request(), tokenParams("missing", inv.id)), 404);
      const statement = await good("render_portal_statement", { token: portal.token, startDate: "2024-01-01", endDate: "2024-01-31" });
      assert.equal(statement.data.closingBalanceMinor, "1250");
      await pdf(await statementPdf(request("?startDate=2024-01-01&endDate=2024-01-31"), tokenParams(portal.token)));
      await json(await statementPdf(request("?startDate=bad"), tokenParams(portal.token)), 400);
      assert.equal((await mb.call("render_portal_statement", { token: portal.token })).body.status, 404);
    });
    await db.insert(emailConfig).values({ organizationId: a.id, smtpHost: "fixture", smtpUsername: "fixture", smtpPassword: "fixture", fromEmail: "from@example.test", isVerified: true });
    const send = { documentType: "invoice", documentId: inv.id, documentNumber: inv.invoiceNumber, recipientEmail: "to@example.test", recipientName: "Customer" };
    await good("send_document_email", { ...send, amountCents: 1250 });
    await good("send_document_email", { ...send, amountMinor: "1250", attachPdf: true });
    assert.equal(deliveries.length, 2);
    await unchanged(async () => {
      for (const patch of [{ amountCents: 1250, amountMinor: "1251" }, { amountMinor: "9007199254740992" }, { dueDate: "2024-02-30" }, { extra: true }])
        assert.equal((await ma.call("send_document_email", { ...send, ...patch })).error, true);
      assert.equal((await mb.call("send_document_email", send)).body.status, 404);
      assert.equal((await no.call("send_document_email", send)).body.status, 403);
    });
    const [log] = await db.insert(documentEmailLog).values({ organizationId: a.id, documentType: "invoice", documentId: inv.id,
      recipientEmail: "to@example.test", subject: "Invoice", body: "Saved email", attachPdf: true, status: "sent", sentBy: owner.id }).returning();
    await good("resend_document_email", { emailLogId: log.id }); assert.equal(deliveries.length, 3); assert.equal(deliveries[2].attachments?.[0].content.subarray(0, 5).toString(), "%PDF-");
    await json(await resend(request("", {}), params(log.id))); assert.equal(deliveries.length, 4);
    await unchanged(async () => {
      await json(await resend(request("", {}, keys.b), params(log.id)), 404); await json(await resend(request("", {}, keys.denied), params(log.id)), 403);
      assert.equal((await mb.call("resend_document_email", { emailLogId: log.id })).body.status, 404);
    });
    const bad = await makeInvoice();
    await db.execute(sql`update invoice set total = 9007199254740992 where id = ${bad.id}`);
    await unchanged(async () => {
      const result = await json(await routes[0][1].GET(request(), params(bad.id)), 422); assert.equal(result.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("render_invoice", { id: bad.id })).body.code, "LEGACY_NUMERIC_RANGE");
      await json(await payPdf(request(), tokenParams(bad.paymentLinkToken!)), 422);
    });
    await db.update(invoice).set({ total: 1250, contactId: foreign.id }).where(eq(invoice.id, bad.id));
    await unchanged(async () => { await json(await routes[0][1].GET(request(), params(bad.id)), 404); await json(await payPdf(request(), tokenParams(bad.paymentLinkToken!)), 404); });
    await db.update(invoice).set({ contactId: customer.id, deletedAt: new Date() }).where(eq(invoice.id, bad.id));
    await unchanged(async () => { await json(await routes[0][1].GET(request(), params(bad.id)), 404); });
    await db.update(invoice).set({ recipientSnapshot: { name: 1250 } }).where(eq(invoice.id, inv.id));
    await unchanged(async () => { await json(await resend(request("", {}), params(log.id)), 422); await json(await portalPdf(request(), tokenParams(portal.token, inv.id)), 422); });
    await db.execute(sql`update invoice set recipient_snapshot = '{"name":"Saved","opaque":0.1234567890123456789}'::jsonb where id = ${inv.id}`);
    await unchanged(async () => { await json(await routes[0][1].GET(request(), params(inv.id)), 422); });
    await db.update(invoice).set({ recipientSnapshot: { name: "Saved" } }).where(eq(invoice.id, inv.id));
    await db.update(invoiceLine).set({ amount: Number.MAX_SAFE_INTEGER, taxAmount: 1 }).where(eq(invoiceLine.invoiceId, inv.id));
    await unchanged(async () => { await json(await paySummary(request(), tokenParams(inv.paymentLinkToken!)), 422); });
    await db.update(invoiceLine).set({ amount: 1250, taxAmount: 0 }).where(eq(invoiceLine.invoiceId, inv.id));
    const mixed = await makeInvoice("IRR");
    await unchanged(async () => {
      await json(await statementPdf(request("?startDate=2024-01-01&endDate=2024-01-31"), tokenParams(portal.token)), 422);
      const filtered = await good("render_portal_statement", { token: portal.token, startDate: "2024-01-01", endDate: "2024-01-31", currencyCode: "IRR" });
      assert.equal(filtered.data.closingBalanceMinor, "1250"); assert.match(filtered.content, /1,250/);
    });
    await db.update(invoice).set({ deletedAt: new Date() }).where(eq(invoice.id, mixed.id));
    await db.update(invoice).set({ senderSnapshot: { name: 10 } }).where(eq(invoice.id, legacy.id));
    await unchanged(async () => { await json(await sendInvoice(request("", { sendEmail: true, attachPdf: true, recipientEmail: "to@example.test", subject: "Invoice",
      templateProps: { organizationName: "Org", contactName: "Customer", documentType: "invoice", documentNumber: "INV" } }), params(legacy.id)), 422); });
    await db.update(portalAccessToken).set({ expiresAt: new Date("2000-01-01") }).where(eq(portalAccessToken.id, portal.id));
    await unchanged(async () => { await json(await statementPdf(request(), tokenParams(portal.token)), 410); });
    console.log("Document rendering contracts verified");
  } finally { await ma.close(); await mb.close(); await no.close(); await setTimeout(100); }
}
await run();
process.exit(0);
