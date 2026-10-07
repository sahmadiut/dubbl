import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, journalEntry, journalLine, costCenter, project } from "../../lib/db/schema";
import { GET as generalLedger } from "../../app/api/v1/reports/general-ledger/route";
import { GET as accountTransactions } from "../../app/api/v1/reports/account-transactions/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Ledger detail fixture", version: "1" }); registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["general_ledger", "account_transactions"]) assert.match(tools.find(tool => tool.name === name)!.description!, /Minor strings/);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Ledger A", slug: "ps-a" }, { name: "Ledger B", slug: "ps-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "ps-owner@example.test" }, { email: "ps-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_ps_a", b: "dk_ps_b", denied: "dk_ps_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_ps" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const request = (kind: string, query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/reports/${kind}${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const [cash, revenue, expense, empty] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1000", name: "Cash", type: "asset" as const, subType: "bank" },
    { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" as const },
    { organizationId: a.id, code: "6000", name: "Empty", type: "revenue" as const },
  ]).returning();
  const [foreign] = await db.insert(chartAccount).values({ organizationId: b.id, code: "1000", name: "Foreign secret", type: "revenue" }).returning();
  const [dimension] = await db.insert(costCenter).values({ organizationId: a.id, code: "one", name: "One" }).returning();
  let sequence = 0;
  const entry = async (lines: { accountId: string; debit?: number; credit?: number; dimension?: boolean }[], date = "2024-01-01",
    status: "posted" | "draft" | "void" = "posted", org = a.id, deleted = false, sourceType = "manual") => {
    const [saved] = await db.insert(journalEntry).values({ organizationId: org, entryNumber: ++sequence, date, status, description: "Synthetic entry",
      deletedAt: deleted ? new Date() : null, sourceType }).returning();
    await db.insert(journalLine).values(lines.map(line => ({ journalEntryId: saved.id, accountId: line.accountId,
      debitAmount: line.debit ?? 0, creditAmount: line.credit ?? 0, currencyCode: "IRR", costCenterId: line.dimension ? dimension.id : null })));
    return saved;
  };
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["journal_entry", "journal_line", "chart_account", "audit_log"]) {
      result[table] = (await db.execute(sql.raw(`select row_to_json(t) as row from ${table} t order by id`))).rows;
    }
    return result;
  };
  const range = { startDate: "2024-01-01", endDate: "2024-01-31" };
  const query = "?startDate=2024-01-01&endDate=2024-01-31";
  const get = async (kind: "general-ledger" | "account-transactions", suffix = "", key = keys.a) => {
    const response = await (kind === "general-ledger" ? generalLedger : accountTransactions)(request(kind, query + suffix, key));
    assert.equal(response.status, 200, await response.clone().text()); return response.json();
  };
  const parity = async (id = cash.id, args: Record<string, unknown> = {}) => {
    const suffix = Object.entries(args).map(([k, v]) => `&${k}=${v}`).join("");
    for (const [name, kind, extra] of [["general_ledger", "general-ledger", {}],
      ["general_ledger", "general-ledger", { accountId: id }], ["account_transactions", "account-transactions", { accountId: id }]] as const) {
      const options = kind === "account-transactions" ? extra : { ...extra, ...args };
      const body = await get(kind, (options.accountId ? `&accountId=${options.accountId}` : "") + (kind === "general-ledger" ? suffix : ""));
      const result = await ma.call(name, { ...range, ...options });
      assert.equal(result.isError, false, JSON.stringify(result.body)); assert.deepEqual(result.body, body);
    }
  };
  try {
    await parity();
    const defaultResponse = await generalLedger(request("general-ledger"));
    assert.equal(defaultResponse.status, 200);
    const defaultBody = await defaultResponse.json();
    assert.equal(defaultBody.startDate, `${new Date().getUTCFullYear()}-01-01`);
    assert.equal(defaultBody.endDate, new Date().toISOString().slice(0, 10));
    assert.deepEqual((await ma.call("general_ledger")).body, defaultBody);
    const defaultTransactions = await accountTransactions(request("account-transactions", `?accountId=${cash.id}`));
    assert.equal(defaultTransactions.status, 200);
    assert.deepEqual((await ma.call("account_transactions", { accountId: cash.id })).body, await defaultTransactions.json());
    assert.equal((await get("account-transactions", `&accountId=${cash.id}`)).closingBalanceMinor, "0");
    await entry([{ accountId: cash.id, debit: 1000 }, { accountId: revenue.id, credit: 1000 }], "2023-12-31");
    await entry([{ accountId: cash.id, debit: 1250 }, { accountId: cash.id, credit: 250 }, { accountId: revenue.id, credit: 1250 }]);
    await entry([{ accountId: cash.id, credit: 100, dimension: true }, { accountId: expense.id, debit: 100, dimension: true }], "2024-01-31");
    await entry([{ accountId: cash.id, debit: 999 }], "2024-02-01");
    for (const status of ["draft", "void"] as const) await entry([{ accountId: cash.id, debit: 888 }], undefined, status);
    await entry([{ accountId: cash.id, debit: 888 }], undefined, "posted", a.id, true);
    await entry([{ accountId: cash.id, debit: 777 }], undefined, "posted", b.id);
    await entry([{ accountId: foreign.id, credit: 777 }]);
    await entry([{ accountId: foreign.id, credit: 222 }], undefined, "posted", b.id);
    const [deleted] = await db.insert(chartAccount).values({ organizationId: a.id, code: "9999", name: "Deleted secret", type: "asset", deletedAt: new Date() }).returning();
    await entry([{ accountId: deleted.id, debit: 777 }]);
    const before = await snapshot();
    await parity(); await parity(revenue.id); await parity(expense.id); await parity(cash.id, { limit: 1, offset: 0 });
    const transactions = await get("account-transactions", `&accountId=${cash.id}`);
    assert.equal(transactions.openingBalanceMinor, "1000"); assert.equal(transactions.closingBalanceMinor, "900");
    assert.equal(transactions.closingLedgerBalanceMinor, "1900"); assert.equal(transactions.totalDebitMinor, "1250");
    assert.equal(transactions.totalCreditMinor, "350"); assert.equal(transactions.transactions.length, 3);
    // Same entry has two lines; stable UUID tie breakers keep adjacent pages identical to the full list.
    for (let offset = 0; offset < 4; offset++) {
      const page = await get("general-ledger", `&accountId=${cash.id}&offset=${offset}&limit=1`);
      assert.deepEqual(page.entries.map((r: { lineId: string }) => r.lineId), transactions.transactions.slice(offset, offset + 1).map((r: { lineId: string }) => r.lineId));
      if (page.entries.length) {
        assert.equal(page.entries[0].runningBalanceMinor, transactions.transactions[offset].runningBalanceMinor);
        assert.equal(page.entries[0].ledgerBalanceMinor, transactions.transactions[offset].ledgerBalanceMinor);
      }
      assert.deepEqual((await ma.call("general_ledger", { ...range, accountId: cash.id, offset, limit: 1 })).body, page);
    }
    const negative = await entry([{ accountId: expense.id, credit: 150 }]);
    assert.equal((await get("account-transactions", `&accountId=${expense.id}`)).closingBalanceMinor, "-50");
    const filtered = await get("general-ledger", `&costCenterId=${dimension.id}`);
    assert.equal(filtered.accounts.find((r: { accountId: string }) => r.accountId === cash.id).balanceMinor, "-100");
    assert.deepEqual((await ma.call("general_ledger", { ...range, costCenterId: dimension.id })).body, filtered);
    for (const sentinel of ["none", "null", ""]) {
      const result = await get("general-ledger", `&costCenterId=${sentinel}`);
      assert.equal(result.accounts.find((r: { accountId: string }) => r.accountId === cash.id).openingBalanceMinor, "1000");
      assert.deepEqual((await ma.call("general_ledger", { ...range, costCenterId: sentinel })).body, result);
    }
    const [foreignDimension] = await db.insert(costCenter).values({ organizationId: b.id, code: "two", name: "Secret" }).returning();
    const [ownedProject, foreignProject] = await db.insert(project).values([{ organizationId: a.id, name: "Owned" }, { organizationId: b.id, name: "Secret" }]).returning();
    await db.execute(sql`update ${journalLine} set project_id=${ownedProject.id} where cost_center_id=${dimension.id}`);
    assert.deepEqual((await ma.call("general_ledger", { ...range, projectId: ownedProject.id })).body, await get("general-ledger", `&projectId=${ownedProject.id}`));
    assert.deepEqual((await ma.call("general_ledger", { ...range, costCenterId: dimension.id, projectId: foreignProject.id })).body, filtered);
    for (const args of [{ costCenterId: foreignDimension.id }, { projectId: foreignProject.id }]) {
      const suffix = Object.entries(args).map(([k, v]) => `&${k}=${v}`).join("");
      assert.equal((await generalLedger(request("general-ledger", query + suffix))).status, 404);
      assert.equal((await ma.call("general_ledger", { ...range, ...args })).isError, true);
    }
    for (const [kind, name, handler] of [["general-ledger", "general_ledger", generalLedger], ["account-transactions", "account_transactions", accountTransactions]] as const) {
      const args = { ...range, accountId: cash.id }, suffix = `&accountId=${cash.id}`;
      assert.equal((await handler(request(kind, query + suffix, "dk_bad_key"))).status, 401);
      assert.equal((await handler(request(kind, query + suffix, keys.denied))).status, 403);
      assert.equal((await noRead.call(name, args)).isError, true);
      for (const id of [foreign.id, deleted.id, "00000000-0000-4000-8000-000000000000"]) {
        assert.equal((await handler(request(kind, query + `&accountId=${id}`))).status, 404);
        assert.equal((await ma.call(name, { ...range, accountId: id })).isError, true);
      }
      const other = await get(kind, `&accountId=${foreign.id}`, keys.b);
      assert.deepEqual((await mb.call(name, { ...range, accountId: foreign.id })).body, other);
      assert.equal(other.totalCreditMinor, "222");
      for (const suffix of ["&unknown=1", "&endDate=2024-02-30", "&startDate=2024-02-01", "&accountId=bad", "&accountId="]) {
        assert.equal((await handler(request(kind, query + suffix))).status, 400);
      }
      for (const invalid of [{ ...args, startDate: "2024-02-30" }, { ...args, endDate: "2023-01-01" }, { ...args, unknown: 1 }]) {
        assert.equal((await ma.call(name, invalid)).isError, true);
      }
    }
    assert.equal((await accountTransactions(request("account-transactions", query))).status, 400);
    for (const suffix of ["&limit=0", "&limit=501", "&limit=01", "&limit=1.5", "&offset=-1", "&offset=1", "&limit=1&limit=2", "&format=csv", `&accountId=${cash.id}&format=pdf`]) {
      assert.equal((await generalLedger(request("general-ledger", query + suffix))).status, 400);
    }
    for (const args of [{ offset: 1 }, { limit: 501 }, { offset: -1 }, { limit: 1.5 }, { projectId: "bad" }]) {
      assert.equal((await ma.call("general_ledger", { ...range, ...args })).isError, true);
    }
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      await parity(); assert.equal((await get("account-transactions", `&accountId=${cash.id}`)).totalDebit, 1250);
      const response = await generalLedger(request("general-ledger", query + "&format=xlsx")); assert.equal(response.status, 200);
      const exported = await ma.call("export_financial_statement", { statement: "general_ledger", format: "xlsx", from: range.startDate, to: range.endDate });
      assert.equal(exported.isError, false, JSON.stringify(exported.body));
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
      const values: unknown[] = []; workbook.worksheets[0].eachRow(row => row.eachCell(cell => values.push(cell.value)));
      assert.ok(values.includes(currency === "KWD" ? 1.25 : currency === "USD" ? 12.5 : 1250));
      const toolWorkbook = new ExcelJS.Workbook(); await toolWorkbook.xlsx.load(Buffer.from(exported.body.data, "base64") as never);
      const toolValues: unknown[] = []; toolWorkbook.worksheets[0].eachRow(row => row.eachCell(cell => toolValues.push(cell.value)));
      assert.deepEqual(toolValues, values);
    }
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    const pdf = await generalLedger(request("general-ledger", query + "&format=pdf")); assert.equal(pdf.status, 200);
    assert.ok(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).equals(Buffer.from("%PDF-")));
    assert.equal((await noRead.call("export_financial_statement", { statement: "general_ledger", format: "pdf" })).isError, true);
    assert.equal((await ma.call("export_financial_statement", { statement: "general_ledger", format: "pdf", from: "2024-02-30" })).isError, true);
    const many = await entry(Array.from({ length: 52 }, () => ({ accountId: empty.id, credit: 1 })));
    const capped = (await get("general-ledger")).accounts.find((row: { accountId: string }) => row.accountId === empty.id);
    assert.equal(capped.entries.length, 50); assert.equal(capped.totalEntries, 52); assert.equal(capped.balanceMinor, "52");
    assert.equal((await get("general-ledger", `&accountId=${empty.id}&offset=50`)).entries.length, 2);
    assert.equal((await get("account-transactions", `&accountId=${empty.id}`)).transactions.length, 52);
    await parity(empty.id);
    const fullExport = await generalLedger(request("general-ledger", query + "&limit=1&format=xlsx"));
    assert.equal(fullExport.status, 200);
    const ExcelJS = (await import("exceljs")).default;
    const fullWorkbook = new ExcelJS.Workbook(); await fullWorkbook.xlsx.load(Buffer.from(await fullExport.arrayBuffer()) as never);
    const fullValues: unknown[] = []; fullWorkbook.worksheets[0].eachRow(row => row.eachCell(cell => fullValues.push(cell.value)));
    const toolFull = await ma.call("export_financial_statement", { statement: "general_ledger", format: "xlsx", from: range.startDate, to: range.endDate });
    assert.equal(toolFull.isError, false);
    const toolFullWorkbook = new ExcelJS.Workbook(); await toolFullWorkbook.xlsx.load(Buffer.from(toolFull.body.data, "base64") as never);
    const toolFullValues: unknown[] = []; toolFullWorkbook.worksheets[0].eachRow(row => row.eachCell(cell => toolFullValues.push(cell.value)));
    assert.deepEqual(toolFullValues, fullValues);
    assert.equal(fullValues.filter(v => typeof v === "string" && v.includes(`${many.entryNumber} - Synthetic entry`)).length, 52);
    await db.delete(journalEntry).where(eq(journalEntry.id, many.id));
    // Opening SUM crosses int64 twice and cancels to one cent, without exposing unsafe individual historical lines.
    const huge = await entry([{ accountId: empty.id }, { accountId: empty.id }], "2023-12-31");
    await db.execute(sql`update ${journalLine} set debit_amount=9223372036854775807, credit_amount=9223372036854775807 where journal_entry_id=${huge.id}`);
    const [line] = await db.select({ id: journalLine.id }).from(journalLine).where(eq(journalLine.journalEntryId, huge.id));
    await db.execute(sql`update ${journalLine} set debit_amount=debit_amount-1 where id=${line.id}`);
    await parity(empty.id);
    assert.equal((await get("account-transactions", `&accountId=${empty.id}`)).openingBalanceMinor, "1");
    await db.delete(journalEntry).where(eq(journalEntry.id, huge.id));
    const edge = await entry([{ accountId: empty.id, credit: Number.MAX_SAFE_INTEGER }]);
    await parity(empty.id);
    assert.equal((await get("account-transactions", `&accountId=${empty.id}`)).closingBalanceMinor, "9007199254740991");
    assert.equal((await generalLedger(request("general-ledger", query + "&format=xlsx"))).status, 422);
    assert.equal((await ma.call("export_financial_statement", { statement: "general_ledger", format: "xlsx", from: range.startDate, to: range.endDate })).body.code, "LEGACY_NUMERIC_RANGE");
    const one = await entry([{ accountId: empty.id, credit: 1 }]);
    const expectRange = async () => {
      const saved = await snapshot();
      for (const [kind, name, handler, extra] of [["general-ledger", "general_ledger", generalLedger, {}],
        ["general-ledger", "general_ledger", generalLedger, { accountId: empty.id, limit: 1 }],
        ["account-transactions", "account_transactions", accountTransactions, { accountId: empty.id }]] as const) {
        const suffix = Object.entries(extra).map(([k, v]) => `&${k}=${v}`).join("");
        const response = await handler(request(kind, query + suffix)); assert.equal(response.status, 422);
        assert.equal((await response.json()).code, "LEGACY_NUMERIC_RANGE");
        assert.equal((await ma.call(name, { ...range, ...extra })).body.code, "LEGACY_NUMERIC_RANGE");
      }
      assert.deepEqual(await snapshot(), saved);
    };
    await expectRange();
    await db.delete(journalEntry).where(eq(journalEntry.id, one.id)); await db.delete(journalEntry).where(eq(journalEntry.id, edge.id));
    // Unsafe displayed line and intermediate running balance reject even if final movement cancels.
    const cancel = await entry([{ accountId: empty.id }, { accountId: empty.id }]);
    const cancelLines = await db.select({ id: journalLine.id }).from(journalLine).where(eq(journalLine.journalEntryId, cancel.id));
    await db.execute(sql`update ${journalLine} set debit_amount=9007199254740992 where id=${cancelLines[0].id}`);
    await db.execute(sql`update ${journalLine} set credit_amount=9007199254740992 where id=${cancelLines[1].id}`);
    await expectRange(); await db.delete(journalEntry).where(eq(journalEntry.id, cancel.id));
    await db.update(organization).set({ defaultCurrency: "BAD" }).where(eq(organization.id, a.id));
    await expectRange(); await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    await db.delete(journalEntry).where(eq(journalEntry.id, negative.id));
    // Read paths changed no ledger state: remove explicitly added fixtures from the comparison.
    const after = await snapshot();
    assert.deepEqual(after.chart_account, before.chart_account); assert.deepEqual(after.audit_log, before.audit_log);
    assert.deepEqual(after.journal_entry, before.journal_entry);
    // project tags were explicitly changed for the dimension fixture; all amounts/identities are unchanged.
    const stripProject = (rows: unknown) => (rows as { row: Record<string, unknown> }[]).map(({ row }) => ({ ...row, project_id: null }));
    assert.deepEqual(stripProject(after.journal_line), stripProject(before.journal_line));
    console.log("REST and MCP ledger details verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close()]); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
