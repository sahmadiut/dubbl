import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, journalLine, journalEntry } from "../../lib/db/schema";
import { GET, POST } from "../../app/api/v1/opening-balances/route";
import { registerOpeningBalanceTools } from "../../lib/mcp/tools/opening-balances";
import { openingBalancePreview, openingBalanceSaved } from "../../lib/money/opening-balance-ui";

async function run() {
  const [user] = await db.insert(users).values({ email: "opening-ui@example.test" }).returning();
  for (const currency of ["USD", "JPY", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: "Opening UI", slug: `opening-ui-${currency}`, defaultCurrency: currency }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: user.id, role: "owner" });
    const key = `dk_opening_ui_${currency}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: user.id, name: "UI fixture", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_opening" });
    const [account] = await db.insert(chartAccount).values({ organizationId: org.id, code: "100", name: "Cash", type: "asset", currencyCode: currency }).returning();
    const server = new McpServer({ name: "Opening UI fixture", version: "1.0.0" });
    registerOpeningBalanceTools(server, { organizationId: org.id, userId: user.id, role: "owner" });
    const client = new Client({ name: "UI fixture", version: "1.0.0" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    async function call(name: string, args: Record<string, unknown>) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, undefined, `${name}: ${JSON.stringify(result.content)}`);
      return JSON.parse((result.content as { type: string; text: string }[])[0].text);
    }
    const request = (body?: unknown) => new Request("http://fixture.test/api/v1/opening-balances", {
      method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    async function ok(response: Response) { const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body; }
    try {
      assert.equal((await ok(await GET(request()))).entry, null);
      let prior: string | undefined;
      for (const rows of [
        [{ accountId: account.id, debit: "0.10", credit: "" }, { accountId: account.id, debit: "0.20", credit: "" }, { accountId: account.id, debit: "", credit: "0.30" }],
        [{ accountId: account.id, debit: "40000000000000.01", credit: "" }, { accountId: account.id, debit: "", credit: "40000000000000.01" }],
        [{ accountId: account.id, debit: "90071992547409.91", credit: "90071992547409.91" }],
      ]) {
        const preview = openingBalancePreview(rows); assert.equal(preview.isBalanced, true);
        const payload = { date: "2026-10-11", balances: preview.balances };
        // This UI intentionally sends no currency or unsupported Minor fields.
        assert.deepEqual(Object.keys(payload.balances[0]).sort(), ["accountId", "creditAmount", "debitAmount"]);
        const rest = await ok(await POST(request(payload)));
        if (prior) {
          const [old] = await db.select().from(journalEntry).where(eq(journalEntry.id, prior)); assert.equal(old.status, "void");
        }
        const mcpRead = await call("get_opening_balances", {});
        assert.equal(mcpRead.entry.id, rest.entry.id);
        assert.equal(openingBalanceSaved(mcpRead.entry.lines).totalDebit, preview.totalDebit);
        const mcpWrite = await call("set_opening_balances", payload);
        const saved = await ok(await GET(request())); assert.equal(saved.entry.id, mcpWrite.entry.id);
        const amounts = openingBalanceSaved(saved.entry.lines);
        assert.equal(amounts.totalDebit, preview.totalDebit); assert.equal(amounts.totalCredit, preview.totalCredit);
        const sqlLines = await db.select({ debit: sql<string>`${journalLine.debitAmount}::text`, credit: sql<string>`${journalLine.creditAmount}::text`, currency: journalLine.currencyCode }).from(journalLine).where(eq(journalLine.journalEntryId, saved.entry.id));
        assert.equal(sqlLines.reduce((sum, line) => sum + BigInt(line.debit), 0n), preview.totalDebit);
        assert.equal(sqlLines.reduce((sum, line) => sum + BigInt(line.credit), 0n), preview.totalCredit);
        // Legacy policy remains fixed cents/default USD, even for JPY/KWD orgs.
        assert.ok(sqlLines.every(line => line.currency === "USD"));
        prior = saved.entry.id;
      }
    } finally { await client.close(); await server.close(); }
  }
  console.log("Opening UI stored amounts verified");
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
