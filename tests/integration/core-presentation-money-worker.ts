import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, journalEntry, journalLine, exchangeRate } from "../../lib/db/schema";
import { POST as createEntry, GET as listEntries } from "../../app/api/v1/entries/route";
import { GET as getEntry } from "../../app/api/v1/entries/[id]/route";
import { POST as postEntry } from "../../app/api/v1/entries/[id]/post/route";
import { GET as getAccount } from "../../app/api/v1/accounts/[id]/route";
import { POST as opening } from "../../app/api/v1/opening-balances/route";
import { createInvoiceJournalEntry, reverseJournalEntry } from "../../lib/api/journal-automation";
import { registerEntryTools } from "../../lib/mcp/tools/entries";
import { registerAccountTools } from "../../lib/mcp/tools/accounts";
import { coreAccountMoney, coreStoredMinor, coreJournalSummary, coreDebitDisplay, coreJournalDetail, coreLedgerMoney } from "../../lib/money/core-presentation";
import { journalEditorPreview, journalRestMinor, journalMoney } from "../../lib/money/journal-display";

type SavedDetail = { lines: { debitAmount: string; debitAmountMinor: string; creditAmount: string; creditAmountMinor: string; amountCurrencyCode: string }[] };

const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function ok(response: Response) { const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body; }
async function scenario(currency: string) {
  const [org] = await db.insert(organization).values({ name: `Presentation ${currency}`, slug: `presentation-${currency}`, defaultCurrency: currency }).returning();
  const [user] = await db.insert(users).values({ email: `presentation-${currency}@example.test` }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: user.id, role: "owner" });
  const key = `dk_presentation_${currency}`;
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: user.id, name: "Presentation", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_present" });
  const ctx = { organizationId: org.id, userId: user.id, role: "owner" as const };
  const [cash, revenue, ar, openingAccount] = await db.insert(chartAccount).values([
    { code: "1000", name: "Cash", type: "asset" as const }, { code: "4000", name: "Revenue", type: "revenue" as const },
    { code: "1200", name: "AR", type: "asset" as const }, { code: "1900", name: "Opening", type: "asset" as const },
  ].map(row => ({ ...row, organizationId: org.id, currencyCode: "KWD" }))).returning();
  const request = (body?: unknown, method = "GET", query = "") => new Request(`http://fixture.test/api/v1/entries${query}`, {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const server = new McpServer({ name: "Presentation fixture", version: "1.0.0" });
  registerEntryTools(server, ctx); registerAccountTools(server, ctx);
  const client = new Client({ name: "Presentation fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined, JSON.stringify(result.content));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  try {
    const text = currency === "USD" ? "40000000000000.01" : currency === "KWD" ? "1.251" : "1251";
    const expected = currency === "USD" ? 4000000000000001n : 1251n;
    const preview = journalEditorPreview([{ accountId: cash.id, debit: text, credit: "", currencyCode: currency }, { accountId: revenue.id, debit: "", credit: text, currencyCode: currency }]);
    assert.equal(preview.totalDebit, expected);
    const payload = { date: "2026-10-12", description: "Manual presentation", lines: preview.lines };
    const rest = await ok(await createEntry(request(payload, "POST"))), mcp = await call("create_entry", payload);
    for (const id of [rest.entry.id, mcp.entry.id]) {
      await ok(await postEntry(request(undefined, "POST"), params(id)));
      const saved = coreJournalDetail<SavedDetail>((await ok(await getEntry(request(), params(id)))).entry);
      assert.ok(saved.lines.every(l => l.amountCurrencyCode === currency));
      assert.equal(journalRestMinor(saved.lines[0].debitAmount, saved.lines[0].debitAmountMinor), expected);
      const read = (await call("get_entry", { entryId: id })).entry;
      assert.ok(read.lines.every((l: { amountCurrencyCode: string }) => l.amountCurrencyCode === currency));
    }
    const account = coreAccountMoney((await ok(await getAccount(request(undefined, "GET", "?limit=1"), params(cash.id)))).account);
    assert.equal(account.amountCurrencyCode, currency); assert.equal(account.currencyCode, "KWD");
    assert.equal(coreStoredMinor(account.balance, account.balanceMinor), expected * 2n);
    const mcpAccount = coreAccountMoney((await call("get_account", { accountId: cash.id })).account);
    assert.equal(mcpAccount.balanceMinor, String(expected * 2n));
    const ledger = await ok(await getAccount(request(undefined, "GET", "?limit=1&sortOrder=asc"), params(cash.id)));
    assert.equal(ledger.pagination.total, 2);
    coreLedgerMoney(ledger.data[0]); assert.equal(ledger.data[0].balanceMinor, String(expected));
    const next = await ok(await getAccount(request(undefined, "GET", "?limit=1&page=2&sortOrder=asc"), params(cash.id)));
    coreLedgerMoney(next.data[0]); assert.equal(next.data[0].balanceMinor, String(expected * 2n));
    const negative = coreAccountMoney((await call("get_account", { accountId: revenue.id })).account);
    assert.equal(negative.balanceMinor, String(expected * 2n)); // credit-normal sign

    // Actual retained automation converts EUR raw units to base once, retaining the EUR source tag.
    await db.insert(exchangeRate).values({ organizationId: org.id, baseCurrency: "EUR", targetCurrency: currency, date: "2026-10-12", rate: 333300, rateExact: "0.3333", rateDirection: "quote_per_base", rateMigrationStatus: "valid", source: "manual" });
    const automated = (await createInvoiceJournalEntry(ctx, { invoiceNumber: "FX presentation", total: 1251, subtotal: 1251, taxTotal: 0,
      date: "2026-10-12", currencyCode: "EUR", lines: [{ accountId: revenue.id, amount: 1251, taxAmount: 0 }] }))!;
    const savedAuto = coreJournalDetail<SavedDetail>((await ok(await getEntry(request(), params(automated.id)))).entry);
    assert.ok(savedAuto.lines.every(l => l.amountCurrencyCode === currency));
    const sqlLines = await db.select({ debit: sql<string>`${journalLine.debitAmount}::text`, tag: journalLine.currencyCode }).from(journalLine).where(eq(journalLine.journalEntryId, automated.id));
    assert.ok(sqlLines.every(l => l.tag === "EUR"));
    assert.equal(sqlLines.reduce((sum, l) => sum + BigInt(l.debit), 0n), 417n);
    assert.equal(savedAuto.lines.reduce((sum, l) => sum + journalRestMinor(l.debitAmount, l.debitAmountMinor), 0n), 417n);
    assert.equal((await call("get_entry", { entryId: automated.id })).entry.lines[0].amountCurrencyCode, currency);
    assert.equal(coreAccountMoney((await call("get_account", { accountId: ar.id })).account).balanceMinor, "417");
    const mixed = await ok(await createEntry(request({ date: "2026-10-12", description: "Mixed stored units", lines: [
      { accountId: openingAccount.id, currencyCode: "JPY", debitAmountMinor: "1251" },
      { accountId: openingAccount.id, currencyCode: "KWD", debitAmountMinor: "1251" },
      { accountId: revenue.id, currencyCode: "KWD", creditAmountMinor: "2502" },
    ] }, "POST")));
    await ok(await postEntry(request(undefined, "POST"), params(mixed.entry.id)));
    const reversal = (await db.transaction(tx => reverseJournalEntry(ctx, { entryId: mixed.entry.id, date: "2026-10-12", description: "Manual reversal", sourceType: "manual_reversal" }, tx)))!;
    const savedReversal = coreJournalDetail<SavedDetail>((await ok(await getEntry(request(), params(reversal.id)))).entry);
    assert.deepEqual(savedReversal.lines.map(l => l.amountCurrencyCode).sort(), ["JPY", "KWD", "KWD"]);

    const openingSaved = await ok(await opening(request({ date: "2026-10-01", balances: [{ accountId: openingAccount.id, debitAmount: 1251, creditAmount: 0 }, { accountId: revenue.id, debitAmount: 0, creditAmount: 1251 }] }, "POST")));
    const openingDetail = coreJournalDetail<SavedDetail>((await ok(await getEntry(request(), params(openingSaved.entry.id)))).entry);
    assert.equal(openingDetail.lines[0].amountCurrencyCode, "USD");
    assert.equal(journalMoney(journalRestMinor(openingDetail.lines[0].debitAmount, openingDetail.lines[0].debitAmountMinor), "USD"), "$12.51");
    const restList = await ok(await listEntries(request()));
    assert.deepEqual(restList.entries.find((e: { id: string }) => e.id === mixed.entry.id).debitTotals,
      [{ currencyCode: "JPY", totalDebit: 1251, totalDebitMinor: "1251" }, { currencyCode: "KWD", totalDebit: 1251, totalDebitMinor: "1251" }]);
    const mcpList = await call("list_entries", {});
    for (const entry of restList.entries) {
      coreJournalSummary(entry);
      const other = mcpList.entries.find((e: { id: string }) => e.id === entry.id);
      assert.deepEqual(entry.debitTotals, other.debitTotals);
      assert.equal(String(journalRestMinor(entry.totalDebit, entry.totalDebitMinor)), String(other.totalDebit));
    }
    assert.ok(coreDebitDisplay(restList.entries).includes(currency === "KWD" ? "KWD" : currency === "IRR" ? "IRR" : currency === "JPY" ? "¥" : "$"));
    assert.equal((await getAccount(new Request("http://fixture.test", { headers: { authorization: "Bearer dk_invalid_fixture" } }), params(cash.id))).status, 401);
    const [foreign] = await db.insert(organization).values({ name: "Other", slug: `foreign-${currency}` }).returning();
    const [foreignEntry] = await db.insert(journalEntry).values({ organizationId: foreign.id, entryNumber: 1, date: "2026-10-12", description: "Foreign", sourceType: "manual" }).returning();
    const [bad] = await db.insert(journalEntry).values({ organizationId: org.id, entryNumber: 99, date: "2026-10-12", description: "Invalid origin", sourceType: "manual_reversal", reversesEntryId: foreignEntry.id }).returning();
    assert.equal((await getEntry(request(), params(bad.id))).status, 422);
    const failed = await client.callTool({ name: "get_entry", arguments: { entryId: bad.id } }); assert.equal(failed.isError, true);
    await db.update(journalEntry).set({ reversesEntryId: bad.id }).where(eq(journalEntry.id, bad.id));
    assert.equal((await getEntry(request(), params(bad.id))).status, 422);
    assert.equal((await getEntry(request(), params(foreignEntry.id))).status, 404);
    assert.deepEqual(await db.select({ debit: sql<string>`${journalLine.debitAmount}::text`, tag: journalLine.currencyCode }).from(journalLine).where(eq(journalLine.journalEntryId, automated.id)), sqlLines);
  } finally { await client.close(); await server.close(); }
}
async function run() { for (const code of ["USD", "JPY", "IRR", "KWD"]) await scenario(code); console.log("Core presentation currencies, aliases, reversals and SQL verified"); }
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
