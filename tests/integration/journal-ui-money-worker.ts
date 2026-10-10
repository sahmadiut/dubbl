import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, chartAccount, costCenter, journalLine } from "../../lib/db/schema";
import { POST as createEntry, GET as listEntries } from "../../app/api/v1/entries/route";
import { GET as getEntry, PUT as editEntry } from "../../app/api/v1/entries/[id]/route";
import { POST as createTemplate } from "../../app/api/v1/recurring-journals/route";
import { GET as getTemplate } from "../../app/api/v1/recurring-journals/[id]/route";
import { registerEntryTools } from "../../lib/mcp/tools/entries";
import { registerRecurringJournalTools } from "../../lib/mcp/tools/recurring-journals";
import { journalEditorPreview, journalRestMinor, journalDecimal } from "../../lib/money/journal-display";

async function run() {
  const [org] = await db.insert(organization).values({ name: "Journal UI", slug: "journal-ui" }).returning();
  const [user] = await db.insert(users).values({ email: "journal-ui@example.test" }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: user.id, role: "owner" });
  const key = "dk_journal_ui_fixture";
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: user.id, name: "UI fixture", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_journal" });
  const [account] = await db.insert(chartAccount).values({ organizationId: org.id, code: "100", name: "UI account", type: "asset" }).returning();
  const [center] = await db.insert(costCenter).values({ organizationId: org.id, name: "UI center", code: "UI" }).returning();
  const server = new McpServer({ name: "Journal UI fixture", version: "1.0.0" });
  registerEntryTools(server, { organizationId: org.id, userId: user.id, role: "owner" });
  registerRecurringJournalTools(server, { organizationId: org.id, userId: user.id, role: "owner" });
  const client = new Client({ name: "UI fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined, `${name}: ${JSON.stringify(result.content)}`);
    return JSON.parse((result.content as { type: string; text: string }[])[0].text);
  }
  const request = (body?: unknown, method = "POST") => new Request("http://fixture.test/api/v1/entries", {
    method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  async function ok(response: Response) {
    const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body;
  }
  try {
    for (const [currency, text, expected] of [
      ["USD", "40000000000000.01", "4000000000000001"], ["IRR", "1251", "1251"],
      ["JPY", "1251", "1251"], ["KWD", "1.251", "1251"],
    ]) {
      const preview = journalEditorPreview([
        { accountId: account.id, description: "Debit", debit: text, credit: "", currencyCode: currency },
        { accountId: account.id, description: "Credit", debit: "", credit: text, currencyCode: currency },
      ]);
      assert.equal(preview.isBalanced, true); assert.equal(String(preview.totalDebit), expected);
      const payload = { date: "2026-10-11", description: "UI journal", lines: preview.lines };
      const rest = await ok(await createEntry(request(payload)));
      const mcp = await call("create_entry", payload);
      for (const id of [rest.entry.id, mcp.entry.id]) {
        const saved = await ok(await getEntry(request(undefined, "GET"), params(id)));
        const source = saved.entry.lines;
        assert.equal(String(journalRestMinor(source[0].debitAmount, source[0].debitAmountMinor)), expected);
        const editorRows = source.map((line: typeof preview.lines[number] & { debitAmount: string; creditAmount: string }) => ({
          accountId: line.accountId, description: line.description ?? "", currencyCode: line.currencyCode,
          debit: journalDecimal(journalRestMinor(line.debitAmount, line.debitAmountMinor), line.currencyCode),
          credit: journalDecimal(journalRestMinor(line.creditAmount, line.creditAmountMinor), line.currencyCode),
          exchangeRate: line.exchangeRate, costCenterId: center.id,
        }));
        const editPreview = journalEditorPreview(editorRows); assert.equal(editPreview.isBalanced, true);
        await ok(await editEntry(request({ ...payload, description: "Edited", lines: editPreview.lines }, "PUT"), params(id)));
        const sqlLines = await db.select({ debit: sql<string>`${journalLine.debitAmount}::text`, credit: sql<string>`${journalLine.creditAmount}::text`, currency: journalLine.currencyCode, center: journalLine.costCenterId }).from(journalLine).where(eq(journalLine.journalEntryId, id));
        assert.equal(sqlLines.reduce((sum, line) => sum + BigInt(line.debit), 0n).toString(), expected);
        assert.ok(sqlLines.every(line => line.currency === currency && line.center === center.id));
        const mcpRead = await call("get_entry", { entryId: id });
        assert.equal(mcpRead.entry.lines.reduce((sum: bigint, line: { debitAmountMinor: string }) => sum + BigInt(line.debitAmountMinor), 0n).toString(), expected);
      }
      const legs = preview.lines.map(({ accountId, description, debitAmountMinor, creditAmountMinor }) => ({ accountId, description, debitAmountMinor, creditAmountMinor }));
      const templatePayload = { name: "UI template", frequency: "monthly", startDate: "2026-10-11", currencyCode: currency, lines: legs };
      const template = await ok(await createTemplate(request(templatePayload)));
      const savedTemplate = await ok(await getTemplate(request(undefined, "GET"), params(template.template.id)));
      assert.equal(savedTemplate.template.lines.reduce((sum: bigint, line: { debitAmountMinor: string }) => sum + BigInt(line.debitAmountMinor), 0n).toString(), expected);
      const mcpTemplate = await call("create_recurring_journal", templatePayload);
      const mcpSaved = await call("get_recurring_journal", { templateId: mcpTemplate.template.id });
      assert.equal(mcpSaved.template.lines.reduce((sum: bigint, line: { debitAmountMinor: string }) => sum + BigInt(line.debitAmountMinor), 0n).toString(), expected);
    }
    const list = await ok(await listEntries(request(undefined, "GET")));
    for (const entry of list.entries) assert.equal(String(journalRestMinor(entry.totalDebit, entry.totalDebitMinor)), entry.totalDebitMinor);
    // A description-only edit keeps a nonidentity saved FX rate and its amount scale.
    const fxRows = [
      { accountId: account.id, description: "FX debit", debit: "1.251", credit: "", currencyCode: "KWD", exchangeRate: 1234567 },
      { accountId: account.id, description: "FX credit", debit: "", credit: "1.251", currencyCode: "KWD", exchangeRate: 1234567 },
    ];
    const fxPayload = { date: "2026-10-11", description: "Saved FX", lines: journalEditorPreview(fxRows).lines };
    const fx = await ok(await createEntry(request(fxPayload)));
    await ok(await editEntry(request({ ...fxPayload, description: "FX memo edit" }, "PUT"), params(fx.entry.id)));
    const fxSaved = await ok(await getEntry(request(undefined, "GET"), params(fx.entry.id)));
    assert.ok(fxSaved.entry.lines.every((line: { currencyCode: string; rateExact: string; exchangeRate: number }) => line.currencyCode === "KWD" && line.exchangeRate === 1234567 && line.rateExact === "1.234567"));
    console.log("Journal UI stored amounts verified");
  } finally { await client.close(); await server.close(); }
}

run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
