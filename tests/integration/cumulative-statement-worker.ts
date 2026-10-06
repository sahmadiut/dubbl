import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, journalEntry, journalLine, costCenter } from "../../lib/db/schema";
import { GET as trialBalance } from "../../app/api/v1/reports/trial-balance/route";
import { GET as balanceSheet } from "../../app/api/v1/reports/balance-sheet/route";
import { registerReportTools } from "../../lib/mcp/tools/reports";
import { aggregateAsAt, aggregateAsAtExact, aggregateByDateRange, aggregateByDateRangeExact,
  aggregateByDimension, aggregateByDimensionExact } from "../../lib/reports/gl-query";
import { getCumulativeStatement } from "../../lib/reports/cumulative-statement";
import { WireCompatibilityError } from "../../lib/money/wire";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Cumulative statement fixture", version: "1" }); registerReportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["trial_balance", "balance_sheet"]) assert.match(tools.find(tool => tool.name === name)!.description!, /Minor strings/);
  return { async call(name: "trial_balance" | "balance_sheet", args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Statements A", slug: "cs-a" }, { name: "Statements B", slug: "cs-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "cs-owner@example.test" }, { email: "cs-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_cs_a", b: "dk_cs_b", denied: "dk_cs_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_cs" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noRead = await mcp({ ...ctx, role: "member", permissions: [] });
  const request = (kind: string, query = "", key = keys.a) => new Request(`http://fixture.test/api/v1/reports/${kind}${query}`, {
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id },
  });
  const [cash, liability, equity, revenue, expense, empty] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "1000", name: "Cash", type: "asset" as const, subType: "bank" },
    { organizationId: a.id, code: "2000", name: "Liability", type: "liability" as const },
    { organizationId: a.id, code: "3000", name: "Equity", type: "equity" as const },
    { organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" as const },
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" as const },
    { organizationId: a.id, code: "6000", name: "Empty", type: "asset" as const },
  ]).returning();
  const [foreign] = await db.insert(chartAccount).values({ organizationId: b.id, code: "1000", name: "Foreign secret", type: "asset" }).returning();
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
  const pairs = [["trial-balance", "trial_balance", trialBalance], ["balance-sheet", "balance_sheet", balanceSheet]] as const;
  try {
    for (const [kind, name, handler] of pairs) {
      const response = await handler(request(kind, "?asAt=2023-01-01")); assert.equal(response.status, 200);
      const body = await response.json(); assert.deepEqual((await ma.call(name, { asAt: "2023-01-01" })).body, body);
      assert.equal(body.currencyCode, "USD");
    }
    await entry([{ accountId: cash.id, debit: 10000 }, { accountId: equity.id, credit: 10000 }], "2023-12-31");
    await entry([{ accountId: cash.id, debit: 2000 }, { accountId: revenue.id, credit: 2000 }]);
    await entry([{ accountId: expense.id, debit: 500, dimension: true }, { accountId: cash.id, credit: 500 }], "2024-01-31");
    await entry([{ accountId: cash.id, debit: 700 }, { accountId: liability.id, credit: 700 }], "2024-01-31");
    await entry([{ accountId: cash.id, debit: 1 }, { accountId: equity.id, credit: 1 }], "2024-02-01");
    for (const status of ["draft", "void"] as const) await entry([{ accountId: cash.id, debit: 888 }], undefined, status);
    await entry([{ accountId: cash.id, debit: 888 }], undefined, "posted", a.id, true);
    await entry([{ accountId: cash.id, debit: 999 }], undefined, "posted", b.id); // foreign entry referencing owned account
    await entry([{ accountId: foreign.id, debit: 777 }]); // owned entry referencing foreign account
    await entry([{ accountId: foreign.id, debit: 1250 }], undefined, "posted", b.id);
    const before = await snapshot();
    const query = "?asAt=2024-01-31&compareDate=2023-12-31,2024-01-01&compareDate=2023-12-31&compareDate=2024-01-31";
    const args = { asAt: "2024-01-31", compareDates: ["2023-12-31", "2024-01-01", "2023-12-31", "2024-01-31"] };
    for (const [kind, name, handler] of pairs) {
      const response = await handler(request(kind, query)); assert.equal(response.status, 200);
      const body = await response.json(); assert.deepEqual((await ma.call(name, args)).body, body);
      assert.deepEqual(body.dates, ["2024-01-31", "2023-12-31", "2024-01-01"]);
      assert.ok(!JSON.stringify(body).includes("Foreign secret"));
      const other = await (await handler(request(kind, query, keys.b))).json();
      assert.deepEqual((await mb.call(name, args)).body, other); assert.ok(!JSON.stringify(other).includes("Cash"));
      if (name === "trial_balance") {
        assert.equal(body.accounts.length, 6);
        const find = (id: string) => body.accounts.find((row: { accountId: string }) => row.accountId === id);
        assert.equal(find(cash.id).balance, "122.00"); assert.equal(find(cash.id).balanceMinor, "12200");
        assert.deepEqual(find(cash.id).balances.map((row: { balanceMinor: string }) => row.balanceMinor), ["12200", "10000", "12000"]);
        assert.equal(find(empty.id).balanceMinor, "0");
        // Characterize the assigned natural-sign presentation defect without claiming an accounting repair.
        assert.equal(find(revenue.id).debitBalance, "20.00"); assert.equal(find(revenue.id).creditBalanceMinor, "0");
        assert.equal(find(liability.id).balanceMinor, "700"); assert.equal(find(expense.id).balanceMinor, "500");
      } else {
        assert.equal(body.assets.total, "122.00"); assert.equal(body.assets.totalMinor, "12200");
        assert.equal(body.liabilities.totalMinor, "700"); assert.equal(body.equity.totalMinor, "11500");
        assert.equal(BigInt(body.assets.totalMinor), BigInt(body.liabilities.totalMinor) + BigInt(body.equity.totalMinor));
        const earnings = body.equity.accounts.find((row: { accountId: string }) => row.accountId === "current-year-earnings");
        assert.deepEqual(earnings.balancesMinor, ["1500", "0", "2000"]);
        assert.deepEqual(body.equity.totalsMinor, ["11500", "10000", "12000"]);
      }
      const defaultResponse = await handler(request(kind)); assert.equal(defaultResponse.status, 200);
      assert.equal((await defaultResponse.json()).asAt, new Date().toISOString().slice(0, 10));
      assert.equal((await handler(request(kind, "?asOf=2024-01-31"))).status, 200);
      assert.equal((await handler(request(kind, "", "dk_invalid"))).status, 401);
      assert.equal((await handler(request(kind, query, keys.denied))).status, 403);
      assert.equal((await noRead.call(name, args)).body.status, 403);
      for (const invalid of ["?asAt=2024-02-30", "?asAt=bad", "?compareDate=2023-02-29", "?asAt=2024-01-01&asOf=2024-01-02",
        "?asAt=2024-01-01&asAt=2024-01-01", "?format=bad", "?amountMinor=1"]) assert.equal((await handler(request(kind, invalid))).status, 400);
      for (const invalid of [{ asAt: "2023-02-29" }, { compareDates: Array(13).fill("2024-01-01") }]) assert.equal((await ma.call(name, invalid)).isError, true);
    }
    assert.deepEqual(await snapshot(), before);
    const range = { startDate: "2024-01-01", endDate: "2024-01-31" };
    const dateRange = await aggregateByDateRange(a.id, range);
    assert.ok(!dateRange.some(row => row.accountId === foreign.id));
    assert.equal(dateRange.find(row => row.accountId === cash.id)!.balance, 2200);
    const grouped = await aggregateByDimension(a.id, range, "costCenterId");
    assert.equal(grouped.find(group => group.dimensionValue === dimension.id)!.accounts.find(row => row.accountId === expense.id)!.balance, 500);
    const filtered = await aggregateByDateRangeExact(a.id, range, { dimension: "costCenterId", dimensionValue: dimension.id, includeEmptyAccounts: true });
    assert.equal(filtered.find(row => row.accountId === expense.id)!.balance, 500n); assert.equal(filtered.find(row => row.accountId === cash.id)!.balance, 0n);
    // Cash basis source/contra and empty-account filtering retain their semantics.
    const accrual = await entry([{ accountId: expense.id, debit: 10 }, { accountId: liability.id, credit: 10 }]);
    const cashBasis = await aggregateByDateRange(a.id, range, { basis: "cash" });
    assert.equal(cashBasis.find(row => row.accountId === expense.id)!.balance, 500);
    const cashEmpty = await aggregateAsAtExact(a.id, range.endDate, { basis: "cash", includeEmptyAccounts: true });
    assert.equal(cashEmpty.find(row => row.accountId === expense.id)!.balance, 500n);
    await db.delete(journalEntry).where(eq(journalEntry.id, accrual.id));
    for (const currency of ["USD", "IRR", "JPY", "KWD"]) {
      await db.update(organization).set({ defaultCurrency: currency }).where(eq(organization.id, a.id));
      for (const [kind, name, handler] of pairs) {
        const body = await (await handler(request(kind, query))).json(); assert.equal(body.currencyCode, currency);
        assert.deepEqual((await ma.call(name, args)).body, body);
        if (name === "trial_balance") assert.equal(body.accounts.find((row: { accountId: string }) => row.accountId === cash.id).balance, "122.00");
        else assert.equal(body.assets.totalMinor, "12200");
        // Exercise real route XLSX response and currency-scaled numeric cell.
        const response = await handler(request(kind, "?asAt=2024-01-31&format=xlsx")); assert.equal(response.status, 200);
        const ExcelJS = (await import("exceljs")).default; const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
        assert.equal(wb.worksheets[0].getRow(5).getCell(3).value, currency === "JPY" || currency === "IRR" ? 12200 : currency === "KWD" ? 12.2 : 122);
      }
    }
    const pdf = await trialBalance(request("trial-balance", "?asAt=2024-01-31&format=pdf")); assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    // SQL SUM above safe number and int64 cancels exactly to a supported natural balance.
    const huge = await entry([{ accountId: empty.id }, { accountId: empty.id }]);
    await db.execute(sql`update ${journalLine} set debit_amount=9223372036854775807, credit_amount=9223372036854775807 where journal_entry_id=${huge.id}`);
    let exact = await aggregateAsAtExact(a.id, range.endDate, { includeEmptyAccounts: true });
    assert.equal(exact.find(row => row.accountId === empty.id)!.debit, 18446744073709551614n);
    for (const [kind, name, handler] of pairs) {
      const response = await handler(request(kind, "?asAt=2024-01-31")); assert.equal(response.status, 200);
      assert.deepEqual((await ma.call(name, { asAt: range.endDate })).body, await response.json());
    }
    await assert.rejects(aggregateAsAt(a.id, range.endDate), WireCompatibilityError);
    await assert.rejects(aggregateByDimension(a.id, range, "costCenterId"), WireCompatibilityError);
    assert.equal((await aggregateByDimensionExact(a.id, range, "costCenterId")).find(group => group.dimensionValue === null)!.accounts.find(row => row.accountId === empty.id)!.balance, 0n);
    const lines = await db.select({ id: journalLine.id }).from(journalLine).where(eq(journalLine.journalEntryId, huge.id));
    await db.execute(sql`update ${journalLine} set credit_amount=credit_amount-1 where id=${lines[0].id}`);
    const current = await (await trialBalance(request("trial-balance", "?asAt=2024-01-31"))).json();
    assert.equal(current.accounts.find((row: { accountId: string }) => row.accountId === empty.id).balanceMinor, "1");
    await db.delete(journalEntry).where(eq(journalEntry.id, huge.id));
    // Largest supported final JSON decimal round-trips; XLSX rejects its numeric precision limit.
    const edge = await entry([{ accountId: empty.id, debit: Number.MAX_SAFE_INTEGER }]);
    const edgeBody = await (await trialBalance(request("trial-balance", "?asAt=2024-01-31"))).json();
    assert.equal(edgeBody.accounts.find((row: { accountId: string }) => row.accountId === empty.id).balance, "90071992547409.91");
    assert.deepEqual((await ma.call("trial_balance", { asAt: range.endDate })).body, edgeBody);
    // Avoid trial-balance subtotal overflow; independently verify the actual balance-sheet route's XLSX precision failure.
    await db.delete(journalEntry).where(eq(journalEntry.id, edge.id));
    const isolated = await db.insert(organization).values({ name: "Edge", slug: "cs-edge" }).returning();
    const edgeCtx = { ...ctx, organizationId: isolated[0].id };
    await db.insert(member).values({ organizationId: edgeCtx.organizationId, userId: owner.id, role: "owner" });
    const edgeKey = "dk_cs_edge";
    await db.insert(apiKey).values({ organizationId: edgeCtx.organizationId, createdBy: owner.id, name: "Edge",
      keyHash: createHash("sha256").update(edgeKey).digest("hex"), keyPrefix: "dk_cs" });
    const [edgeAccount] = await db.insert(chartAccount).values({ organizationId: edgeCtx.organizationId, code: "1", name: "Edge", type: "asset" }).returning();
    const edgeEntry = await entry([{ accountId: edgeAccount.id, debit: Number.MAX_SAFE_INTEGER }], undefined, "posted", edgeCtx.organizationId);
    const edgeResult = await getCumulativeStatement(edgeCtx, "balance-sheet", { asAt: range.endDate });
    assert.ok("assets" in edgeResult.data);
    assert.equal(edgeResult.data.assets.totalMinor, "9007199254740991");
    const { toXlsx } = await import("../../lib/reports/statement-export"); await assert.rejects(toXlsx(edgeResult.statement()), WireCompatibilityError);
    for (const [kind, , handler] of pairs) {
      const exportResponse = await handler(request(kind, "?asAt=2024-01-31&format=xlsx", edgeKey));
      assert.equal(exportResponse.status, 422); assert.equal((await exportResponse.json()).code, "LEGACY_NUMERIC_RANGE");
    }
    await db.delete(journalEntry).where(eq(journalEntry.id, edgeEntry.id));
    // Unsafe final balance/section/earnings and unsupported currency fail without report writes.
    const overflow = await entry([{ accountId: empty.id, debit: Number.MAX_SAFE_INTEGER }]);
    const one = await entry([{ accountId: empty.id, debit: 1 }]);
    const expectRange = async () => {
      const before = await snapshot();
      for (const [kind, name, handler] of pairs) {
        const result = await handler(request(kind, "?asAt=2024-01-31")); assert.equal(result.status, 422);
        assert.equal((await result.json()).code, "LEGACY_NUMERIC_RANGE");
        const tool = await ma.call(name, { asAt: range.endDate }); assert.equal(tool.isError, true);
        assert.equal(tool.body.code, "LEGACY_NUMERIC_RANGE"); assert.equal(tool.body.status, 422);
      }
      assert.deepEqual(await snapshot(), before);
    };
    await expectRange(); await db.delete(journalEntry).where(eq(journalEntry.id, one.id));
    // A safe per-account edge can still overflow the balance-sheet section total.
    assert.equal((await balanceSheet(request("balance-sheet", "?asAt=2024-01-31"))).status, 422);
    await db.delete(journalEntry).where(eq(journalEntry.id, overflow.id));
    const negative = await entry([{ accountId: empty.id, credit: 1 }]);
    for (const [kind, name, handler] of pairs) {
      const response = await handler(request(kind, "?asAt=2024-01-31")); assert.equal(response.status, 200);
      const body = await response.json(); assert.deepEqual((await ma.call(name, { asAt: range.endDate })).body, body);
      if (name === "trial_balance") assert.equal(body.accounts.find((row: { accountId: string }) => row.accountId === empty.id).creditBalanceMinor, "1");
      else assert.equal(body.assets.accounts.find((row: { accountId: string }) => row.accountId === empty.id).balance, "-0.01");
    }
    await db.delete(journalEntry).where(eq(journalEntry.id, negative.id));
    const hidden = await entry([{ accountId: revenue.id }, { accountId: expense.id }]);
    await db.execute(sql`update ${journalLine} set credit_amount=9223372036854775807 where journal_entry_id=${hidden.id} and account_id=${revenue.id}`);
    await db.execute(sql`update ${journalLine} set debit_amount=9223372036854775807 where journal_entry_id=${hidden.id} and account_id=${expense.id}`);
    const cancelledEarnings = await balanceSheet(request("balance-sheet", "?asAt=2024-01-31")); assert.equal(cancelledEarnings.status, 200);
    assert.equal((await cancelledEarnings.json()).equity.totalMinor, "11500");
    assert.equal((await trialBalance(request("trial-balance", "?asAt=2024-01-31"))).status, 422);
    await db.execute(sql`update ${journalLine} set debit_amount=0 where journal_entry_id=${hidden.id} and account_id=${expense.id}`);
    assert.equal((await balanceSheet(request("balance-sheet", "?asAt=2024-01-31"))).status, 422);
    assert.equal((await ma.call("balance_sheet", { asAt: range.endDate })).body.code, "LEGACY_NUMERIC_RANGE");
    await db.delete(journalEntry).where(eq(journalEntry.id, hidden.id));
    await db.update(organization).set({ defaultCurrency: "XXX" }).where(eq(organization.id, a.id)); await expectRange();
    await assert.rejects(getCumulativeStatement({ ...ctx, organizationId: randomUUID() }, "trial-balance", {}), { status: 404 });
    exact = await aggregateAsAtExact(a.id, range.endDate);
    assert.ok(!exact.some(row => row.accountId === foreign.id));
    console.log("REST and MCP cumulative statements verified");
  } finally { await Promise.all([ma.close(), mb.close(), noRead.close()]); }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
