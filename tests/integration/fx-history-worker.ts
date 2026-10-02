// Runs only from fx-history.test.ts with a disposable fixture DATABASE_URL.
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { db } from "../../lib/db";
import { users, organization, chartAccount, journalLine, exchangeRate } from "../../lib/db/schema";
import { createInvoiceJournalEntry } from "../../lib/api/journal-automation";
import { processExchangeRateSync } from "../../lib/currency/rate-sync";
import { registerCurrencyTools } from "../../lib/mcp/tools/currencies";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

async function run() {
  const [org] = await db.insert(organization).values({ name: "Synthetic FX", slug: "fx-worker" }).returning();
  const [user] = await db.insert(users).values({ name: "Synthetic user", email: "fx@example.test" }).returning();
  await db.insert(chartAccount).values({ organizationId: org.id, code: "1200", name: "AR", type: "asset" });
  const [revenue] = await db.insert(chartAccount).values({ organizationId: org.id, code: "4000", name: "Revenue", type: "revenue" }).returning();
  await db.insert(exchangeRate).values({ organizationId: org.id, baseCurrency: "USD", targetCurrency: "EUR", rate: 800000, date: "2026-10-02", source: "api" });
  const data = { invoiceNumber: "FX-1", total: 1000, subtotal: 1000, taxTotal: 0,
    lines: [{ accountId: revenue.id, amount: 1000, taxAmount: 0 }], currencyCode: "EUR", date: "2026-10-02" };
  const original = await createInvoiceJournalEntry({ organizationId: org.id, userId: user.id }, data);
  assert.ok(original);
  const before = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, original.id));
  assert.equal(before.length, 2);
  assert.equal(before[0].exchangeRate, 1250000);
  assert.equal(before[0].rateExact, "1.25");
  assert.equal(before.reduce((sum, line) => sum + line.debitAmount, 0), 1250);
  const now = new Date("2026-10-02T12:00:00Z");
  const provider = { name: "exchangerate-api", fetchRates: async () => ({ provider: "exchangerate-api", base: "USD", date: "2026-10-02",
    rates: { EUR: "0.9" }, observedAt: "2026-10-02T01:00:00.000Z", importedAt: now.toISOString() }) };
  assert.equal((await processExchangeRateSync({ provider, now })).upserts, 1);
  assert.deepEqual(await db.select().from(journalLine).where(eq(journalLine.journalEntryId, original.id)), before);
  const next = await createInvoiceJournalEntry({ organizationId: org.id, userId: user.id }, { ...data, invoiceNumber: "FX-2" });
  assert.ok(next);
  const nextLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, next.id));
  assert.equal(nextLines[0].exchangeRate, 1111111);
  assert.equal(nextLines.reduce((sum, line) => sum + line.debitAmount, 0), 1111);
  // Exercise the real direct-DB MCP override; it must clear old provider metadata and audit.
  let setRate: (input: unknown) => Promise<{ isError?: boolean }>;
  const server = { tool(name: string, _description: string, _schema: unknown, handler: typeof setRate) {
    if (name === "set_exchange_rate") setRate = handler;
  } } as unknown as McpServer;
  registerCurrencyTools(server, { organizationId: org.id, userId: user.id, role: "owner" });
  assert.equal((await setRate!({ baseCurrency: "USD", targetCurrency: "EUR", date: "2026-10-02", rateDecimal: 0.5 })).isError, undefined);
  const manual = await db.query.exchangeRate.findFirst();
  assert.equal(manual?.source, "manual");
  assert.equal(manual?.provider, null); assert.equal(manual?.providerObservedAt, null);
  assert.equal((await db.execute(sql`SELECT count(*)::int AS count FROM audit_log WHERE entity_type='exchange_rate'`)).rows[0].count, 1);
  assert.equal((await processExchangeRateSync({ provider, now })).upserts, 0);
  assert.deepEqual(await db.select().from(journalLine).where(eq(journalLine.journalEntryId, original.id)), before);
  console.log("Invoice history preserved");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
