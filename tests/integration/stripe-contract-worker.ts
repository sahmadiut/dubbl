import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, invoice, payment, chartAccount, bankAccount,
  stripeIntegration, stripeSyncLog, stripeEntityMap, webhook, webhookDelivery, periodLock, subscription } from "../../lib/db/schema";
import { stripe } from "../../lib/stripe";
import { registerIntegrationTools } from "../../lib/mcp/tools/integrations";
import { registerPublicPortalTools } from "../../lib/mcp/tools/public-portal";
import { registerWebhookTools } from "../../lib/mcp/tools/webhooks";
import { runInitialSync } from "../../lib/integrations/stripe/initial-sync";
import { POST as syncRest } from "../../app/api/v1/integrations/stripe/sync/route";
import { POST as billingRest } from "../../app/api/v1/billing/checkout/route";
import { POST as importRest } from "../../app/api/v1/integrations/stripe/import/route";
import { POST as reconcileRest } from "../../app/api/v1/integrations/stripe/reconcile/route";
import { POST as checkoutRest } from "../../app/api/pay/[token]/checkout/route";
import { POST as signedCheckout } from "../../app/api/stripe/webhook/route";
import { POST as signedConnect } from "../../app/api/integrations/stripe/webhook/route";
import { POST as testWebhookRest } from "../../app/api/v1/webhooks/[id]/test/route";
import { handleChargeSucceeded, processStripeEvent } from "../../lib/integrations/stripe/sync";
import { settleInvoiceCheckout } from "../../lib/integrations/stripe/checkout";
import { reconcileStripeBalance } from "../../lib/integrations/stripe/reconcile";
import { retryFailedStripeEvents } from "../../lib/integrations/stripe/retry";
import { deliverWebhook, retryWebhookDeliveryById } from "../../lib/webhooks/deliver";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Stripe fixture", version: "1" });
  registerIntegrationTools(server, ctx); registerPublicPortalTools(server, ctx); registerWebhookTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  assert.match((await client.listTools()).tools.find(t => t.name === "reconcile_stripe_balance")!.description!, /amountMinor/);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { error: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Stripe A", slug: "stripe-a" }, { name: "Stripe B", slug: "stripe-b" }]).returning();
  const [owner, blocked] = await db.insert(users).values([{ name: "Owner", email: "stripe-owner@example.test" }, { name: "Blocked", email: "stripe-blocked@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No access", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: blocked.id, role: "member", customRoleId: role.id }]);
  for (const [key, org, user] of [["dk_stripe_a", a.id, owner.id], ["dk_stripe_b", b.id, owner.id], ["dk_stripe_denied", a.id, blocked.id]]) {
    await db.insert(apiKey).values({ organizationId: org, createdBy: user, name: key, keyPrefix: "dk_stripe", keyHash: createHash("sha256").update(key).digest("hex") });
  }
  const [customer] = await db.insert(contact).values({ organizationId: a.id, name: "Customer", type: "customer" }).returning();
  const [clearing, revenue, fees, bankChart, foreign] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1250", name: "Clearing", type: "asset" as const }, { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: a.id, code: "5900", name: "Fees", type: "expense" as const }, { organizationId: a.id, code: "1000", name: "Bank", type: "asset" as const },
    { organizationId: b.id, code: "4000", name: "Foreign", type: "revenue" as const },
  ]).returning();
  const [bank] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: "Payout bank", currencyCode: "USD", chartAccountId: bankChart.id }).returning();
  const [integration, other] = await db.insert(stripeIntegration).values([
    { organizationId: a.id, stripeAccountId: "acct_a", accessToken: "fixture", clearingAccountId: clearing.id, revenueAccountId: revenue.id, feesAccountId: fees.id, payoutBankAccountId: bank.id },
    { organizationId: b.id, stripeAccountId: "acct_b", accessToken: "fixture" },
  ]).returning();
  const ctx = { userId: owner.id, organizationId: a.id, role: "owner" as const };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), denied = await mcp({ ...ctx, permissions: [] });
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "payment", "payment_allocation", "journal_entry", "journal_line", "stripe_entity_map", "contact", "chart_account", "bank_transaction", "number_sequence", "subscription", "stripe_integration", "credit_note", "credit_note_line", "audit_log", "webhook_delivery", "notification"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  const csvRequest = (csv: string, type = "payments", id = integration.id, key = "dk_stripe_a") => {
    const body = new FormData(); body.set("file", new File([csv], "stripe.csv")); body.set("type", type); body.set("integrationId", id);
    return new Request("https://fixture.test/api/v1/integrations/stripe/import", { method: "POST", headers: { authorization: `Bearer ${key}` }, body });
  };
  const jsonRequest = (body: unknown, key = "dk_stripe_a") => new Request("https://fixture.test/api/v1/integrations/stripe/reconcile", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const signed = (type: string, object: unknown, connect = false, id = "evt_fixture") => {
    const body = JSON.stringify({ id, object: "event", type, account: connect ? "acct_a" : undefined, data: { object } });
    const signature = stripe!.webhooks.generateTestHeaderString({ payload: body, secret: connect ? "whsec_connect_fixture" : "whsec_fixture" });
    return new Request("https://fixture.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body });
  };
  let checkoutCalls = 0, reconcileCalls = 0;
  stripe!.checkout.sessions.create = (async (params: Stripe.Checkout.SessionCreateParams) => {
    checkoutCalls++; if (params.mode === "subscription") { assert.equal(params.line_items![0].price, "price_pro_fixture"); return { url: "https://checkout.stripe.test/billing" }; }
    assert.equal(params.automatic_tax, undefined); assert.equal(params.line_items![0].price_data!.unit_amount, 1250);
    assert.equal(params.metadata!.amountMinor, "1250"); return { url: "https://checkout.stripe.test/session" };
  }) as Stripe["checkout"]["sessions"]["create"];
  let customerCalls = 0;
  stripe!.customers.create = (async () => { customerCalls++; return { id: "cus_billing" }; }) as unknown as Stripe["customers"]["create"];
  const transactions = [{ id: "txn_a", source: "ch_missing", type: "charge", currency: "usd", amount: 1250, created: 1700000000 }];
  stripe!.balanceTransactions.list = (() => { reconcileCalls++; return { async *[Symbol.asyncIterator]() { yield* transactions; } }; }) as unknown as Stripe["balanceTransactions"]["list"];
  const timestamp = Math.floor(Date.now() / 1000);
  const charge = (id: string, amount: number) => ({ id, object: "charge", amount, currency: "usd", created: timestamp, customer: null,
    billing_details: { email: "new@example.test", name: "New customer" }, payment_intent: null, balance_transaction: null }) as unknown as Stripe.Charge;
  const newInvoice = async (token: string, amount = 1250, currency = "USD") => (await db.insert(invoice).values({ organizationId: a.id,
    contactId: customer.id, invoiceNumber: token, issueDate: "2026-01-01", dueDate: "2026-12-31", status: "sent", total: amount, amountDue: amount, currencyCode: currency, paymentLinkToken: token }).returning())[0];
  const fetchOriginal = globalThis.fetch;
  const sent: { body: string; signature: string; id: string }[] = [];
  globalThis.fetch = async (_url, init) => {
    const headers = new Headers(init?.headers);
    sent.push({ body: String(init?.body), signature: headers.get("X-Dubbl-Signature")!, id: headers.get("X-Dubbl-Delivery-Id")! });
    return new Response("ok", { status: 200 });
  };
  try {
    const old = "id,Amount,Fee,Net,Currency\nch_old,10.23,0.29,9.94,usd";
    assert.deepEqual(await (await importRest(csvRequest(old))).json(), { imported: 1, skipped: 0, errors: [] });
    const exact = "id,Amount Minor,Fee Minor,Net Minor,Currency\nch_exact,1023,29,994,usd";
    assert.deepEqual((await ma.call("import_stripe_csv", { integrationId: integration.id, csvContent: exact, type: "payments" })).body, { imported: 1, skipped: 0, errors: [] });
    const lines = (await db.execute(sql`select debit_amount::text as debit, credit_amount::text as credit from journal_line order by id`)).rows;
    assert.equal(lines.filter(l => l.debit === "1023").length, 2); assert.equal(lines.filter(l => l.debit === "29").length, 2);
    assert.deepEqual((await ma.call("import_stripe_csv", { integrationId: integration.id, csvContent: old, type: "payments" })).body, { imported: 0, skipped: 1, errors: [] });
    const max = "id,Amount Minor,Currency\nch_max,9007199254740991,usd";
    assert.equal((await ma.call("import_stripe_csv", { integrationId: integration.id, csvContent: max, type: "payments" })).body.imported, 1);
    for (const csv of ["id,Amount,Currency\nch_good,1.00,usd\nch_bad,0.001,usd", "id,Amount,Amount Minor,Currency\nch_bad,1.00,101,usd",
      "id,Amount Minor,Currency\nch_bad,9007199254740992,usd", "id,Amount,Currency\nch_bad,1250,irr", "id,Amount,Currency\nch_bad,1,jpy",
      "id,Amount,Fee,Currency\nch_bad,1,-0.01,usd", "id,Amount,Currency,Created (UTC)\nch_bad,1,usd,nonsense"]) {
      const before = await snapshot(); assert.equal((await importRest(csvRequest(csv))).status, 422);
      assert.equal((await ma.call("import_stripe_csv", { integrationId: integration.id, csvContent: csv, type: "payments" })).error, true);
      assert.deepEqual(await snapshot(), before);
    }
    assert.equal((await importRest(csvRequest("id,Amount,Currency\npo_csv,12.50,usd", "payouts"))).status, 200);
    const beforeDenied = await snapshot();
    assert.equal((await importRest(csvRequest(old, "payments", integration.id, "dk_stripe_denied"))).status, 403);
    assert.equal((await importRest(csvRequest(old, "payments", integration.id, "dk_stripe_b"))).status, 404);
    assert.equal((await denied.call("import_stripe_csv", { integrationId: integration.id, csvContent: old, type: "payments" })).body.status, 403);
    assert.equal((await mb.call("import_stripe_csv", { integrationId: integration.id, csvContent: old, type: "payments" })).error, true);
    assert.deepEqual(await snapshot(), beforeDenied);

    const [jpyOrg] = await db.insert(organization).values({ name: "JPY", slug: "stripe-jpy", defaultCurrency: "JPY" }).returning();
    const [jpyIntegration] = await db.insert(stripeIntegration).values({ organizationId: jpyOrg.id, stripeAccountId: "acct_jpy", accessToken: "fixture" }).returning();
    await handleChargeSucceeded(jpyIntegration, { ...charge("ch_jpy", 1250), currency: "jpy", balance_transaction: {
      object: "balance_transaction", amount: 1250, currency: "jpy", fee: 5, net: 1245,
    } } as unknown as Stripe.Charge);
    const jpyLines = (await db.execute(sql`select l.currency_code, l.debit_amount::text as debit from journal_line l join journal_entry e on e.id=l.journal_entry_id where e.organization_id=${jpyOrg.id}`)).rows;
    assert.equal(jpyLines.length, 4); assert.ok(jpyLines.every(l => l.currency_code === "JPY"));
    assert.ok(jpyLines.some(l => l.debit === "1250")); assert.ok(jpyLines.some(l => l.debit === "5"));

    await Promise.all([handleChargeSucceeded(integration, charge("ch_concurrent", 1250)), handleChargeSucceeded(integration, charge("ch_concurrent", 1250))]);
    assert.equal((await db.select().from(stripeEntityMap).where(eq(stripeEntityMap.stripeEntityId, "ch_concurrent"))).length, 1);
    // Late provider fee errors roll back the already-created contact, revenue entry and map.
    stripe!.balanceTransactions.retrieve = (async () => ({ object: "balance_transaction", currency: "usd", amount: 1250, fee: 1.1, net: 1249 })) as unknown as Stripe["balanceTransactions"]["retrieve"];
    const beforeFee = await snapshot(); await assert.rejects(handleChargeSucceeded(integration, { ...charge("ch_bad_fee", 1250), balance_transaction: "txn_bad" }));
    assert.deepEqual(await snapshot(), beforeFee);
    const negativeCases = [
      ["charge.succeeded", { ...charge("ch_invalid", 1.1) }], ["charge.refunded", { ...charge("ch_refund", 1), refunds: { data: [{ amount: 1.1, currency: "usd" }] } }],
      ["payout.paid", { id: "po_invalid", object: "payout", amount: Number.MAX_SAFE_INTEGER + 1, currency: "usd" }],
      ["charge.dispute.closed", { id: "dp_invalid", object: "dispute", amount: 1.1, currency: "usd" }],
      ["invoice.paid", { id: "in_invalid", object: "invoice", amount_paid: 1.1, currency: "usd" }],
      ["transfer.reversed", { id: "tr_invalid", object: "transfer", amount: 1, amount_reversed: 1.1, currency: "usd" }],
      ["credit_note.created", { id: "cn_invalid", object: "credit_note", total: 1, subtotal: 1, currency: "usd", lines: { data: [{ amount: 1.1 }] } }],
      ["customer.subscription.created", { id: "sub_invalid", object: "subscription", currency: "usd", items: { data: [{ price: { currency: "usd", unit_amount: Number.MAX_SAFE_INTEGER + 1 } }] } }],
    ] as const;
    for (const [type, object] of negativeCases) {
      const before = await snapshot(); await assert.rejects(processStripeEvent({ type, account: "acct_a", data: { object } } as unknown as Stripe.Event, integration));
      assert.deepEqual(await snapshot(), before);
    }
    await db.update(stripeIntegration).set({ revenueAccountId: foreign.id }).where(eq(stripeIntegration.id, integration.id));
    const beforeMapping = await snapshot(); await assert.rejects(handleChargeSucceeded(integration, charge("ch_foreign", 1250))); assert.deepEqual(await snapshot(), beforeMapping);
    await db.update(stripeIntegration).set({ revenueAccountId: revenue.id }).where(eq(stripeIntegration.id, integration.id));
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2099-12-31" });
    const beforeLock = await snapshot(); await assert.rejects(handleChargeSucceeded(integration, charge("ch_locked", 1250))); assert.deepEqual(await snapshot(), beforeLock);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));

    // Exercise additional money-bearing lifecycle handlers on the real transactional database.
    const event = (type: string, object: unknown) => processStripeEvent({ type, account: "acct_a", data: { object } } as Stripe.Event, integration);
    await event("charge.refunded", { ...charge("ch_old", 1023), refunds: { data: [{ id: "re_old", object: "refund", amount: 500, currency: "usd", created: timestamp, balance_transaction: null }] } });
    const dispute = { id: "dp_good", object: "dispute", amount: 500, currency: "usd", created: timestamp, charge: null, status: "needs_response", balance_transactions: [] };
    await event("charge.dispute.created", dispute); await event("charge.dispute.closed", { ...dispute, status: "lost" });
    const providerInvoice = { id: "in_good", object: "invoice", amount_paid: 1250, subtotal: 1000, currency: "usd", customer: "cus_invoice", customer_email: "invoice@example.test", created: timestamp };
    await event("invoice.paid", providerInvoice); await event("invoice.voided", providerInvoice);
    const transfer = { id: "tr_good", object: "transfer", amount: 1250, currency: "usd", created: timestamp, amount_reversed: 500 };
    await event("transfer.created", transfer); await event("transfer.reversed", transfer);
    const cn = { id: "cn_good", object: "credit_note", total: 1250, subtotal: 1000, currency: "usd", created: timestamp,
      customer: "cus_cn", invoice: null, lines: { data: [{ amount: 1000, unit_amount: 1000, quantity: 1, description: "Credit" }] } };
    await event("credit_note.created", cn); await event("credit_note.updated", { ...cn, total: 1500, subtotal: 1200 }); await event("credit_note.voided", cn);
    const sub = { id: "sub_good", object: "subscription", currency: "usd", customer: "cus_subscription", created: timestamp,
      items: { data: [{ price: { id: "price_good", currency: "usd", unit_amount: 1250, unit_amount_decimal: "1250", recurring: { interval: "month" } }, quantity: 1 }] }, status: "active" };
    await event("customer.subscription.created", sub); await event("customer.subscription.updated", sub); await event("customer.subscription.deleted", sub);
    await event("invoice.payment_failed", { ...providerInvoice, id: "in_failed", amount_due: 1250 });
    await event("payment_intent.payment_failed", { id: "pi_failed", object: "payment_intent", amount: 1250, currency: "usd" });
    const mappings = (await ma.call("list_stripe_entity_mappings", { stripeEntityType: "charge" })).body.mappings;
    assert.equal(mappings.find((m: { stripeEntityId: string }) => m.stripeEntityId === "ch_old").metadata.amountMinor, "1023");
    const unbalanced = (await db.execute(sql`select e.id from journal_entry e join journal_line l on l.journal_entry_id=e.id where e.status='posted' group by e.id having sum(l.debit_amount::numeric) <> sum(l.credit_amount::numeric)`)).rows;
    assert.equal(unbalanced.length, 0);
    // Billing plans and Price configuration are preflighted before external customer creation.
    const beforeBilling = await snapshot();
    for (const body of [{ plan: "invalid" }, { type: "storage", plan: "starter" }, { plan: "pro", amountMinor: "1250" }]) {
      assert.equal((await billingRest(jsonRequest(body))).status, 400);
      assert.equal((await ma.call("create_billing_checkout", body)).error, true);
    }
    assert.equal(customerCalls, 0); assert.deepEqual(await snapshot(), beforeBilling);
    assert.equal((await billingRest(jsonRequest({ plan: "pro" }, "dk_stripe_denied"))).status, 403);
    assert.equal((await denied.call("create_billing_checkout", { plan: "pro" })).body.status, 403);
    assert.equal((await billingRest(jsonRequest({ plan: "pro" }))).status, 200);
    assert.equal((await ma.call("create_billing_checkout", { plan: "pro" })).body.url, "https://checkout.stripe.test/billing");

    // Initial sync and retry consume the same validated transactional handlers.
    const iterable = <T>(values: T[]) => ({ async *[Symbol.asyncIterator]() { yield* values; } });
    stripe!.customers.list = (() => iterable([])) as unknown as Stripe["customers"]["list"];
    stripe!.charges.list = (() => iterable([{ ...charge("ch_initial", 1250), status: "succeeded" }])) as unknown as Stripe["charges"]["list"];
    stripe!.payouts.list = (() => iterable([])) as unknown as Stripe["payouts"]["list"];
    stripe!.transfers.list = (() => iterable([])) as unknown as Stripe["transfers"]["list"];
    stripe!.creditNotes.list = (() => iterable([])) as unknown as Stripe["creditNotes"]["list"];
    await runInitialSync(integration.id);
    assert.equal((await db.query.stripeIntegration.findFirst({ where: eq(stripeIntegration.id, integration.id) }))!.initialSyncCompleted, true);
    assert.equal((await db.query.stripeSyncLog.findFirst({ where: eq(stripeSyncLog.eventType, "initial_sync") }))!.status, "success");
    const beforeSync = await snapshot();
    assert.equal((await syncRest(jsonRequest({ integrationId: integration.id }, "dk_stripe_denied"))).status, 403);
    assert.equal((await syncRest(jsonRequest({ integrationId: integration.id }, "dk_stripe_b"))).status, 404);
    assert.equal((await syncRest(jsonRequest({ integrationId: "not-a-uuid" }))).status, 400);
    assert.equal((await denied.call("trigger_stripe_sync", { integrationId: integration.id })).body.status, 403);
    assert.equal((await ma.call("trigger_stripe_sync", { integrationId: integration.id, days: 1.5 })).error, true);
    assert.deepEqual(await snapshot(), beforeSync);

    const inv = await newInvoice("pay_valid");
    assert.equal((await checkoutRest(new Request("https://fixture.test/api/pay/pay_valid/checkout"), { params: Promise.resolve({ token: "pay_valid" }) })).status, 200);
    assert.equal((await ma.call("create_invoice_checkout", { token: "pay_valid" })).body.checkoutUrl, "https://checkout.stripe.test/session");
    const calls = checkoutCalls;
    assert.equal((await mb.call("create_invoice_checkout", { token: "pay_valid" })).error, true);
    assert.equal((await denied.call("create_invoice_checkout", { token: "pay_valid" })).body.status, 403); assert.equal(checkoutCalls, calls);
    await newInvoice("pay_big", 100000000); await newInvoice("pay_irr", 1250, "IRR");
    for (const token of ["pay_big", "pay_irr"]) assert.equal((await checkoutRest(new Request("https://fixture.test"), { params: Promise.resolve({ token }) })).status, 422);
    assert.equal(checkoutCalls, calls);
    const session = { id: "cs_valid", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 1250, currency: "usd", payment_intent: "pi_valid",
      metadata: { invoiceId: inv.id, organizationId: a.id, paymentLinkToken: "pay_valid", amountMinor: "1250" } } as unknown as Stripe.Checkout.Session;
    for (const bad of [{ ...session, amount_total: 1251 }, { ...session, currency: "jpy" }, { ...session, metadata: { ...session.metadata, organizationId: b.id } },
      { ...session, metadata: { ...session.metadata, paymentLinkToken: "other" } }]) {
      const before = await snapshot(); await assert.rejects(settleInvoiceCheckout(bad)); assert.deepEqual(await snapshot(), before);
    }
    assert.equal((await signedCheckout(new Request("https://fixture.test", { method: "POST", headers: { "stripe-signature": "invalid" }, body: "{}" }))).status, 400);
    await Promise.all([settleInvoiceCheckout(session), settleInvoiceCheckout(session)]);
    assert.equal((await db.select().from(payment).where(eq(payment.stripePaymentIntentId, "pi_valid"))).length, 1);
    assert.equal((await db.query.invoice.findFirst({ where: eq(invoice.id, inv.id) }))!.amountPaid, 1250);
    const beforeDuplicate = await snapshot();
    await assert.rejects(settleInvoiceCheckout({ ...session, payment_intent: "pi_new_duplicate" }));
    assert.deepEqual(await snapshot(), beforeDuplicate);
    const after = await snapshot(); assert.equal((await signedCheckout(signed("checkout.session.completed", session))).status, 200); assert.deepEqual(await snapshot(), after);
    const stale = await newInvoice("pay_stale"); const beforeStale = await snapshot();
    assert.equal((await signedCheckout(signed("checkout.session.completed", { ...session, payment_intent: "pi_stale", metadata: { invoiceId: stale.id, organizationId: a.id, paymentLinkToken: "pay_stale" }, amount_total: 1200 }))).status, 422);
    assert.deepEqual(await snapshot(), beforeStale);
    assert.equal((await signedConnect(signed("charge.succeeded", charge("ch_signed", 1250), true, "evt_signed"))).status, 200);
    const afterSigned = await snapshot(); await signedConnect(signed("charge.succeeded", charge("ch_signed", 1250), true, "evt_signed")); assert.deepEqual(await snapshot(), afterSigned);
    await signedConnect(signed("charge.succeeded", charge("ch_signed_bad", 1.1), true, "evt_signed_bad")); assert.deepEqual(await snapshot(), afterSigned);
    assert.equal((await db.query.stripeSyncLog.findFirst({ where: eq(stripeSyncLog.stripeEventId, "evt_signed_bad") }))!.status, "failed");
    stripe!.events.retrieve = (async () => ({ id: "evt_signed_bad", type: "charge.succeeded", account: "acct_a", data: { object: charge("ch_retry", 1.1) } })) as unknown as Stripe["events"]["retrieve"];
    assert.equal((await retryFailedStripeEvents()).failed, 1); assert.deepEqual(await snapshot(), afterSigned);
    // Subscription raw contract validation precedes subscription mutation.
    await db.insert(subscription).values({ organizationId: a.id, stripeSubscriptionId: "sub_seats" });
    const beforeSub = await snapshot();
    assert.equal((await signedCheckout(signed("customer.subscription.updated", { id: "sub_seats", currency: "usd", items: { data: [{ price: { currency: "usd", unit_amount: 1.1 } }] } }))).status, 422);
    assert.deepEqual(await snapshot(), beforeSub);

    const rest = await reconcileRest(jsonRequest({ integrationId: integration.id, days: 30 })); assert.equal(rest.status, 200);
    const body = await rest.json(); assert.deepEqual(body.missingLocal[0], { id: "ch_missing", type: "charge", amount: 1250, amountMinor: "1250", currencyCode: "USD", created: 1700000000 });
    assert.deepEqual((await ma.call("reconcile_stripe_balance", { integrationId: integration.id, days: 30 })).body, { matched: body.matched, missingLocal: body.missingLocal, totalChecked: body.totalChecked });
    const providerCalls = reconcileCalls;
    await assert.rejects(reconcileStripeBalance(other.id, a.id, 30)); assert.equal(reconcileCalls, providerCalls);
    for (const days of [0, 91, 1.5, "30"]) assert.equal((await reconcileRest(jsonRequest({ integrationId: integration.id, days }))).status, 400);
    assert.equal((await reconcileRest(jsonRequest({ integrationId: integration.id }, "dk_stripe_denied"))).status, 403); assert.equal(reconcileCalls, providerCalls);
    transactions[0].amount = Number.MAX_SAFE_INTEGER + 1; assert.equal((await reconcileRest(jsonRequest({ integrationId: integration.id }))).status, 422);
    assert.equal((await ma.call("reconcile_stripe_balance", { integrationId: integration.id })).body.code, "LEGACY_NUMERIC_RANGE");

    const [wh] = await db.insert(webhook).values({ organizationId: a.id, url: "https://sink.example.test", events: ["invoice.paid"], secret: "fixture_secret" }).returning();
    const payload = { z: { amount: 1250n, currencyCode: "JPY" }, amountMinor: "1250", a: 1 };
    const delivered = await deliverWebhook(wh.id, "invoice.paid", payload); assert.equal(delivered!.status, "success");
    const initial = sent.at(-1)!; assert.equal(initial.signature, createHmac("sha256", wh.secret).update(initial.body).digest("hex"));
    await db.update(webhookDelivery).set({ status: "retrying", nextRetryAt: new Date(0) }).where(eq(webhookDelivery.id, delivered!.id));
    await retryWebhookDeliveryById(delivered!.id); assert.deepEqual(sent.at(-1), initial);
    const beforeDelivery = await snapshot(); const sentBefore = sent.length;
    await assert.rejects(deliverWebhook(wh.id, "bad", { amount: 9007199254740992n })); assert.deepEqual(await snapshot(), beforeDelivery); assert.equal(sent.length, sentBefore);
    assert.equal((await testWebhookRest(jsonRequest({}, "dk_stripe_denied"), { params: Promise.resolve({ id: wh.id }) })).status, 403);
    assert.equal((await denied.call("test_webhook", { webhookId: wh.id })).body.status, 403);
    assert.equal((await mb.call("test_webhook", { webhookId: wh.id })).error, true); assert.equal(sent.length, sentBefore);
    assert.equal((await ma.call("test_webhook", { webhookId: wh.id })).body.delivery.status, "success");
    console.log("Stripe REST, MCP and signed delivery contracts verified");
  } finally { globalThis.fetch = fetchOriginal; await ma.close(); await mb.close(); await denied.close(); }
}

try { await run(); process.exit(0); } catch (error) { console.error(error); process.exit(1); }
