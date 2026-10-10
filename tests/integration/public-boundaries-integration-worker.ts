import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { apiKey, contact, customRole, inventoryItem, invoice, member, organization, portalAccessToken, subscription, users, webhook } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { stripe } from "../../lib/stripe";
import { deliverWebhook } from "../../lib/webhooks/deliver";
import { parseCSV } from "../../lib/import-export/csv-utils";
import { documentMoneyText } from "../../lib/documents/render-wire";
import { POST as importContacts } from "../../app/api/v1/bulk/contacts/import/route";
import { POST as importProducts } from "../../app/api/v1/bulk/products/import/route";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { GET as exportInvoices } from "../../app/api/v1/export/invoices/route";
import { GET as downloadSnapshot } from "../../app/api/v1/backups/download-snapshot/route";
import { POST as uploadSnapshot } from "../../app/api/v1/backups/upload/route";
import { POST as restore } from "../../app/api/v1/backups/[id]/restore/route";
import { GET as pay } from "../../app/api/pay/[token]/route";
import { GET as portalInvoices } from "../../app/api/portal/[token]/invoices/route";
import { GET as portalPayments } from "../../app/api/v1/portal/[token]/payments/route";
import { GET as statement } from "../../app/api/v1/portal/[token]/statements/route";
import { PATCH as correct } from "../../app/api/v1/invoices/[id]/snapshot/route";
import { POST as signature } from "../../app/api/v1/invoices/[id]/signature/route";
import { POST as sign } from "../../app/api/sign/[token]/route";
import { GET as render } from "../../app/api/v1/invoices/[id]/pdf/route";
import { POST as checkout } from "../../app/api/pay/[token]/checkout/route";
import { POST as signedCheckout } from "../../app/api/stripe/webhook/route";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "MON-016", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Integration", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { async call(name: string, args: object = {}) {
    const result = await client.callTool({ name, arguments: { ...args } });
    const text = (result.content as { text: string }[])[0].text;
    return { error: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Public A", slug: "public-a" }, { name: "Public B", slug: "public-b" }]).returning();
  await db.insert(subscription).values({ organizationId: a.id, plan: "pro", status: "active" });
  const [owner, denied] = await db.insert(users).values([{ email: "public-owner@example.test" }, { email: "public-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No grants", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_public_a", b: "dk_public_b", denied: "dk_public_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyPrefix: "dk_public", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), no = await connect({ ...ctx, userId: denied.id, role: "member", permissions: [] });
  const req = (input?: unknown, key = keys.a, method?: string) => new Request("https://fixture.test/boundary", {
    method: method ?? (input === undefined ? "GET" : "POST"), headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const tokens = (token: string) => ({ params: Promise.resolve({ token }) });
  const body = async (response: Response, status = 200) => { const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data; };
  const good = async (name: string, args: object = {}) => { const result = await ma.call(name, args); assert.equal(result.error, false, JSON.stringify(result)); return result.body; };
  const state = async () => (await db.execute(sql.raw(["contact", "inventory_item", "invoice", "invoice_line", "invoice_signature", "payment", "payment_allocation", "data_backup",
    "bulk_import_job", "audit_log", "portal_activity_log", "webhook_delivery", "inventory_movement", "inventory_cost_layer", "journal_entry", "journal_line", "number_sequence", "notification", "document_email_log"].map(name =>
    `select '${name}' as name, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as rows from "${name}" t`).join(" union all ")))).rows;
  const objects = new Map<string, string>();
  let checkoutCalls = 0, deliveries = 0;
  const unchanged = async (operation: () => Promise<unknown>) => {
    const before = await state(), storage = [...objects], calls = [checkoutCalls, deliveries];
    await operation(); assert.deepEqual(await state(), before); assert.deepEqual([...objects], storage); assert.deepEqual([checkoutCalls, deliveries], calls);
  };
  const originalS3 = S3Client.prototype.send, originalFetch = globalThis.fetch, originalCheckout = stripe!.checkout.sessions.create;
  S3Client.prototype.send = (async function(command: PutObjectCommand | GetObjectCommand) {
    const key = command.input.Key!;
    if (command instanceof PutObjectCommand) { assert.ok(!objects.has(key)); objects.set(key, Buffer.from(command.input.Body as Buffer).toString()); return {}; }
    if (command instanceof GetObjectCommand) { assert.ok(objects.has(key)); return { Body: { transformToString: async () => objects.get(key)! } }; }
    throw new Error("Unexpected S3 operation");
  }) as typeof S3Client.prototype.send;
  const sessions: Stripe.Checkout.SessionCreateParams[] = [];
  stripe!.checkout.sessions.create = (async (input: Stripe.Checkout.SessionCreateParams) => {
    checkoutCalls++; sessions.push(structuredClone(input)); return { url: "https://checkout.stripe.test/session" };
  }) as Stripe["checkout"]["sessions"]["create"];
  globalThis.fetch = (async (url, init) => {
    assert.equal(String(url), "https://sink.example.test"); deliveries++;
    assert.equal(new Headers(init?.headers).get("X-Dubbl-Signature"), createHmac("sha256", "fixture_secret").update(String(init!.body)).digest("hex"));
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  const uploadRequest = (json: string, key = keys.a) => {
    const data = new FormData(); data.set("file", new File([json], "snapshot.json", { type: "application/json" }));
    return new Request("https://fixture.test/upload", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: data });
  };
  const signed = (session: object, corrupt = false) => {
    const text = JSON.stringify({ id: "evt_public", object: "event", type: "checkout.session.completed", data: { object: session } });
    const header = stripe!.webhooks.generateTestHeaderString({ payload: text, secret: "whsec_fixture" });
    return new Request("https://fixture.test/webhook", { method: "POST", headers: { "stripe-signature": corrupt ? "invalid" : header }, body: text });
  };
  try {
    // Generic prices stay fixed-two; the saved integer is reused explicitly by the currency-aware document writer.
    await body(await importProducts(req({ fileName: "legacy.csv", rows: [{ name: "Legacy product", unitPrice: "12.50" }] })), 201);
    await good("import_csv_data", { entityType: "products", csvContent: "name,unitPriceMinor\nExact product,1250" });
    const products = await db.select().from(inventoryItem).orderBy(inventoryItem.createdAt); assert.deepEqual(products.map(p => p.salePrice), [1250, 1250]);
    const records: { id: string; contactId: string; currency: string; token: string; portal: string }[] = [];
    for (const [currency, major] of [["USD", 12.5], ["IRR", 1250], ["KWD", 1.25]] as const) {
      for (const mode of ["legacy", "exact"] as const) {
        const name = `${currency} ${mode}`;
        if (mode === "legacy") await body(await importContacts(req({ fileName: "contacts.csv", rows: [{ name, type: "customer" }] })), 201);
        else await good("import_csv_data", { entityType: "contacts", csvContent: `name,type\n${name},customer` });
        const customer = (await db.select().from(contact).where(eq(contact.name, name)))[0];
        const common = { contactId: customer.id, issueDate: "2024-01-01", dueDate: "2024-01-31", currencyCode: currency };
        const saved = mode === "legacy" ? (await body(await createInvoice(req({ ...common, lines: [{ description: name, unitPrice: major }] })), 201)).invoice
          : (await good("create_invoice", { ...common, lines: [{ description: name, unitPriceMinor: String(products[1].salePrice) }] })).invoice;
        assert.equal(saved.total, 1250); assert.equal(saved.totalMinor, "1250");
        const token = randomUUID();
        await db.update(invoice).set({ status: "sent", paymentLinkToken: token }).where(eq(invoice.id, saved.id));
        records.push({ id: saved.id, contactId: customer.id, currency, token, portal: "" });
      }
    }
    const csv = await (await exportInvoices(req())).text(); assert.equal(csv, (await good("export_csv_data", { entityType: "invoices" })).csv);
    const rows = parseCSV(csv).rows; assert.equal(rows.length, 6);
    for (const row of rows) { assert.equal(row.lineAmount, "12.50"); assert.equal(row.lineAmountMinor, "1250"); }
    const snapshot = await body(await downloadSnapshot(req())); assert.equal(snapshot.version, 2);
    assert.deepEqual(snapshot.entities, (await good("download_backup_snapshot")).snapshot.entities);
    for (const row of snapshot.entities.invoices) { assert.equal(row.totalMinor, "1250"); assert.equal(row.lines[0].amountMinor, "1250"); }
    const exactJson = JSON.stringify(snapshot), uploaded = (await body(await uploadSnapshot(uploadRequest(exactJson)))).backup;
    const legacy = structuredClone(snapshot); legacy.version = 1;
    for (const rows of Object.values(legacy.entities) as Record<string, unknown>[][]) for (const row of rows) {
      for (const target of [row, ...((row.lines ?? []) as Record<string, unknown>[])]) for (const key of Object.keys(target)) if (key.endsWith("Minor")) delete target[key];
    }
    const legacyJson = JSON.stringify(legacy), old = (await good("upload_backup", { snapshotJson: legacyJson })).backup;
    assert.equal(objects.get(uploaded.fileKey), exactJson); assert.equal(objects.get(old.fileKey), legacyJson);
    for (const [backup, transport] of [[uploaded, "rest"], [old, "mcp"]] as const) {
      await db.update(invoice).set({ total: 999, amountDue: 999 }).where(eq(invoice.id, records[0].id));
      const out = transport === "rest" ? await body(await restore(req({ confirm: true }), params(backup.id))) : await good("restore_backup", { backupId: backup.id, confirm: true });
      if (transport === "rest") assert.equal(out.success, true);
      const counts = transport === "rest" ? out.restoredCounts.restoredCounts : out.restoredCounts;
      assert.equal(counts.invoices, 6); assert.equal(counts["invoices.lines"], 6);
      assert.equal(await (await exportInvoices(req())).text(), csv);
    }
    assert.equal((await good("download_backup", { backupId: uploaded.id })).snapshotJson, exactJson);
    assert.equal((await good("download_backup", { backupId: old.id })).snapshotJson, legacyJson);
    const opaque = { name: "Frozen sender", identifier: "001250", amountMinor: "9223372036854775807", fx: "0.000000000000000001" };
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    for (const [index, row] of records.entries()) {
      const [portal] = await db.insert(portalAccessToken).values({ organizationId: a.id, contactId: row.contactId, token: randomUUID() }).returning(); row.portal = portal.token;
      await db.update(invoice).set({ senderSnapshot: opaque }).where(eq(invoice.id, row.id));
      const correction = { recipient: { name: `Saved ${row.currency} ${index}` } };
      if (index % 2 === 0) await body(await correct(req(correction, keys.a, "PATCH"), params(row.id)));
      else await good("update_invoice_snapshot", { invoiceId: row.id, ...correction });
      assert.deepEqual(await body(await pay(req(), tokens(row.token))), await good("get_payment_link", { token: row.token }));
      const publicList = await body(await portalInvoices(req(), tokens(row.portal)));
      assert.deepEqual(publicList, await good("list_portal_invoices", { token: row.portal })); assert.equal(publicList.data[0].totalMinor, "1250");
      const statementBody = await body(await statement(req(), tokens(row.portal)));
      assert.deepEqual(statementBody, await good("get_portal_statement", { token: row.portal })); assert.equal(statementBody.totalOutstandingMinor, "1250");
      const html = await good("render_invoice", { id: row.id }); assert.equal(html.document.totalMinor, "1250");
      assert.ok(html.content.includes(documentMoneyText(1250, row.currency))); assert.ok(html.content.includes(correction.recipient.name));
      assert.equal(await (await render(req(), params(row.id))).text(), html.content);
      assert.equal((await good("render_payment_link_invoice", { token: row.token })).content, html.content);
      assert.equal((await good("render_portal_invoice", { token: row.portal, id: row.id })).content, html.content);
      const signer = { signerName: "Signer", signerEmail: "signer@example.test" };
      const signing = index % 2 === 0 ? await body(await signature(req(signer), params(row.id)), 201)
        : await good("request_invoice_signature", { invoiceId: row.id, ...signer });
      await body(await sign(req({ signatureDataUrl: png }), tokens(signing.signature.token)));
      await unchanged(async () => {
        await body(await correct(req(correction, keys.a, "PATCH"), params(row.id)), 409);
        assert.equal((await ma.call("update_invoice_snapshot", { invoiceId: row.id, ...correction })).body.status, 409);
        assert.deepEqual((await good("get_invoice_snapshot", { invoiceId: row.id })).sender, opaque);
      });
      if (row.currency !== "USD") await unchanged(async () => {
        assert.equal((await body(await checkout(req({}, keys.a), tokens(row.token)), 422)).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call("create_invoice_checkout", { token: row.token })).body.code, "LEGACY_NUMERIC_RANGE");
      });
    }
    const pdf = await good("render_invoice", { id: records[0].id, format: "pdf" }); assert.equal(Buffer.from(pdf.content, "base64").subarray(0, 5).toString(), "%PDF-");
    const [sink] = await db.insert(webhook).values({ organizationId: a.id, url: "https://sink.example.test", events: ["invoice.paid"], secret: "fixture_secret" }).returning();
    for (const [index, row] of records.filter(row => row.currency === "USD").entries()) {
      if (index === 0) await body(await checkout(req({}, keys.a), tokens(row.token))); else await good("create_invoice_checkout", { token: row.token });
      const native = sessions.at(-1)!; assert.equal(native.line_items![0].price_data!.unit_amount, 1250);
      assert.equal(native.line_items![0].price_data!.currency, "usd"); assert.equal(native.metadata!.amountMinor, "1250");
      assert.equal(Object.hasOwn(native.line_items![0].price_data!, "unit_amountMinor"), false);
      const session = { id: `cs_public_${index}`, object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 1250,
        currency: "usd", payment_intent: `pi_public_${index}`, metadata: native.metadata };
      await unchanged(async () => {
        await body(await signedCheckout(signed(session, true)), 400);
        for (const bad of [{ ...session, amount_total: 1251 }, { ...session, metadata: { ...native.metadata, organizationId: b.id } }])
          assert.equal((await body(await signedCheckout(signed(bad)), 422)).code, "LEGACY_NUMERIC_RANGE");
      });
      await body(await signedCheckout(signed(session)));
      await unchanged(async () => { await body(await signedCheckout(signed(session))); });
      assert.deepEqual(await body(await pay(req(), tokens(row.token))), { status: "paid", invoice: { invoiceNumber: (await db.select().from(invoice).where(eq(invoice.id, row.id)))[0].invoiceNumber } });
      const paid = await body(await portalPayments(req(), tokens(row.portal))); assert.deepEqual(paid, await good("list_portal_payments", { token: row.portal }));
      assert.equal(paid.data[0].amountPaidMinor, "1250");
      const statementBody = await body(await statement(req(), tokens(row.portal))); assert.equal(statementBody.totalOutstandingMinor, "0");
      const delivery = await deliverWebhook(sink.id, "invoice.paid", { invoiceId: row.id, amount: 1250n, amountMinor: "1250", currencyCode: row.currency, opaque });
      assert.equal(delivery!.status, "success"); assert.equal((delivery!.payload as { amount: number }).amount, 1250);
      assert.deepEqual((delivery!.payload as { opaque: object }).opaque, opaque);
    }
    assert.equal(checkoutCalls, 2); assert.equal(deliveries, 2);
    const postPayment = await body(await downloadSnapshot(req()));
    assert.deepEqual(postPayment.entities.payments.map((p: { amountMinor: string }) => p.amountMinor), ["1250", "1250"]);
    // Historical backup format omits token/signature/allocation dependencies: refuse partial destructive recovery.
    await unchanged(async () => {
      await body(await restore(req({ confirm: true }), params(uploaded.id)), 400);
      const refused = await ma.call("restore_backup", { backupId: old.id, confirm: true });
      assert.equal(refused.error, true); assert.match(JSON.stringify(refused.body), /restore requires omitted/);
    });
    const target = records[2];
    await unchanged(async () => {
      for (const [key, client, status] of [[keys.b, mb, 404], [keys.denied, no, 403], ["dk_invalid", null, 401]] as const) {
        await body(await render(req(undefined, key), params(target.id)), status);
        await body(await restore(req({ confirm: true }, key), params(uploaded.id)), status);
        if (client) for (const [name, args] of [["render_invoice", { id: target.id }], ["get_payment_link", { token: target.token }],
          ["restore_backup", { backupId: uploaded.id, confirm: true }]] as const) assert.equal((await client.call(name, args)).body.status, status);
      }
      assert.equal((await mb.call("export_csv_data", { entityType: "invoices" })).body.rowCount, 0);
      assert.equal((await no.call("export_csv_data", { entityType: "invoices" })).body.status, 403);
      for (const client of [mb, no]) assert.equal((await client.call("list_portal_invoices", { token: target.portal })).error, true);
      for (const input of [{ name: "Conflict", unitPrice: "12.50", unitPriceMinor: "1251" }, { name: "Unsafe", unitPriceMinor: "9007199254740992" }]) {
        const result = await importProducts(req({ fileName: "bad.csv", rows: [input] })); assert.ok([400, 422].includes(result.status));
        assert.equal((await ma.call("import_csv_data", { entityType: "products", csvContent: `${Object.keys(input).join(",")}\n${Object.values(input).join(",")}` })).error, true);
      }
      assert.equal((await ma.call("get_payment_link", { token: target.token, amountMinor: "1" })).error, true);
      const conflictingInvoice = { contactId: target.contactId, issueDate: "2024-01-01", dueDate: "2024-01-31", currencyCode: target.currency,
        lines: [{ description: "Conflict", unitPriceMinor: "1250", unitPriceExact: "1251" }] };
      await body(await createInvoice(req(conflictingInvoice)), 400);
      assert.equal((await ma.call("create_invoice", conflictingInvoice)).error, true);
      const bad = structuredClone(snapshot); bad.entities.invoices[0].totalMinor = "1251";
      await body(await uploadSnapshot(uploadRequest(JSON.stringify(bad))), 400);
      assert.equal((await ma.call("upload_backup", { snapshotJson: JSON.stringify(bad) })).error, true);
    });
    await db.execute(sql`update invoice set total=9007199254740993, amount_due=9007199254740993 where id=${target.id}`);
    await unchanged(async () => {
      for (const response of [await pay(req(), tokens(target.token)), await portalInvoices(req(), tokens(target.portal)), await statement(req(), tokens(target.portal)),
        await render(req(), params(target.id)), await exportInvoices(req()), await downloadSnapshot(req())])
        assert.equal((await body(response, 422)).code, "LEGACY_NUMERIC_RANGE");
      for (const [name, args] of [["get_payment_link", { token: target.token }], ["list_portal_invoices", { token: target.portal }],
        ["get_portal_statement", { token: target.portal }], ["render_invoice", { id: target.id }], ["export_csv_data", { entityType: "invoices" }],
        ["download_backup_snapshot", {}]] as const) assert.equal((await ma.call(name, args)).body.code, "LEGACY_NUMERIC_RANGE");
    });
    console.log("Combined public boundary contracts verified");
  } finally {
    S3Client.prototype.send = originalS3; globalThis.fetch = originalFetch; stripe!.checkout.sessions.create = originalCheckout;
    await ma.close(); await mb.close(); await no.close();
  }
}
try { await run(); process.exit(0); } catch (error) { console.error(error); process.exit(1); }
