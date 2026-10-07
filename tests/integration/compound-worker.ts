import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, journalEntry, journalLine, costCenter, project, contact, invoice, bill } from "../../lib/db/schema";
import { GET as tracking } from "../../app/api/v1/reports/tracking-category/route";
import { GET as pack } from "../../app/api/v1/reports/pack/route";
import { GET as ratios } from "../../app/api/v1/reports/financial-ratios/route";
import { GET as balanceSheet } from "../../app/api/v1/reports/balance-sheet/route";
import { GET as profitLoss } from "../../app/api/v1/reports/profit-and-loss/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Compound fixture", version: "1" }); registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["tracking_category_report", "report_pack", "financial_ratios", "export_report_pack", "export_tracking_category_report"]) {
    assert.ok(tools.some(tool => tool.name === name));
  }
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Compound A", slug: "compound-a" }, { name: "Compound B", slug: "compound-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "compound-owner@example.test" }, { email: "compound-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_compound_a", b: "dk_compound_b", denied: "dk_compound_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_compound" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const request = (query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/reports/compound${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const accounts = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1000", name: "=Bank", type: "asset" as const, subType: "bank" },
    { organizationId: a.id, code: "1010", name: "Cash", type: "asset" as const, subType: "cash" },
    { organizationId: a.id, code: "1200", name: "Inventory", type: "asset" as const, subType: "inventory" },
    { organizationId: a.id, code: "1300", name: "Fixed", type: "asset" as const, subType: "fixed_asset" },
    { organizationId: a.id, code: "2000", name: "AP", type: "liability" as const, subType: "accounts_payable" },
    { organizationId: a.id, code: "3000", name: "Equity", type: "equity" as const },
    { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" as const },
  ]).returning();
  const [bank, cash, inventory, fixed, ap, equity, revenue, expense] = accounts;
  const [foreign] = await db.insert(chartAccount).values({ organizationId: b.id, code: "1000", name: "Foreign secret", type: "asset", subType: "bank" }).returning();
  const [cc1, cc2, ccForeign] = await db.insert(costCenter).values([
    { organizationId: a.id, code: "A", name: "Alpha", deletedAt: new Date() }, { organizationId: a.id, code: "B", name: "Beta" },
    { organizationId: b.id, code: "C", name: "Foreign secret" },
  ]).returning();
  const [pr, prForeign] = await db.insert(project).values([{ organizationId: a.id, name: "Owned project" }, { organizationId: b.id, name: "Foreign secret" }]).returning();
  let sequence = 0;
  const entry = async (lines: { accountId: string; debit?: number; credit?: number; costCenterId?: string; projectId?: string }[],
    date = "2024-01-15", status: "posted" | "draft" | "void" = "posted", org = a.id, deleted = false, sourceType = "manual") => {
    const [saved] = await db.insert(journalEntry).values({ organizationId: org, entryNumber: ++sequence, date, status, description: "Synthetic",
      deletedAt: deleted ? new Date() : null, sourceType }).returning();
    await db.insert(journalLine).values(lines.map(line => ({ journalEntryId: saved.id, accountId: line.accountId,
      debitAmount: line.debit ?? 0, creditAmount: line.credit ?? 0, costCenterId: line.costCenterId, projectId: line.projectId, currencyCode: "IRR" })));
    return saved;
  };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["journal_entry", "journal_line", "chart_account", "invoice", "bill", "cost_center", "project", "audit_log"]) {
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    }
    return result;
  };
  const args = { startDate: "2024-01-01", endDate: "2024-01-31" }, query = "?startDate=2024-01-01&endDate=2024-01-31";
  const pairs = [[tracking, "tracking_category_report"], [pack, "report_pack"], [ratios, "financial_ratios"]] as const;
  const get = async (handler: typeof tracking, q: string, key = keys.a) => {
    const response = await handler(request(q, key)); assert.equal(response.status, 200); return response.json();
  };
  const parity = async (handler: typeof tracking, name: string, input: Record<string, unknown> = args, q = query, client = ma, key = keys.a) => {
    const body = await get(handler, q + (handler === pack ? `${q ? "&" : "?"}format=json` : ""), key);
    const tool = await client.call(name, input); assert.equal(tool.isError, false); assert.deepEqual(tool.body, body);
    return body;
  };
  const rangeFailure = async (handler: typeof tracking, name: string, input = args, q = query) => {
    const saved = await snapshot();
    const response = await handler(request(q + (handler === pack ? "&format=json" : "")));
    assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
    const tool = await ma.call(name, input); assert.equal(tool.isError, true); assert.equal(tool.body.code, "LEGACY_NUMERIC_RANGE");
    assert.deepEqual(await snapshot(), saved);
  };
  try {
    const emptyTracking = await parity(tracking, "tracking_category_report"); assert.deepEqual(emptyTracking.columns, []);
    assert.deepEqual(emptyTracking.netIncome, { byColumn: [], byColumnMinor: [], total: 0, totalMinor: "0" });
    assert.equal((await parity(pack, "report_pack")).statements.length, 4);
    assert.equal((await parity(ratios, "financial_ratios")).ratios.currentRatio, null);
    await entry([{ accountId: bank.id, debit: 100 }, { accountId: revenue.id, credit: 100 }], "2023-12-31");
    await entry([{ accountId: bank.id, debit: 1250 }, { accountId: revenue.id, credit: 1250, costCenterId: cc1.id, projectId: pr.id }], "2024-01-01");
    await entry([{ accountId: expense.id, debit: 250, costCenterId: cc2.id }, { accountId: bank.id, credit: 250 }], "2024-01-31");
    await entry([{ accountId: inventory.id, debit: 100 }, { accountId: ap.id, credit: 100 }]);
    await entry([{ accountId: fixed.id, debit: 200 }, { accountId: equity.id, credit: 200 }]);
    await entry([{ accountId: cash.id, debit: 10 }, { accountId: bank.id, credit: 10 }]);
    await entry([{ accountId: revenue.id, debit: 1 }, { accountId: cash.id, credit: 1 }], undefined, "posted", a.id, false, "payment");
    await entry([{ accountId: bank.id, debit: 777 }, { accountId: revenue.id, credit: 777 }], "2024-02-01");
    for (const status of ["draft", "void"] as const) await entry([{ accountId: bank.id, debit: 888 }, { accountId: revenue.id, credit: 888 }], undefined, status);
    await entry([{ accountId: bank.id, debit: 888 }], undefined, "posted", a.id, true);
    await entry([{ accountId: foreign.id, debit: 777 }], undefined, "posted", b.id);
    await entry([{ accountId: foreign.id, debit: 888 }], undefined, "posted", a.id);
    await entry([{ accountId: bank.id, debit: 888 }], undefined, "posted", b.id);
    const [customer] = await db.insert(contact).values({ organizationId: a.id, name: "Synthetic customer" }).returning();
    const [vendor] = await db.insert(contact).values({ organizationId: a.id, name: "Synthetic vendor", type: "supplier" }).returning();
    const [inv] = await db.insert(invoice).values({ organizationId: a.id, contactId: customer.id, invoiceNumber: "fixture", issueDate: "2024-01-01", dueDate: "2024-02-01", status: "sent", amountDue: 50 }).returning();
    await db.insert(bill).values({ organizationId: a.id, contactId: vendor.id, billNumber: "fixture", issueDate: "2024-01-01", dueDate: "2024-02-01", status: "received", amountDue: 25 });
    await db.insert(invoice).values({ organizationId: a.id, contactId: customer.id, invoiceNumber: "deleted", issueDate: "2024-01-01", dueDate: "2024-02-01", status: "sent", amountDue: 999, deletedAt: new Date(), currencyCode: "BAD" });
    const saved = await snapshot();
    const tr = await parity(tracking, "tracking_category_report");
    assert.deepEqual(tr.columns.map((column: { label: string }) => column.label), ["A Alpha", "B Beta", "Unassigned"]);
    assert.deepEqual(tr.netIncome.byColumnMinor, ["1250", "-250", "-1"]); assert.equal(tr.netIncome.total, 999);
    assert.deepEqual(tr.sections[0].accounts[0].amountsMinor, ["1250", "0", "-1"]);
    await parity(tracking, "tracking_category_report", { ...args, mode: "balances" }, query + "&mode=balances");
    const projectReport = await parity(tracking, "tracking_category_report", { ...args, dimension: "projectId" }, query + "&dimension=projectId");
    assert.equal(projectReport.columns[0].label, "Owned project");
    await parity(tracking, "tracking_category_report", { ...args, dimension: "project" }, query + "&dimension=project");
    const rp = await parity(pack, "report_pack");
    assert.equal(rp.statements[0].sections[2].rows.at(-1).amountMinor, "1099");
    assert.equal(rp.statements[1].grandTotalMinor, "999");
    assert.deepEqual(rp.statements[2].grandTotalsMinor, ["1649", "1649"]);
    assert.equal(rp.statements[3].sections[0].rows[0].amountMinor, "100");
    assert.equal(rp.statements[3].grandTotalMinor, "1099");
    const standaloneBalance = await get(balanceSheet, "?asAt=2024-01-31");
    assert.equal(standaloneBalance.equity.totalMinor, rp.statements[0].sections[2].subtotalMinor);
    assert.equal((await get(profitLoss, query)).netIncomeMinor, rp.statements[1].grandTotalMinor);
    const ra = await parity(ratios, "financial_ratios");
    assert.equal(ra.balances.totalAssetsMinor, "1399"); assert.equal(ra.balances.receivablesDueMinor, "50");
    assert.equal(ra.balances.payablesDueMinor, "25"); assert.equal(ra.ratios.currentRatio, 11.99); assert.equal(ra.ratiosExact.currentRatio, "11.99");
    assert.equal(ra.ratios.dso, 1); assert.equal(ra.ratios.dpo, 3);
    for (const [handler, name] of pairs) {
      await parity(handler, name, args, query, mb, keys.b);
      assert.equal((await handler(request(query, "dk_bad_key"))).status, 401);
      assert.equal((await handler(request(query, keys.denied))).status, 403);
      assert.equal((await noRead.call(name, args)).isError, true);
      for (const bad of ["&startDate=2024-01-01", "&amountMinor=1", "&endDate=bad"]) assert.equal((await handler(request(query + bad))).status, 400);
      assert.equal((await handler(request("?startDate=2024-02-30"))).status, 400);
      assert.equal((await handler(request("?startDate=2025-01-01&endDate=2024-01-01"))).status, 400);
      for (const input of [{ ...args, extra: "bad" }, { ...args, startDate: "2024-02-30" }, { ...args, endDate: "2023-01-01" }]) assert.equal((await ma.call(name, input)).isError, true);
      await parity(handler, name, {}, "");
    }
    assert.deepEqual(await snapshot(), saved);
    for (const handler of [tracking, pack]) {
      for (const basis of ["cash", "accrual"]) await parity(handler, handler === pack ? "report_pack" : "tracking_category_report", { ...args, basis }, query + `&basis=${basis}`);
    }
    for (const dimension of ["costCenterId", "projectId"] as const) {
      const corrupt = await entry([{ accountId: revenue.id, credit: 1, [dimension]: dimension === "costCenterId" ? ccForeign.id : prForeign.id }]);
      await rangeFailure(tracking, "tracking_category_report", { ...args, dimension } as typeof args, query + `&dimension=${dimension}`);
      await db.delete(journalEntry).where(eq(journalEntry.id, corrupt.id));
    }
    await db.update(invoice).set({ currencyCode: "IRR" }).where(eq(invoice.id, inv.id));
    await rangeFailure(ratios, "financial_ratios");
    await db.update(invoice).set({ currencyCode: "USD" }).where(eq(invoice.id, inv.id));
    const ExcelJS = (await import("exceljs")).default;
    const load = async (buffer: Buffer) => { const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as never); return workbook; };
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      await db.update(invoice).set({ currencyCode: currency }).where(eq(invoice.organizationId, a.id));
      await db.update(bill).set({ currencyCode: currency }).where(eq(bill.organizationId, a.id));
      for (const [handler, name] of pairs) assert.equal((await parity(handler, name)).currencyCode, currency);
      const response = await pack(request(query)); assert.equal(response.status, 200);
      const workbook = await load(Buffer.from(await response.arrayBuffer())); assert.equal(workbook.worksheets.length, 4);
      const bankLabel = workbook.worksheets[0].getColumn(2).values.find(value => typeof value === "string" && value.includes("Bank"));
      assert.equal(String(bankLabel).trim(), "'=Bank");
      const values: unknown[] = []; workbook.worksheets[1].eachRow(row => row.eachCell(cell => values.push(cell.value)));
      assert.ok(values.includes(currency === "USD" ? 12.49 : currency === "KWD" ? 1.249 : 1249));
      const exported = await ma.call("export_report_pack", args); assert.equal(exported.isError, false);
      assert.equal((await load(Buffer.from(exported.body.data, "base64"))).worksheets.length, 4);
      const trackExport = await tracking(request(query + "&format=xlsx")); assert.equal(trackExport.status, 200);
      const trackWorkbook = await load(Buffer.from(await trackExport.arrayBuffer()));
      const trackValues: unknown[] = []; trackWorkbook.worksheets[0].eachRow(row => row.eachCell(cell => trackValues.push(cell.value)));
      assert.ok(trackValues.includes(currency === "USD" ? 12.5 : currency === "KWD" ? 1.25 : 1250));
      assert.equal((await ma.call("export_tracking_category_report", { ...args, format: "xlsx" })).isError, false);
    }
    const pdf = await tracking(request(query + "&format=pdf")); assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    const toolPdf = await ma.call("export_tracking_category_report", { ...args, format: "pdf" }); assert.equal(toolPdf.isError, false);
    assert.equal(Buffer.from(toolPdf.body.data, "base64").subarray(0, 5).toString(), "%PDF-");
    assert.equal((await noRead.call("export_report_pack", args)).isError, true);
    assert.equal((await noRead.call("export_tracking_category_report", { ...args, format: "pdf" })).isError, true);
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    await db.update(invoice).set({ currencyCode: "USD" }).where(eq(invoice.organizationId, a.id));
    await db.update(bill).set({ currencyCode: "USD" }).where(eq(bill.organizationId, a.id));
    // Gross SQL sums above int64 cancel before any numeric projection.
    const gross = await entry([{ accountId: bank.id }, { accountId: bank.id }], "0001-01-01");
    await db.execute(sql`update ${journalLine} set debit_amount=9223372036854775807, credit_amount=9223372036854775807 where journal_entry_id=${gross.id}`);
    const edgeArgs = { startDate: "0001-01-01", endDate: "0001-01-31" }, edgeQuery = "?startDate=0001-01-01&endDate=0001-01-31";
    for (const [handler, name] of pairs) await parity(handler, name, edgeArgs, edgeQuery);
    await db.delete(journalEntry).where(eq(journalEntry.id, gross.id));
    const edge = await entry([{ accountId: bank.id, debit: Number.MAX_SAFE_INTEGER }, { accountId: revenue.id, credit: Number.MAX_SAFE_INTEGER }], "0001-01-01");
    assert.equal((await parity(pack, "report_pack", edgeArgs, edgeQuery)).statements[1].grandTotalMinor, String(Number.MAX_SAFE_INTEGER));
    assert.equal((await parity(tracking, "tracking_category_report", edgeArgs, edgeQuery)).netIncome.totalMinor, String(Number.MAX_SAFE_INTEGER));
    assert.equal((await parity(ratios, "financial_ratios", edgeArgs, edgeQuery)).balances.totalAssetsMinor, String(Number.MAX_SAFE_INTEGER));
    assert.equal((await pack(request(edgeQuery))).status, 422);
    assert.equal((await ma.call("export_report_pack", edgeArgs)).body.code, "LEGACY_NUMERIC_RANGE");
    assert.equal((await tracking(request(edgeQuery + "&format=xlsx"))).status, 422);
    assert.equal((await ma.call("export_tracking_category_report", { ...edgeArgs, format: "xlsx" })).body.code, "LEGACY_NUMERIC_RANGE");
    const one = await entry([{ accountId: bank.id, debit: 1 }, { accountId: revenue.id, credit: 1 }], "0001-01-01");
    for (const [handler, name] of pairs) await rangeFailure(handler, name, edgeArgs, edgeQuery);
    await db.delete(journalEntry).where(eq(journalEntry.id, one.id));
    await db.execute(sql`update ${journalLine} set debit_amount=credit_amount, credit_amount=debit_amount where journal_entry_id=${edge.id}`);
    assert.equal((await parity(tracking, "tracking_category_report", edgeArgs, edgeQuery)).netIncome.totalMinor, String(-Number.MAX_SAFE_INTEGER));
    await parity(pack, "report_pack", edgeArgs, edgeQuery); await parity(ratios, "financial_ratios", edgeArgs, edgeQuery);
    const negativeOne = await entry([{ accountId: bank.id, credit: 1 }, { accountId: revenue.id, debit: 1 }], "0001-01-01");
    for (const [handler, name] of pairs) await rangeFailure(handler, name, edgeArgs, edgeQuery);
    await db.delete(journalEntry).where(eq(journalEntry.id, negativeOne.id));
    await db.delete(journalEntry).where(eq(journalEntry.id, edge.id));
    // Safe cells in different columns overflow the row/global total.
    const rowOverflow = await entry([{ accountId: revenue.id, credit: Number.MAX_SAFE_INTEGER, costCenterId: cc1.id }, { accountId: revenue.id, credit: 1, costCenterId: cc2.id }], "0001-01-01");
    await rangeFailure(tracking, "tracking_category_report", edgeArgs, edgeQuery);
    await db.delete(journalEntry).where(eq(journalEntry.id, rowOverflow.id));
    // Distinct safe rows overflow a section subtotal without overflowing either row.
    const [extraRevenue] = await db.insert(chartAccount).values({ organizationId: a.id, code: "4100", name: "Extra revenue", type: "revenue" }).returning();
    const sectionOverflow = await entry([{ accountId: revenue.id, credit: Number.MAX_SAFE_INTEGER, costCenterId: cc1.id },
      { accountId: extraRevenue.id, credit: 1, costCenterId: cc1.id }], "0001-01-01");
    for (const [handler, name] of pairs) await rangeFailure(handler, name, edgeArgs, edgeQuery);
    await db.delete(journalEntry).where(eq(journalEntry.id, sectionOverflow.id));
    // Individually safe revenue/expense totals overflow the combined income.
    const combined = await entry([{ accountId: revenue.id, credit: Number.MAX_SAFE_INTEGER }, { accountId: expense.id, credit: 1 }], "0001-01-01");
    for (const [handler, name] of pairs) await rangeFailure(handler, name, edgeArgs, edgeQuery);
    await db.delete(journalEntry).where(eq(journalEntry.id, combined.id));
    // Every balance is safe, but the rounded ratio's final decimal digit cannot round-trip.
    const ratioPrecision = await entry([{ accountId: bank.id, debit: 9007199254740990 }, { accountId: ap.id, credit: 100 }], "0001-01-01");
    await rangeFailure(ratios, "financial_ratios", edgeArgs, edgeQuery);
    await db.delete(journalEntry).where(eq(journalEntry.id, ratioPrecision.id));
    await db.update(organization).set({ defaultCurrency: "BAD" }).where(eq(organization.id, a.id));
    for (const [handler, name] of pairs) await rangeFailure(handler, name);
    console.log("REST and MCP compound reports verified");
  } finally { await ma.close(); await mb.close(); await noRead.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
