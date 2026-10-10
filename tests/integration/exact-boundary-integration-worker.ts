// Executed only by the migrated disposable-database harness.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, subscription, chartAccount, invoice, periodLock, portalAccessToken, journalEntry, journalLine, contact } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { parseCSV } from "../../lib/import-export/csv-utils";
import { documentMoneyText } from "../../lib/documents/render-wire";
import { POST as setRate } from "../../app/api/v1/exchange-rates/route";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { GET as getInvoice } from "../../app/api/v1/invoices/[id]/route";
import { POST as sendInvoice } from "../../app/api/v1/invoices/[id]/send/route";
import { POST as createBudget } from "../../app/api/v1/budgets/route";
import { GET as pnl } from "../../app/api/v1/reports/profit-and-loss/route";
import { GET as budgetActual } from "../../app/api/v1/reports/budget-vs-actual/route";
import { GET as exportInvoices } from "../../app/api/v1/export/invoices/route";
import { GET as backup } from "../../app/api/v1/backups/download-snapshot/route";
import { GET as paymentLink } from "../../app/api/pay/[token]/route";
import { GET as statement } from "../../app/api/v1/portal/[token]/statements/route";
import { GET as getAccount } from "../../app/api/v1/accounts/[id]/route";
import { GET as ubl } from "../../app/api/v1/invoices/[id]/ubl/route";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "MON-012", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Combined fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { async call(name: string, args: object = {}) {
    const result = await client.callTool({ name, arguments: { ...args } });
    const text = (result.content as { text: string }[])[0].text;
    return { error: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const tokens = (token: string) => ({ params: Promise.resolve({ token }) });
async function body(response: Response, status = 200) {
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value;
}

async function scenario(base: string, currency: string, amount: number, exact: boolean) {
  const label = `${base}-${currency}-${amount}`;
  const [own, foreign] = await db.insert(organization).values([
    { name: label, slug: label.toLowerCase(), defaultCurrency: base, countryCode: "US" },
    { name: `${label}-foreign`, slug: `${label.toLowerCase()}-foreign`, defaultCurrency: base },
  ]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: `${label}@example.test` }, { email: `${label}-denied@example.test` }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: own.id, name: "No grants", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: own.id, userId: owner.id, role: "owner" },
    { organizationId: foreign.id, userId: owner.id, role: "owner" }, { organizationId: own.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  await db.insert(subscription).values({ organizationId: own.id, plan: "pro", status: "active" });
  const keys = { own: `dk_${label}`, foreign: `dk_${label}_foreign`, denied: `dk_${label}_denied` };
  for (const [name, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: name === "foreign" ? foreign.id : own.id,
    createdBy: name === "denied" ? denied.id : owner.id, name, keyPrefix: "dk_boundary", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { organizationId: own.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: foreign.id });
  const no = await connect({ ...ctx, userId: denied.id, role: "member", permissions: [] });
  const req = (input?: object, query = "", key = keys.own) => new Request(`https://fixture.test/boundary${query}`, {
    method: input === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": foreign.id },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const good = async (name: string, args: object = {}) => { const result = await ma.call(name, args); assert.equal(result.error, false, JSON.stringify(result)); return result.body; };
  const names = (await db.execute(sql`select tablename from pg_tables where schemaname='public' and tablename <> 'api_key' order by tablename`)).rows.map(r => String(r.tablename));
  assert.ok(names.every(name => /^[a-z_]+$/.test(name)));
  const snapshot = async () => (await db.execute(sql.raw(names.map(name =>
    `select '${name}' as name, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text as rows from "${name}" t`).join(" union all ")))).rows;
  const unchanged = async (operation: () => Promise<unknown>) => { const before = await snapshot(); await operation(); assert.deepEqual(await snapshot(), before); };
  const date = "2024-01-01", endDate = "2024-01-31", rateExact = base === currency ? "1" : "0.8";
  // Expected arithmetic is independent of product helpers and Number FX.
  const baseAmount = base === currency ? BigInt(amount) : BigInt(amount) * 4n / 5n;
  const [revenue] = await db.insert(chartAccount).values({ organizationId: own.id, code: "4000", name: "Revenue", type: "revenue", currencyCode: base }).returning();
  const [ar] = await db.insert(chartAccount).values({ organizationId: own.id, code: "1200", name: "Receivables", type: "asset", currencyCode: base }).returning();
  try {
    const rateInput = { baseCurrency: currency, targetCurrency: base, date };
    const savedRate = exact ? (await good("set_exchange_rate", { ...rateInput, rateExact })).exchangeRate
      : (await body(await setRate(req({ rates: [{ ...rateInput, rate: base === currency ? 1000000 : 800000 }] })), 201)).exchangeRates[0];
    assert.equal(savedRate.organizationId, own.id); assert.equal(savedRate.rateExact, rateExact);
    assert.equal((await good("get_exchange_rate", rateInput)).rateExact, rateExact);
    const party = (await good("create_contact", { name: "Shared customer", type: "customer", currencyCode: currency })).contact;
    // The legacy contact MCP create schema has no address input; seed only this
    // nonmonetary prerequisite for the existing UBL required-country policy.
    await db.update(contact).set({ addresses: { billing: { country: "US" } } }).where(eq(contact.id, party.id));
    const scale = currency === "KWD" ? 1000 : ["IRR", "JPY"].includes(currency) ? 1 : 100;
    const common = { contactId: party.id, currencyCode: currency, issueDate: date, dueDate: endDate };
    const line = { description: "One economic event", accountId: revenue.id };
    const saved = exact ? (await good("create_invoice", { ...common, lines: [{ ...line, unitPriceMinor: String(amount) }] })).invoice
      : (await body(await createInvoice(req({ ...common, lines: [{ ...line, unitPrice: amount / scale }] })), 201)).invoice;
    assert.equal(saved.totalMinor, String(amount)); assert.equal(saved.total, amount);
    assert.equal((await body(await getInvoice(req(), params(saved.id)))).invoice.totalMinor, String(amount));
    const budgetInput = { name: "Expected revenue", startDate: date, endDate, periodType: "custom", lines: [{ accountId: revenue.id, totalMinor: String(baseAmount) }] };
    const plan = exact ? (await body(await createBudget(req(budgetInput)), 201)).budget : (await good("create_budget", budgetInput)).budget;
    await unchanged(async () => {
      for (const patch of [{ unitPriceMinor: "9007199254740992" }, { unitPrice: 1, unitPriceMinor: "2" }, { unitPriceMinor: "01" }]) {
        const input = { ...common, lines: [{ ...line, ...patch }] };
        assert.equal((await createInvoice(req(input))).status, patch.unitPriceMinor === "9007199254740992" ? 422 : 400);
        assert.equal((await ma.call("create_invoice", input)).error, true);
      }
      const unsupported = { ...rateInput, targetCurrency: base === currency ? "USD" : base, rateExact: "0.000000000000000001" };
      assert.equal((await body(await setRate(req({ rates: [unsupported] })), 422)).code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("set_exchange_rate", unsupported)).body.code, "LEGACY_NUMERIC_RANGE");
      const badBudget = { ...budgetInput, lines: [{ accountId: revenue.id, totalMinor: "9007199254740992" }] };
      assert.equal((await createBudget(req(badBudget))).status, 422); assert.equal((await ma.call("create_budget", badBudget)).body.code, "LEGACY_NUMERIC_RANGE");
      for (const [key, status] of [[keys.denied, 403], ["dk_invalid", 401]] as const) {
        assert.equal((await sendInvoice(req({}, "", key), params(saved.id))).status, status);
        assert.equal((await setRate(req({ rates: [{ ...rateInput, rateExact }] }, "", key))).status, status);
        assert.equal((await createBudget(req(budgetInput, "", key))).status, status);
      }
      assert.equal((await sendInvoice(req({}, "", keys.foreign), params(saved.id))).status, 404);
      assert.equal((await mb.call("send_invoice", { invoiceId: saved.id })).body.status, 404);
      assert.equal((await no.call("send_invoice", { invoiceId: saved.id })).body.status, 403);
      assert.equal((await no.call("set_exchange_rate", { ...rateInput, rateExact })).body.status, 403);
      assert.equal((await no.call("create_budget", budgetInput)).body.status, 403);
    });
    const [lock] = await db.insert(periodLock).values({ organizationId: own.id, lockDate: date, lockedBy: owner.id }).returning();
    await unchanged(async () => {
      assert.equal((await sendInvoice(req({}), params(saved.id))).status, 422);
      assert.equal((await ma.call("send_invoice", { invoiceId: saved.id })).body.status, 422);
    });
    await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    if (exact) await body(await sendInvoice(req({}), params(saved.id))); else await good("send_invoice", { invoiceId: saved.id });
    const journals = await db.execute(sql`select l.rate_exact::text as rate, l.debit_amount::text as debit, l.credit_amount::text as credit
      from journal_line l join journal_entry e on e.id=l.journal_entry_id where e.organization_id=${own.id}`);
    assert.equal(journals.rows.length, 2);
    for (const row of journals.rows) {
      assert.equal(BigInt(String(row.debit)) + BigInt(String(row.credit)), baseAmount);
      assert.equal(String(row.rate).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""), rateExact);
    }
    const query = `?startDate=${date}&endDate=${endDate}`;
    const profit = await body(await pnl(req(undefined, query)));
    assert.deepEqual(profit, await good("profit_and_loss", { startDate: date, endDate }));
    assert.equal(profit.totalRevenueMinor, String(baseAmount)); assert.equal(profit.netIncomeMinor, String(baseAmount));
    const account = await body(await getAccount(req(), params(revenue.id)));
    const toolAccount = (await good("get_account", { accountId: revenue.id })).account;
    assert.deepEqual(account.account, { ...toolAccount, entryCount: 1 });
    assert.equal(toolAccount.balanceMinor, String(baseAmount)); assert.equal(toolAccount.totalCreditsMinor, String(baseAmount));
    assert.equal(account.data[0].creditAmountMinor, String(baseAmount)); assert.equal(account.data[0].balanceMinor, String(baseAmount));
    assert.equal((await good("get_account", { accountId: ar.id })).account.balanceMinor, String(baseAmount));
    const actual = await body(await budgetActual(req(undefined, `?budgetId=${plan.id}`)));
    assert.deepEqual(actual, await good("budget_vs_actual", { budgetId: plan.id }));
    assert.equal(actual.totalActualMinor, String(baseAmount)); assert.equal(actual.totalVarianceMinor, "0");
    // Reference updates cannot alter saved recognition FX or report history.
    if (base !== currency) {
      await good("set_exchange_rate", { ...rateInput, rateExact: "0.9" });
      assert.deepEqual(await good("profit_and_loss", { startDate: date, endDate }), profit);
    }
    const csv = await (await exportInvoices(req())).text(); assert.equal(csv, (await good("export_csv_data", { entityType: "invoices" })).csv);
    const rows = parseCSV(csv).rows; assert.equal(rows.length, 1); assert.equal(rows[0].lineAmountMinor, String(amount));
    assert.equal(rows[0].lineAmount, `${BigInt(amount) / 100n}.${String(BigInt(amount) % 100n).padStart(2, "0")}`);
    const token = randomUUID(); await db.update(invoice).set({ paymentLinkToken: token }).where(eq(invoice.id, saved.id));
    const [portal] = await db.insert(portalAccessToken).values({ organizationId: own.id, contactId: party.id, token: randomUUID() }).returning();
    const link = await body(await paymentLink(req(), tokens(token))); assert.deepEqual(link, await good("get_payment_link", { token }));
    const balance = await body(await statement(req(), tokens(portal.token))); assert.deepEqual(balance, await good("get_portal_statement", { token: portal.token }));
    assert.equal(balance.totalOutstandingMinor, String(amount));
    const html = await good("render_invoice", { id: saved.id }); assert.equal(html.document.totalMinor, String(amount));
    assert.ok(html.content.includes(documentMoneyText(amount, currency)));
    const xmlResponse = await ubl(req(), params(saved.id)); assert.equal(xmlResponse.status, 200);
    assert.equal(xmlResponse.headers.get("content-type"), "application/xml");
    const xml = await xmlResponse.text(); assert.equal(xml, (await good("export_invoice_ubl", { invoiceId: saved.id })).xml);
    const expectedMajor = scale === 1 ? String(amount) : `${BigInt(amount) / BigInt(scale)}.${String(BigInt(amount) % BigInt(scale)).padStart(scale === 1000 ? 3 : 2, "0")}`;
    assert.ok(xml.includes(`<cbc:PayableAmount currencyID="${currency}">${expectedMajor}</cbc:PayableAmount>`));
    assert.ok(xml.includes(`<cbc:PriceAmount currencyID="${currency}">${expectedMajor}</cbc:PriceAmount>`));
    const snap = await body(await backup(req())); assert.equal(snap.version, 2);
    assert.deepEqual(snap.entities, (await good("download_backup_snapshot")).snapshot.entities);
    assert.equal(snap.entities.invoices[0].totalMinor, String(amount));
    await unchanged(async () => {
      assert.equal((await mb.call("get_payment_link", { token })).body.status, 404);
      assert.equal((await no.call("download_backup_snapshot")).body.status, 403);
      assert.equal((await no.call("profit_and_loss", { startDate: date, endDate })).body.status, 403);
      const foreignCsv = await (await exportInvoices(req(undefined, "", keys.foreign))).text();
      assert.equal(foreignCsv.trim().split(/\r?\n/).length, 1);
      assert.equal((await getAccount(req(undefined, "", keys.foreign), params(revenue.id))).status, 404);
      assert.equal((await mb.call("get_account", { accountId: revenue.id })).body.status, 404);
      assert.equal((await ubl(req(undefined, "", keys.foreign), params(saved.id))).status, 404);
      assert.equal((await mb.call("export_invoice_ubl", { invoiceId: saved.id })).body.status, 404);
      assert.equal((await ubl(req(undefined, "", keys.denied), params(saved.id))).status, 403);
      assert.equal((await no.call("export_invoice_ubl", { invoiceId: saved.id })).body.status, 403);
      assert.equal((await ma.call("export_invoice_ubl", { invoiceId: saved.id, totalMinor: "1" })).error, true);
    });
    await db.update(contact).set({ addresses: null }).where(eq(contact.id, party.id));
    await unchanged(async () => {
      const missing = await body(await ubl(req(), params(saved.id)), 422);
      assert.ok(missing.details.some((error: { field: string }) => error.field === "customer.country"));
      assert.equal((await ma.call("export_invoice_ubl", { invoiceId: saved.id })).body.status, 422);
    });
    await db.update(contact).set({ addresses: { billing: { country: "US" } } }).where(eq(contact.id, party.id));
    // SQL text creates genuinely unsafe retained history without rounding first.
    await db.execute(sql`update invoice set total=9007199254740993, amount_due=9007199254740993 where id=${saved.id}`);
    await unchanged(async () => {
      for (const response of [await getInvoice(req(), params(saved.id)), await backup(req()), await paymentLink(req(), tokens(token)), await exportInvoices(req()), await ubl(req(), params(saved.id))])
        assert.equal((await body(response, 422)).code, "LEGACY_NUMERIC_RANGE");
      for (const [name, input] of [["get_invoice", { invoiceId: saved.id }], ["download_backup_snapshot", {}], ["get_payment_link", { token }], ["export_csv_data", { entityType: "invoices" }], ["render_invoice", { id: saved.id }], ["export_invoice_ubl", { invoiceId: saved.id }]] as const)
        assert.equal((await ma.call(name, input)).body.code, "LEGACY_NUMERIC_RANGE", name);
    });
    if (base === "USD" && !exact) {
      // Deliberately malformed retained references must not contaminate owned totals.
      const [foreignJournal, removed, draft, extra] = await db.insert(journalEntry).values([
        { organizationId: foreign.id, date, entryNumber: 1, description: "Foreign retained reference", status: "posted" },
        { organizationId: own.id, date, entryNumber: 2, description: "Deleted history", status: "posted", deletedAt: new Date() },
        { organizationId: own.id, date, entryNumber: 3, description: "Unposted draft", status: "draft" },
        { organizationId: own.id, date: endDate, entryNumber: 4, description: "Safe aggregate boundary", status: "posted" },
      ]).returning();
      await db.insert(journalLine).values([foreignJournal, removed, draft].map(j => ({ journalEntryId: j.id, accountId: revenue.id, creditAmount: 999 })));
      assert.equal((await good("get_account", { accountId: revenue.id })).account.balanceMinor, "1000");
      const [large] = await db.insert(journalLine).values({ journalEntryId: extra.id, accountId: revenue.id, creditAmount: Number.MAX_SAFE_INTEGER - 1000 }).returning();
      const maximum = await body(await getAccount(req(undefined, "?page=2&limit=1&sortOrder=asc"), params(revenue.id)));
      assert.equal(maximum.account.totalCreditsMinor, "9007199254740991");
      assert.equal(maximum.data.length, 1); assert.equal(maximum.data[0].balanceMinor, "9007199254740991");
      assert.equal(maximum.pagination.total, 2); assert.equal(maximum.account.entryCount, 2);
      assert.equal((await good("get_account", { accountId: revenue.id })).account.totalCredits, Number.MAX_SAFE_INTEGER);
      const filtered = await body(await getAccount(req(undefined, `?search=Safe&from=${endDate}&to=${endDate}&entryType=credits&sortBy=amount`), params(revenue.id)));
      assert.equal(filtered.data.length, 1); assert.equal(filtered.account.totalCreditsMinor, "9007199254740991");
      assert.equal(filtered.data[0].balanceMinor, "9007199254740991");
      await db.update(journalLine).set({ creditAmount: Number.MAX_SAFE_INTEGER - 998 }).where(eq(journalLine.id, large.id));
      await unchanged(async () => {
        assert.equal((await body(await getAccount(req(), params(revenue.id)), 422)).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call("get_account", { accountId: revenue.id })).body.code, "LEGACY_NUMERIC_RANGE");
      });
      await db.execute(sql`update journal_line set credit_amount=9007199254740993 where id=${large.id}`);
      await unchanged(async () => {
        assert.equal((await body(await getAccount(req(), params(revenue.id)), 422)).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call("get_account", { accountId: revenue.id })).body.code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call("get_account", { accountId: revenue.id, amountMinor: "1" })).error, true);
      });
    }
    console.log(`Combined ${label} ${exact ? "exact" : "legacy"} verified`);
  } finally { await ma.close(); await mb.close(); await no.close(); }
}
try {
  for (const [base, currency] of [["USD", "EUR"], ["IRR", "IRR"], ["JPY", "JPY"], ["KWD", "KWD"]]) {
    await scenario(base, currency, 1250, false); await scenario(base, currency, 3000000000, true);
  }
  console.log("Combined exact boundary contracts verified");
} finally { await db.$client.end(); }
