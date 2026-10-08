// Runs only in the harness's migrated disposable database; SMTP is recorded in memory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, subscription, chartAccount,
  invoice, bill, emailConfig } from "../../lib/db/schema";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { POST as createPayment } from "../../app/api/v1/payments/route";
import { GET as receivables } from "../../app/api/v1/reports/aged-receivables/route";
import { GET as payables } from "../../app/api/v1/reports/aged-payables/route";
import { GET as performance } from "../../app/api/v1/reports/payment-performance/route";
import { GET as statement } from "../../app/api/v1/contacts/[id]/statement/route";
import { GET as supplier } from "../../app/api/v1/contacts/[id]/supplier-statement/route";
import { GET as activity } from "../../app/api/v1/contacts/[id]/activity/route";
import { GET as print } from "../../app/api/v1/contacts/[id]/statement/pdf/route";
import { POST as email } from "../../app/api/v1/contacts/[id]/statement/email/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { registerContactStatementTools } from "../../lib/mcp/tools/contact-statements";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import { registerPaymentTools } from "../../lib/mcp/tools/payments";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import { encryptPassword } from "../../lib/email/smtp-client";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined receivable/payable reports", version: "1" });
  registerReportTools(server, ctx); registerContactStatementTools(server, ctx);
  registerBillTools(server, ctx); registerPaymentTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

function checkAliases(value: unknown) {
  if (Array.isArray(value)) { value.forEach(checkAliases); return; }
  if (!value || typeof value !== "object") return;
  const fields = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(fields)) {
    if (key.endsWith("Minor")) {
      const numeric = fields[key.slice(0, -5)];
      assert.equal(typeof numeric, "number"); assert.ok(Number.isSafeInteger(numeric));
      assert.equal(typeof child, "string"); assert.equal(BigInt(child as string), BigInt(numeric as number));
    } else checkAliases(child);
  }
}

async function run() {
  const [a, b] = await db.insert(organization).values([
    { name: "Combined <A>", slug: "rp-a" }, { name: "Combined B", slug: "rp-b" },
  ]).returning();
  const [owner, denied, reader] = await db.insert(users).values([
    { email: "rp-owner@example.test" }, { email: "rp-denied@example.test" }, { email: "rp-reader@example.test" },
  ]).returning();
  const roles = await db.insert(customRole).values([
    { organizationId: a.id, name: "No data", permissions: [] },
    { organizationId: a.id, name: "Data only", permissions: ["view:data"] },
  ]).returning();
  await db.insert(member).values([
    { organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: roles[0].id },
    { organizationId: a.id, userId: reader.id, role: "member", customRoleId: roles[1].id },
  ]);
  await db.insert(subscription).values({ organizationId: a.id, plan: "pro" });
  const keys = { a: "dk_rp_a", b: "dk_rp_b", denied: "dk_rp_denied", reader: "dk_rp_reader" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({
    organizationId: label === "b" ? b.id : a.id, createdBy: label === "denied" ? denied.id : label === "reader" ? reader.id : owner.id,
    name: label, keyPrefix: "dk_rp", keyHash: createHash("sha256").update(key).digest("hex"),
  });
  const [party, foreign] = await db.insert(contact).values([
    { organizationId: a.id, name: "Party <script>", type: "both", email: "party@example.test" },
    { organizationId: b.id, name: "Foreign secret", type: "both" },
  ]).returning();
  const accounts = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1200", name: "AR", type: "asset" },
    { organizationId: a.id, code: "2100", name: "AP", type: "liability" },
    { organizationId: a.id, code: "1100", name: "Cash", type: "asset" },
    { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" },
  ]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id });
  const noRead = await mcp({ ...ctx, userId: denied.id, role: "member", permissions: [] });
  const readOnly = await mcp({ ...ctx, userId: reader.id, role: "member", permissions: ["view:data"] });
  const request = (path: string, key = keys.a, body?: unknown) => new Request(`http://fixture.test/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST", headers: {
      authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id,
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = { params: Promise.resolve({ id: party.id }) };
  const period = { startDate: "2024-02-01", endDate: "2024-02-29" };
  const pairs = [
    { path: "reports/aged-receivables", tool: "aged_receivables", handler: (r: Request) => receivables(r), input: { asAt: period.endDate } },
    { path: "reports/aged-payables", tool: "aged_payables", handler: (r: Request) => payables(r), input: { asAt: period.endDate } },
    { path: "reports/payment-performance", tool: "payment_performance", handler: (r: Request) => performance(r), input: period },
    { path: `contacts/${party.id}/statement`, tool: "get_contact_statement", handler: (r: Request) => statement(r, params), input: period },
    { path: `contacts/${party.id}/supplier-statement`, tool: "get_purchasing_supplier_statement", handler: (r: Request) => supplier(r, params), input: period },
    { path: `contacts/${party.id}/activity`, tool: "get_contact_activity", handler: (r: Request) => activity(r, params), input: { ...period, limit: 100 } },
    { path: `contacts/${party.id}/statement/pdf`, tool: "export_contact_statement", handler: (r: Request) => print(r, params), input: period },
  ];
  const toolInput = (pair: typeof pairs[number], extra: Record<string, unknown> = {}) => ({
    ...(pair.path.startsWith("contacts/") ? { contactId: party.id } : {}), ...pair.input, ...extra,
  });
  const query = (input: object) => new URLSearchParams(Object.entries(input).map(([k, v]) => [k, String(v)]));
  const get = async (pair: typeof pairs[number], extra: Record<string, unknown> = {}) => {
    const response = await pair.handler(request(`${pair.path}?${query({ ...pair.input, ...extra })}`));
    assert.equal(response.status, 200, await response.clone().text());
    const result = await ma.call(pair.tool, toolInput(pair, extra)); assert.equal(result.isError, false, JSON.stringify(result.body));
    if (pair.tool === "export_contact_statement") {
      const html = await response.text(); assert.equal(result.body.html, html); return html;
    }
    const body = await response.json();
    assert.deepEqual(pair.tool === "get_purchasing_supplier_statement" ? result.body.statement : result.body, body);
    checkAliases(body);
    return body;
  };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["invoice", "invoice_line", "bill", "bill_line", "payment", "payment_allocation", "journal_entry", "journal_line", "audit_log", "email_config"])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    return result;
  };
  const write = async (kind: "invoice" | "bill", date: string, price: number | string) => {
    const body = { contactId: party.id, issueDate: date, dueDate: "2024-02-29", lines: [{
      description: "Shared cash history", accountId: accounts[kind === "invoice" ? 3 : 4].id,
      ...(typeof price === "number" ? { unitPrice: price } : { unitPriceMinor: price }),
    }] };
    let saved;
    if (kind === "invoice") {
      const response = await createInvoice(request("invoices", keys.a, body)); assert.equal(response.status, 201, await response.clone().text());
      saved = (await response.json()).invoice; await sendInvoice(ctx, saved.id);
    } else {
      const response = await ma.call("create_bill", body); assert.equal(response.isError, false, JSON.stringify(response.body));
      saved = response.body.bill; await receiveBill(ctx, saved.id);
    }
    assert.equal(BigInt(saved.totalMinor), BigInt(saved.total)); return saved.id as string;
  };
  const settle = async (kind: "invoice" | "bill", id: string, date: string, amount: number | string) => {
    const money = typeof amount === "number" ? { amount } : { amountMinor: amount };
    const body = { contactId: party.id, type: kind === "invoice" ? "received" : "made", date, ...money,
      allocations: [{ documentType: kind, documentId: id, ...money }] };
    if (kind === "invoice") {
      const result = await createPayment(request("payments", keys.a, body)); assert.equal(result.status, 201, await result.clone().text());
    } else {
      const result = await ma.call("create_payment", body); assert.equal(result.isError, false, JSON.stringify(result.body));
    }
  };
  const delivered: { to: string; html: string }[] = [];
  const transport = nodemailer.createTransport;
  nodemailer.createTransport = (() => ({ sendMail: async (mail: typeof delivered[number]) => { delivered.push(mail); return {}; } })) as typeof nodemailer.createTransport;
  try {
    const priorInvoice = await write("invoice", "2024-01-01", 10);
    const priorBill = await write("bill", "2024-01-01", "600");
    await settle("invoice", priorInvoice, "2024-01-15", 200); await settle("bill", priorBill, "2024-01-15", "100");
    const paidInvoice = await write("invoice", "2024-02-01", 12.5);
    const futurePaid = await write("invoice", "2024-02-01", "2147483648");
    const paidBill = await write("bill", "2024-02-01", 5);
    await write("bill", "2024-02-01", "1000");
    await settle("invoice", paidInvoice, "2024-02-10", "1250"); await settle("bill", paidBill, "2024-02-11", 500);
    await settle("invoice", futurePaid, "2024-03-02", "2147483648");
    // Settlement stamps wall-clock paidAt. Retained timing dates are pinned separately;
    // performance uses these stored dates, while aging/statements use cash dates.
    await db.update(invoice).set({ paidAt: new Date("2024-02-10T12:00:00Z") }).where(eq(invoice.id, paidInvoice));
    await db.update(invoice).set({ paidAt: new Date("2024-03-02T12:00:00Z") }).where(eq(invoice.id, futurePaid));
    await db.update(bill).set({ paidAt: new Date("2024-02-11T12:00:00Z") }).where(eq(bill.id, paidBill));
    await db.insert(invoice).values({ organizationId: b.id, contactId: foreign.id, invoiceNumber: "FOREIGN", issueDate: "2024-02-01",
      dueDate: "2024-02-29", status: "sent", total: 999, amountDue: 999 });
    await db.insert(emailConfig).values({ organizationId: a.id, smtpHost: "fixture.invalid", smtpUsername: "fixture",
      smtpPassword: encryptPassword("synthetic"), fromEmail: "from@example.test" });
    const saved = await snapshot();
    const [ar, ap, timing, general, payable, feed, html] = await Promise.all(pairs.map(pair => get(pair)));
    assert.equal(ar.grandTotalMinor, "2147484448"); assert.equal(ap.grandTotalMinor, "1500");
    assert.equal(general.openingBalanceMinor, "300"); assert.equal(general.closingBalanceMinor, "2147482948");
    assert.equal(BigInt(general.closingBalanceMinor), BigInt(ar.grandTotalMinor) - BigInt(ap.grandTotalMinor));
    assert.equal(payable.openingBalanceMinor, "500"); assert.equal(payable.closingBalanceMinor, ap.grandTotalMinor);
    assert.equal(timing.receivables[0].totalCollectedMinor, "2147484898"); assert.equal(timing.receivables[0].invoiceCount, 2);
    assert.equal(timing.receivables[0].lateCount, 1); assert.equal(timing.receivables[0].onTimeRate, 50);
    assert.equal(timing.payables[0].totalPaidMinor, "500");
    assert.ok(feed.activity.some((row: { amountMinor: string }) => row.amountMinor === "2147483648"));
    assert.match(html, /\$21,474,829\.48/); assert.match(html, /Party &lt;script&gt;/);
    // Live stored balances exclude the future-settled invoice; historical mode restores it.
    const live = await (await receivables(request("reports/aged-receivables"))).json(); assert.equal(live.grandTotalMinor, "800");
    assert.deepEqual((await ma.call("aged_receivables", {})).body, live);
    assert.deepEqual(await snapshot(), saved);
    const ExcelJS = (await import("exceljs")).default;
    for (const pair of pairs.slice(0, 2)) {
      const response = await pair.handler(request(`${pair.path}?asAt=${period.endDate}&format=xlsx`)); assert.equal(response.status, 200);
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
      const total = pair.tool === "aged_receivables" ? ar.grandTotal : ap.grandTotal;
      const lastValues = workbook.worksheets[0].lastRow!.values;
      assert.ok(Array.isArray(lastValues)); assert.ok(lastValues.includes(total / 100));
      const exported = await ma.call("export_financial_statement", { statement: pair.tool, format: "xlsx", asAt: period.endDate });
      assert.equal(exported.isError, false);
      const mBook = new ExcelJS.Workbook(); await mBook.xlsx.load(Buffer.from(exported.body.data, "base64") as never);
      assert.deepEqual(mBook.worksheets[0].getSheetValues(), workbook.worksheets[0].getSheetValues());
      const exportInput = { statement: pair.tool, format: "xlsx", asAt: period.endDate };
      assert.equal((await ma.call("export_financial_statement", { ...exportInput, unsupported: 1 })).isError, true);
      assert.equal((await noRead.call("export_financial_statement", exportInput)).body.status, 403);
      const other = await mb.call("export_financial_statement", exportInput); assert.equal(other.isError, false);
      const otherBook = new ExcelJS.Workbook(); await otherBook.xlsx.load(Buffer.from(other.body.data, "base64") as never);
      const otherLast = otherBook.worksheets[0].lastRow!.values;
      assert.ok(Array.isArray(otherLast)); assert.ok(otherLast.includes(pair.tool === "aged_receivables" ? 9.99 : 0));
    }
    assert.equal((await email(request(`contacts/${party.id}/statement/email`, keys.a, period), params)).status, 200);
    assert.equal((await ma.call("email_contact_statement", { contactId: party.id, ...period })).body.success, true);
    assert.equal(delivered.length, 2); assert.equal(delivered[0].html, delivered[1].html);
    assert.equal(delivered[0].to, party.email); assert.match(delivered[0].html, /\$21,474,829\.48/);
    for (const pair of pairs) {
      const path = `${pair.path}?${query(pair.input)}`;
      for (const [key, status] of [["dk_invalid", 401], [keys.denied, 403]] as const)
        assert.equal((await pair.handler(request(path, key))).status, status);
      assert.equal((await noRead.call(pair.tool, toolInput(pair))).isError, true);
      assert.equal((await pair.handler(request(path, keys.reader))).status, 200);
      assert.equal((await readOnly.call(pair.tool, toolInput(pair))).isError, false);
      if (pair.path.startsWith("contacts/")) {
        assert.equal((await pair.handler(request(path, keys.b))).status, 404);
        assert.equal((await mb.call(pair.tool, toolInput(pair))).body.status, 404);
      } else {
        const response = await pair.handler(request(path, keys.b)); assert.equal(response.status, 200);
        const body = await response.json(); assert.deepEqual((await mb.call(pair.tool, toolInput(pair))).body, body);
        assert.ok(!JSON.stringify(body).includes(party.id));
      }
      assert.equal((await pair.handler(request(`${path}&unsupported=1`))).status, 400);
      assert.equal((await ma.call(pair.tool, toolInput(pair, { unsupported: 1 }))).isError, true, `${pair.tool} accepted unknown input`);
      const badDate = { [pair.tool.startsWith("aged_") ? "asAt" : "endDate"]: "2023-02-29" };
      assert.equal((await pair.handler(request(`${pair.path}?${query({ ...pair.input, ...badDate })}`))).status, 400);
      assert.equal((await ma.call(pair.tool, toolInput(pair, badDate))).isError, true);
    }
    assert.equal((await email(request(`contacts/${party.id}/statement/email`, keys.reader, period), params)).status, 403);
    assert.equal((await readOnly.call("email_contact_statement", { contactId: party.id, ...period })).body.status, 403);
    assert.equal((await ma.call("email_contact_statement", { contactId: party.id, ...period, unsupported: 1 })).isError, true);
    assert.equal((await email(request(`contacts/${party.id}/statement/email`, keys.a, { ...period, unsupported: 1 }), params)).status, 400);
    for (const bad of [{ endDate: "2023-02-29" }, { startDate: "2024-03-01" }, { currencyCode: "XXX" }]) {
      assert.equal((await email(request(`contacts/${party.id}/statement/email`, keys.a, { ...period, ...bad }), params)).status, 400);
      assert.equal((await ma.call("email_contact_statement", { contactId: party.id, ...period, ...bad })).isError, true);
    }
    assert.equal(delivered.length, 2); assert.deepEqual(await snapshot(), saved);
    // A second currency must fail consistently in unfiltered aggregating readers,
    // while activity retains each item's own currency and amount alias.
    for (const currency of ["IRR", "JPY", "KWD"]) {
      const [i] = await db.insert(invoice).values({ organizationId: a.id, contactId: party.id, invoiceNumber: `I-${currency}`,
        issueDate: "2024-02-01", dueDate: "2024-02-29", status: "paid", total: 1250, amountDue: 0,
        currencyCode: currency, paidAt: new Date("2024-02-10T00:00:00Z") }).returning();
      const [p] = await db.insert(bill).values({ organizationId: a.id, contactId: party.id, billNumber: `B-${currency}`,
        issueDate: "2024-02-01", dueDate: "2024-02-29", status: "received", total: 250, amountDue: 250, currencyCode: currency }).returning();
      const before = await snapshot();
      for (const pair of pairs.filter(p => p.tool !== "get_contact_activity")) {
        // AR historical includes the paid foreign-currency document with no cash allocations.
        assert.equal((await pair.handler(request(`${pair.path}?${query(pair.input)}`))).status, 422);
        assert.equal((await ma.call(pair.tool, toolInput(pair))).body.code, "LEGACY_NUMERIC_RANGE");
      }
      const filtered = await Promise.all(pairs.filter(p => p.tool !== "get_contact_activity").map(p => get(p, { currencyCode: currency })));
      assert.equal(filtered[0].grandTotalMinor, "1250"); assert.equal(filtered[1].grandTotalMinor, "250");
      assert.equal(filtered[2].receivables[0].totalCollectedMinor, "1250");
      assert.equal(filtered[3].closingBalanceMinor, "1000"); assert.equal(filtered[4].closingBalanceMinor, "250");
      const scale = currency === "KWD" ? 1000 : 1;
      const response = await receivables(request(`reports/aged-receivables?asAt=${period.endDate}&currencyCode=${currency}&format=xlsx`));
      assert.equal(response.status, 200);
      const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
      const cells: unknown[] = []; book.worksheets[0].eachRow(row => row.eachCell(cell => cells.push(cell.value)));
      assert.ok(cells.includes(1250 / scale));
      const multiFeed = await get(pairs[5]); assert.ok(multiFeed.activity.some((r: { currencyCode: string; amountMinor: string }) => r.currencyCode === currency && r.amountMinor === "1250"));
      const sent: number = delivered.length;
      assert.equal((await email(request(`contacts/${party.id}/statement/email`, keys.a, period), params)).status, 422);
      assert.equal((await ma.call("email_contact_statement", { contactId: party.id, ...period })).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal(delivered.length, sent); assert.deepEqual(await snapshot(), before);
      await db.delete(invoice).where(eq(invoice.id, i.id)); await db.delete(bill).where(eq(bill.id, p.id));
    }
    // An unsupported stored int64 is rejected on every reader/delivery path.
    await db.execute(sql`update bill set total=9223372036854775807 where id=${paidBill}`);
    const beforeFailure = await snapshot();
    for (const pair of pairs) {
      // Aging evaluates original totals even for fully paid historical documents.
      if (pair.tool === "aged_receivables") continue;
      assert.equal((await pair.handler(request(`${pair.path}?${query(pair.input)}`))).status, 422);
      assert.equal((await ma.call(pair.tool, toolInput(pair))).body.code, "LEGACY_NUMERIC_RANGE");
    }
    assert.equal((await email(request(`contacts/${party.id}/statement/email`, keys.a, period), params)).status, 422);
    assert.equal((await ma.call("email_contact_statement", { contactId: party.id, ...period })).body.code, "LEGACY_NUMERIC_RANGE");
    assert.equal(delivered.length, 2); assert.deepEqual(await snapshot(), beforeFailure);
    console.log("Combined receivable/payable contracts verified");
  } finally {
    nodemailer.createTransport = transport;
    await ma.close(); await mb.close(); await noRead.close(); await readOnly.close();
  }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
