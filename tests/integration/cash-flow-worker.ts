import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, journalEntry, journalLine } from "../../lib/db/schema";
import { GET } from "../../app/api/v1/reports/cash-flow/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Cash flow fixture", version: "1" }); registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  assert.match(tools.find(tool => tool.name === "cash_flow_statement")!.description!, /Minor strings/);
  assert.ok(tools.some(tool => tool.name === "export_cash_flow_statement"));
  return { async call(args: Record<string, unknown> = {}, name = "cash_flow_statement") {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Cash A", slug: "cf-a" }, { name: "Cash B", slug: "cf-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "cf-owner@example.test" }, { email: "cf-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_cf_a", b: "dk_cf_b", denied: "dk_cf_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_cf" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const request = (query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/reports/cash-flow${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const accounts = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1000", name: "Bank", type: "asset" as const, subType: "bank" },
    { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" as const },
    { organizationId: a.id, code: "1100", name: "AR", type: "asset" as const, subType: "accounts_receivable" },
    { organizationId: a.id, code: "2000", name: "AP", type: "liability" as const, subType: "accounts_payable" },
    { organizationId: a.id, code: "1200", name: "Inventory", type: "asset" as const, subType: "inventory" },
    { organizationId: a.id, code: "1300", name: "Fixed", type: "asset" as const, subType: "fixed_asset" },
    { organizationId: a.id, code: "1390", name: "Depreciation", type: "asset" as const, subType: "accumulated_depreciation" },
    { organizationId: a.id, code: "2100", name: "Loan", type: "liability" as const, subType: "long_term_liability" },
    { organizationId: a.id, code: "3000", name: "Equity", type: "equity" as const },
    { organizationId: a.id, code: "1010", name: "Cash", type: "asset" as const, subType: "cash" },
  ]).returning();
  const [bank, revenue, expense, ar, ap, inventory, fixed, dep, loan, equity, cash] = accounts;
  const [foreign] = await db.insert(chartAccount).values({ organizationId: b.id, code: "1000", name: "Foreign secret", type: "asset", subType: "bank" }).returning();
  let sequence = 0;
  const entry = async (lines: { accountId: string; debit?: number; credit?: number }[], date = "2024-01-15",
    status: "posted" | "draft" | "void" = "posted", org = a.id, deleted = false, sourceType = "manual") => {
    const [saved] = await db.insert(journalEntry).values({ organizationId: org, entryNumber: ++sequence, date, status, description: "Synthetic entry",
      deletedAt: deleted ? new Date() : null, sourceType }).returning();
    await db.insert(journalLine).values(lines.map(line => ({ journalEntryId: saved.id, accountId: line.accountId,
      debitAmount: line.debit ?? 0, creditAmount: line.credit ?? 0, currencyCode: "IRR" })));
    return saved;
  };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["journal_entry", "journal_line", "chart_account", "audit_log"]) {
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    }
    return result;
  };
  const args = { startDate: "2024-01-01", endDate: "2024-01-31" };
  const query = "?startDate=2024-01-01&endDate=2024-01-31";
  const get = async (q = query) => { const response = await GET(request(q)); assert.equal(response.status, 200); return response.json(); };
  const parity = async (method: "indirect" | "direct" = "indirect", basis: "accrual" | "cash" = "accrual") => {
    const body = await get(query + `&method=${method}&basis=${basis}`);
    const tool = await ma.call({ ...args, method, basis }); assert.equal(tool.isError, false); assert.deepEqual(tool.body, body);
    return body;
  };
  try {
    const empty = await parity(); assert.equal(empty.netCashFlowMinor, "0"); assert.equal(empty.reconciliation.balanced, true);
    await entry([{ accountId: bank.id, debit: 100 }, { accountId: equity.id, credit: 100 }], "2023-12-31");
    await entry([{ accountId: bank.id, debit: 1250 }, { accountId: revenue.id, credit: 1250 }], "2024-01-01");
    await entry([{ accountId: expense.id, debit: 250 }, { accountId: bank.id, credit: 250 }], "2024-01-31");
    await entry([{ accountId: ar.id, debit: 300 }, { accountId: revenue.id, credit: 300 }]);
    await entry([{ accountId: expense.id, debit: 100 }, { accountId: dep.id, credit: 100 }], undefined, "posted", a.id, false, "depreciation");
    await entry([{ accountId: fixed.id, debit: 200 }, { accountId: bank.id, credit: 200 }]);
    await entry([{ accountId: loan.id, debit: 50 }, { accountId: bank.id, credit: 50 }], undefined, "posted", a.id, false, "loan_payment");
    await entry([{ accountId: equity.id, credit: 400 }, { accountId: bank.id, debit: 400 }]);
    await entry([{ accountId: ap.id, credit: 150 }, { accountId: expense.id, debit: 150 }]);
    await entry([{ accountId: inventory.id, debit: 120 }, { accountId: ap.id, credit: 120 }]);
    await entry([{ accountId: bank.id, debit: 999 }, { accountId: revenue.id, credit: 999 }], "2024-02-01");
    for (const status of ["draft", "void"] as const) await entry([{ accountId: bank.id, debit: 888 }], undefined, status);
    await entry([{ accountId: bank.id, debit: 888 }], undefined, "posted", a.id, true);
    await entry([{ accountId: foreign.id, debit: 777 }], undefined, "posted", b.id);
    await entry([{ accountId: foreign.id, debit: 888 }], undefined, "posted", a.id, false, "depreciation");
    await entry([{ accountId: bank.id, debit: 888 }], undefined, "posted", b.id, false, "depreciation");
    const saved = await snapshot();
    const body = await parity();
    assert.equal(body.openingCashBalance, 100); assert.equal(body.netCashFlow, 1200); assert.equal(body.closingCashBalance, 1300);
    assert.equal(body.operatingActivities.netIncomeMinor, "1050"); assert.equal(body.totalOperatingMinor, "1000");
    assert.equal(body.investing[0].amountMinor, "-200"); assert.equal(body.financingActivities.loanPaymentsMinor, "0");
    assert.equal(body.reconciliation.cashAccountMovementMinor, "1150"); assert.equal(body.reconciliation.difference, 50);
    assert.equal(body.reconciliation.balanced, false); assert.equal(body.currencyCode, "USD");
    // Existing direct and loan heuristics are preserved and visibly unreconciled, not accounting-qualified.
    const direct = await parity("direct"); assert.equal(direct.totalOperatingMinor, "1100");
    assert.equal(direct.operating[1].amountMinor, "-150"); assert.equal(direct.reconciliation.differenceMinor, "150");
    await parity("indirect", "cash"); await parity("direct", "cash");
    const other = await GET(request(query, keys.b)); assert.equal(other.status, 200);
    const otherBody = await other.json(); assert.deepEqual((await mb.call(args)).body, otherBody);
    assert.equal(otherBody.reconciliation.cashAccountMovement, 777);
    assert.equal((await GET(request(query, "dk_bad_key"))).status, 401);
    assert.equal((await GET(request(query, keys.denied))).status, 403);
    assert.equal((await noRead.call(args)).isError, true);
    assert.equal((await noRead.call({ ...args, format: "pdf" }, "export_cash_flow_statement")).isError, true);
    for (const bad of ["&startDate=2024-01-01", "&basis=bad", "&method=bad", "&format=csv", "&amountMinor=1"]) {
      assert.equal((await GET(request(query + bad))).status, 400);
    }
    for (const input of [{ startDate: "2024-02-30" }, { startDate: "2024-02-01", endDate: "2024-01-01" }, { method: "bad" }, { basis: "bad" }, { extra: "bad" }]) {
      assert.equal((await ma.call(input)).isError, true);
    }
    assert.equal((await GET(request("?startDate=2024-02-30"))).status, 400);
    assert.equal((await GET(request("?startDate=2024-02-01&endDate=2024-01-01"))).status, 400);
    assert.deepEqual(await snapshot(), saved);
    const defaults = await get(""); assert.deepEqual((await ma.call()).body, defaults);
    const ancient = await get("?startDate=0001-01-01&endDate=0001-01-01"); assert.equal(ancient.openingCashBalanceMinor, "0");
    // Explicit cash subtype and signed refund, including a transfer between cash accounts.
    await entry([{ accountId: cash.id, debit: 10 }, { accountId: bank.id, credit: 10 }]);
    await entry([{ accountId: revenue.id, debit: 1 }, { accountId: cash.id, credit: 1 }], undefined, "posted", a.id, false, "payment");
    assert.equal((await parity()).netCashFlowMinor, "1199");
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      const current = await parity(); assert.equal(current.netCashFlowMinor, "1199"); assert.equal(current.currencyCode, currency);
      const response = await GET(request(query + "&format=xlsx")); assert.equal(response.status, 200);
      const ExcelJS = (await import("exceljs")).default; const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
      const values: unknown[] = []; workbook.worksheets[0].eachRow(row => row.eachCell(cell => values.push(cell.value)));
      assert.ok(values.includes(currency === "KWD" ? -0.2 : currency === "USD" ? -2 : -200));
      const exported = await ma.call({ ...args, format: "xlsx", method: "direct" }, "export_cash_flow_statement");
      assert.equal(exported.isError, false); assert.equal(exported.body.encoding, "base64");
      const toolWorkbook = new ExcelJS.Workbook(); await toolWorkbook.xlsx.load(Buffer.from(exported.body.content, "base64") as never);
      assert.equal(toolWorkbook.worksheets.length, 1);
    }
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    const pdf = await GET(request(query + "&format=pdf")); assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    const toolPdf = await ma.call({ ...args, format: "pdf" }, "export_cash_flow_statement");
    assert.equal(toolPdf.isError, false); assert.equal(Buffer.from(toolPdf.body.content, "base64").subarray(0, 5).toString(), "%PDF-");
    // Multiple SQL sums exceed int64 and cancel without ever entering Number arithmetic.
    const gross = await entry([{ accountId: bank.id }, { accountId: bank.id }], "2025-01-01", "posted", a.id, false, "loan_payment");
    await db.execute(sql`update ${journalLine} set debit_amount=9223372036854775807, credit_amount=9223372036854775807 where journal_entry_id=${gross.id}`);
    const edgeArgs = { startDate: "2025-01-01", endDate: "2025-01-31" }, edgeQuery = "?startDate=2025-01-01&endDate=2025-01-31";
    assert.equal((await get(edgeQuery)).netCashChangeMinor, "0"); assert.deepEqual((await ma.call(edgeArgs)).body, await get(edgeQuery));
    await db.delete(journalEntry).where(eq(journalEntry.id, gross.id));
    // Unsafe income operands cancel exactly before their final report projection.
    const hidden = await entry([{ accountId: revenue.id }, { accountId: expense.id }], "2025-01-01");
    await db.execute(sql`update ${journalLine} set credit_amount=9223372036854775807 where journal_entry_id=${hidden.id} and account_id=${revenue.id}`);
    await db.execute(sql`update ${journalLine} set debit_amount=9223372036854775806 where journal_entry_id=${hidden.id} and account_id=${expense.id}`);
    assert.equal((await get(edgeQuery)).operatingActivities.netIncomeMinor, "1");
    await db.delete(journalEntry).where(eq(journalEntry.id, hidden.id));
    // Use the earliest isolated period, no old opening cash, for positive and negative exact limits.
    const minQuery = "?startDate=0001-01-01&endDate=0001-01-31", minArgs = { startDate: "0001-01-01", endDate: "0001-01-31" };
    const edge = await entry([{ accountId: bank.id, debit: Number.MAX_SAFE_INTEGER }, { accountId: revenue.id, credit: Number.MAX_SAFE_INTEGER }], "0001-01-01");
    assert.equal((await get(minQuery)).netCashChangeMinor, String(Number.MAX_SAFE_INTEGER));
    assert.deepEqual((await ma.call(minArgs)).body, await get(minQuery));
    assert.equal((await GET(request(minQuery + "&format=xlsx"))).status, 422);
    assert.equal((await ma.call({ ...minArgs, format: "xlsx" }, "export_cash_flow_statement")).body.code, "LEGACY_NUMERIC_RANGE");
    const one = await entry([{ accountId: bank.id, debit: 1 }, { accountId: revenue.id, credit: 1 }], "0001-01-01");
    const expectRange = async (q = minQuery, input = minArgs) => {
      const before = await snapshot();
      const response = await GET(request(q)); assert.equal(response.status, 422); assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
      const tool = await ma.call(input); assert.equal(tool.isError, true); assert.equal(tool.body.code, "LEGACY_NUMERIC_RANGE");
      assert.deepEqual(await snapshot(), before);
    };
    await expectRange();
    await db.delete(journalEntry).where(eq(journalEntry.id, one.id));
    await db.execute(sql`update ${journalLine} set debit_amount=credit_amount, credit_amount=debit_amount where journal_entry_id=${edge.id}`);
    assert.equal((await get(minQuery)).netCashChangeMinor, String(-Number.MAX_SAFE_INTEGER));
    const negativeOne = await entry([{ accountId: bank.id, credit: 1 }, { accountId: revenue.id, debit: 1 }], "0001-01-01");
    await expectRange();
    await db.delete(journalEntry).where(eq(journalEntry.id, negativeOne.id)); await db.delete(journalEntry).where(eq(journalEntry.id, edge.id));
    // Safe activity totals overflow net change when combined.
    const combined = await entry([{ accountId: revenue.id, credit: Number.MAX_SAFE_INTEGER }, { accountId: fixed.id, credit: 1 }], "0001-01-01");
    await expectRange(); await db.delete(journalEntry).where(eq(journalEntry.id, combined.id));
    // Opening plus a safe period movement overflows closing cash.
    const opening = await entry([{ accountId: bank.id, debit: Number.MAX_SAFE_INTEGER }], "0001-01-01");
    const closing = await entry([{ accountId: bank.id, debit: 1 }, { accountId: revenue.id, credit: 1 }], "0001-02-01");
    await expectRange("?startDate=0001-02-01&endDate=0001-02-28", { startDate: "0001-02-01", endDate: "0001-02-28" });
    await db.delete(journalEntry).where(eq(journalEntry.id, opening.id)); await db.delete(journalEntry).where(eq(journalEntry.id, closing.id));
    // Source-type sums remain exact and are also guarded at final projection.
    const source = await entry([{ accountId: expense.id }], "0001-01-01", "posted", a.id, false, "depreciation");
    await db.execute(sql`update ${journalLine} set debit_amount=9007199254740992 where journal_entry_id=${source.id}`);
    await expectRange(); await db.delete(journalEntry).where(eq(journalEntry.id, source.id));
    // Individually safe computed/actual movements can produce an unsafe reconciliation difference.
    const difference = await entry([{ accountId: bank.id, credit: Number.MAX_SAFE_INTEGER }, { accountId: revenue.id, credit: Number.MAX_SAFE_INTEGER }], "0001-01-01");
    await expectRange(); await db.delete(journalEntry).where(eq(journalEntry.id, difference.id));
    await db.update(organization).set({ defaultCurrency: "BAD" }).where(eq(organization.id, a.id));
    await expectRange(query, args);
    console.log("REST and MCP cash flow verified");
  } finally { await ma.close(); await mb.close(); await noRead.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
