import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, subscription, apiKey, customRole, bankAccount, bankTransaction, chartAccount,
  journalEntry, journalLine, exchangeRate, periodLock, fiscalYear, payment, expenseClaim, auditLog, bankStatementImport, contact } from "../../lib/db/schema";
import { POST as record } from "../../app/api/v1/bank-transfers/route";
import { POST as match } from "../../app/api/v1/bank-transactions/[id]/match-transfer/route";
import { POST as categorize } from "../../app/api/v1/bank-transactions/[id]/categorize/route";
import { registerBankTransferTools } from "../../lib/mcp/tools/bank-transfers";
import { registerBankTransactionTools } from "../../lib/mcp/tools/bank-transactions";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Transfer fixture", version: "1" });
  registerBankTransferTools(server, ctx); registerBankTransactionTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools, names = tools.map(t => t.name);
  assert.equal(names.length, new Set(names).size);
  for (const name of ["record_bank_transfer", "match_transfer"]) {
    const tool = tools.find(t => t.name === name); assert.ok(tool); assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown>) { const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } }; },
    async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Transfer A", slug: "transfer-a" }, { name: "Transfer B", slug: "transfer-b" }]).returning();
  const [owner, viewer, banker] = await db.insert(users).values([{ email: "transfer-owner@example.test" }, { email: "transfer-viewer@example.test" }, { email: "transfer-banker@example.test" }]).returning();
  const [viewRole, bankRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "View", permissions: [] }, { organizationId: a.id, name: "Bank", permissions: ["manage:banking"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: banker.id, customRoleId: bankRole.id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro" }, { organizationId: b.id, plan: "pro" }]);
  const keys = { a: "dk_transfer_a", b: "dk_transfer_b", viewer: "dk_transfer_viewer", bank: "dk_transfer_bank", expired: "dk_transfer_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "bank" ? banker.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"),
    keyPrefix: "dk_transfer", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const mk = await mcp({ ...ctx, userId: banker.id, role: "member", permissions: ["manage:banking"] });
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/bank-transfers", { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 201) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const tables = ["bank_account", "bank_transaction", "chart_account", "journal_entry", "journal_line", "payment", "expense_claim", "bank_statement_import"];
  const snapshot = async () => [...await Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows))),
    (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mcpDenied = async (name: string, args: Record<string, unknown>, client = ma) => { const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); };
  const newBank = async (currencyCode = "USD", org = a.id, extra = {}) => (await db.insert(bankAccount).values({ organizationId: org, accountName: "Synthetic bank", currencyCode, balance: 1250, ...extra }).returning())[0];
  const source = await newBank(), target = await newBank(), foreign = await newBank("USD", b.id);
  const movement = async (amount = -1250, parent = source.id, extra = {}) => (await db.insert(bankTransaction).values({ bankAccountId: parent, amount, description: "Synthetic transfer", date: "2026-10-04", ...extra }).returning())[0];
  const input = { fromBankAccountId: source.id, toBankAccountId: target.id, date: "2026-10-04", amount: 12.50 };
  const matched = { targetBankAccountId: target.id };
  const check = async (journalEntryId: string, amount = 1250, baseAmount = amount) => {
    const entry = (await db.select().from(journalEntry).where(eq(journalEntry.id, journalEntryId)))[0];
    assert.equal(entry.status, "posted"); assert.equal(entry.sourceType, "bank_transfer");
    const rows = await db.select().from(bankTransaction).where(eq(bankTransaction.journalEntryId, journalEntryId));
    assert.equal(rows.length, 2); assert.equal(rows.reduce((s, r) => s + BigInt(r.amount), 0n), 0n);
    assert.deepEqual(rows.map(r => r.amount).sort((x, y) => x - y), [-amount, amount]);
    assert.ok(rows[0].transferGroupId); assert.equal(rows[0].transferGroupId, rows[1].transferGroupId);
    assert.equal(rows[0].transferTransactionId, rows[1].id); assert.equal(rows[1].transferTransactionId, rows[0].id);
    assert.ok(rows.every(r => r.status === "reconciled"));
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, journalEntryId));
    assert.equal(lines.length, 2);
    assert.equal(lines.reduce((s, l) => s + BigInt(l.debitAmount), 0n), BigInt(baseAmount));
    assert.equal(lines.reduce((s, l) => s + BigInt(l.creditAmount), 0n), BigInt(baseAmount));
    for (const row of rows) {
      const bank = (await db.select().from(bankAccount).where(eq(bankAccount.id, row.bankAccountId)))[0];
      const line = lines.find(l => l.accountId === bank.chartAccountId)!; assert.ok(line);
      assert.equal(line.debitAmount, row.amount > 0 ? baseAmount : 0); assert.equal(line.creditAmount, row.amount < 0 ? baseAmount : 0);
      assert.equal(line.rateMigrationStatus, "exact"); assert.ok(line.rateExact); assert.equal(line.rateDirection, "quote_per_base");
      assert.equal(bank.balance, 1250);
    }
    return { rows, lines, entry };
  };
  try {
    const fresh = await movement();
    for (const key of [keys.b, "dk_invalid", keys.expired, keys.viewer]) {
      const status = key === keys.b ? 404 : key === keys.viewer ? 403 : 401;
      await denied(() => record(req(input, key)), status); await denied(() => match(req(matched, key), params(fresh.id)), status);
    }
    for (const client of [mb, ro]) {
      await mcpDenied("record_bank_transfer", { ...input, amount: 1250 }, client);
      await mcpDenied("match_transfer", { transactionId: fresh.id, ...matched }, client);
    }
    for (const extra of [{ fromBankAccountId: foreign.id }, { toBankAccountId: foreign.id }, { fromBankAccountId: randomUUID() }]) await denied(() => record(req({ ...input, ...extra })), 404);
    const foreignLine = await movement(-1250, foreign.id);
    await denied(() => match(req(matched), params(foreignLine.id)), 404);
    await denied(() => match(req(matched), params("bad")), 400);
    await denied(() => match(req({ targetBankAccountId: foreign.id }), params(fresh.id)), 404);
    await denied(() => match(req({ ...matched, counterTransactionId: foreignLine.id }), params(fresh.id)), 404);
    await denied(() => record(new Request("http://fixture.test", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" })), 400);
    for (const extra of [{ amount: 0 }, { amount: -1 }, { amountMinor: "1251" }, { amountExact: "12.51" }, { amountMinor: "01" },
      { amount: 0.004 }, { date: "2026-02-30" }, { date: "2026-10-04T12:00:00Z" }, { unknown: 1 }, { fromBankAccountId: source.id, toBankAccountId: source.id }]) {
      await denied(() => record(req({ ...input, ...extra })), 400);
    }
    await denied(() => record(req({ ...input, amount: undefined, amountMinor: "9007199254740992" })), 422);
    await mcpDenied("record_bank_transfer", { ...input, amount: 12.50 });
    await mcpDenied("record_bank_transfer", { ...input, amount: 1250, amountExact: "12.51" });
    await mcpDenied("record_bank_transfer", { ...input, amount: 1250, unknown: 1 });
    const legacy = await data(await record(req(input, keys.bank))); await check(legacy.journalEntryId);
    const numericMcp = await ma.call("record_bank_transfer", { ...input, amount: 1250 }); assert.equal(numericMcp.isError, false); await check(numericMcp.body.journalEntryId);
    const dualRest = await data(await record(req({ ...input, amountMinor: "1250", amountExact: "12.50" }))); await check(dualRest.journalEntryId);
    const exact = await ma.call("record_bank_transfer", { ...input, amount: undefined, amountMinor: "1250", amountExact: "12.50" }); assert.equal(exact.isError, false); await check(exact.body.journalEntryId);
    const dual = await mk.call("record_bank_transfer", { ...input, amount: 1250, amountMinor: "1250", amountExact: "12.50" }); assert.equal(dual.isError, false); await check(dual.body.journalEntryId);
    const exactRest = await data(await record(req({ ...input, amount: undefined, amountMinor: "1250" }))); await check(exactRest.journalEntryId);
    const repeated = await data(await record(req(input))); assert.notEqual(repeated.journalEntryId, legacy.journalEntryId); await check(repeated.journalEntryId);
    const maximum = await data(await record(req({ ...input, amount: undefined, amountExact: "90071992547409.91", amountMinor: "9007199254740991" }))); await check(maximum.journalEntryId, Number.MAX_SAFE_INTEGER);
    for (const sign of [-1, 1]) {
      const row = await movement(sign * 1250), response = await data(await match(req(matched, keys.bank), params(row.id)));
      assert.equal(response.mirrorCreated, true); const saved = await check(response.journalEntryId); assert.ok(saved.rows.some(r => r.id === response.counterTransactionId && r.sourceType === "transfer"));
      await denied(() => match(req(matched), params(row.id)), 400); await mcpDenied("match_transfer", { transactionId: row.id, ...matched });
      const x = await movement(sign * 1250), y = await movement(-sign * 1250, target.id, { date: "2026-10-05", balance: 5000 });
      const linked = await ma.call("match_transfer", { transactionId: x.id, ...matched, counterTransactionId: y.id }); assert.equal(linked.isError, false);
      assert.equal(linked.body.mirrorCreated, false); assert.equal(linked.body.counterTransactionId, y.id); await check(linked.body.journalEntryId);
      const unchanged = (await db.select().from(bankTransaction).where(eq(bankTransaction.id, y.id)))[0]; assert.equal(unchanged.balance, 5000); assert.equal(unchanged.date, "2026-10-05");
    }
    for (const extra of [{ amount: 0 }, { status: "excluded" as const }, { status: "reconciled" as const }, { transferGroupId: randomUUID() }, { sourceType: "transfer" }, { currencyCode: "EUR" }]) {
      const row = await movement(-1250, source.id, extra); await denied(() => match(req(matched), params(row.id)), extra.currencyCode ? 422 : 400);
      await mcpDenied("match_transfer", { transactionId: row.id, ...matched });
    }
    for (const amount of [1251, -1250, 0]) {
      const x = await movement(), y = await movement(amount, target.id); await denied(() => match(req({ ...matched, counterTransactionId: y.id }), params(x.id)), 400);
    }
    for (const extra of [{ status: "excluded" as const }, { status: "reconciled" as const }, { currencyCode: "EUR" }, { transferGroupId: randomUUID() }]) {
      const y = await movement(1250, target.id, extra);
      await denied(() => match(req({ ...matched, counterTransactionId: y.id }), params(fresh.id)), extra.currencyCode ? 422 : 400);
      await mcpDenied("match_transfer", { transactionId: fresh.id, ...matched, counterTransactionId: y.id });
    }
    await denied(() => match(req({ ...matched, counterTransactionId: fresh.id }), params(fresh.id)), 404);
    await denied(() => match(req({ targetBankAccountId: source.id }), params(fresh.id)), 400);
    await denied(() => match(req({ ...matched, amountMinor: "1250" }), params(fresh.id)), 400);
    const inactive = await newBank("USD", a.id, { isActive: false }), deleted = await newBank("USD", a.id, { deletedAt: new Date() }), euro = await newBank("EUR");
    for (const [bank, status] of [[inactive, 400], [deleted, 404], [euro, 400]] as const) {
      await denied(() => record(req({ ...input, toBankAccountId: bank.id })), status);
      await denied(() => match(req({ targetBankAccountId: bank.id }), params(fresh.id)), status);
    }
    const [category] = await db.insert(chartAccount).values({ organizationId: a.id, code: "5000", name: "Category", type: "expense" }).returning();
    const codedRow = await movement(), coded = await data(await categorize(req({ accountId: category.id }), params(codedRow.id)));
    await denied(() => match(req(matched), params(codedRow.id)), 400);
    const linkedRow = await movement(-1250, source.id, { journalEntryId: coded.journalEntryId }); await denied(() => match(req(matched), params(linkedRow.id)), 400);
    const [party] = await db.insert(contact).values({ organizationId: a.id, name: "Transfer fixture party" }).returning();
    const payRow = await movement(); await db.insert(payment).values({ organizationId: a.id, contactId: party.id, paymentNumber: "PAY-1", type: "made", date: "2026-10-04", amount: 1250, bankTransactionId: payRow.id });
    await denied(() => match(req(matched), params(payRow.id)), 400);
    const claimRow = await movement(), [claim] = await db.insert(expenseClaim).values({ organizationId: a.id, title: "History", submittedBy: owner.id, totalAmount: 1250 }).returning();
    await db.insert(auditLog).values({ organizationId: a.id, userId: owner.id, entityType: "expense", entityId: claim.id, action: "create", changes: { bankTransactionId: claimRow.id } });
    await denied(() => match(req(matched), params(claimRow.id)), 400);
    const [foreignImport] = await db.insert(bankStatementImport).values({ organizationId: b.id, bankAccountId: foreign.id, format: "csv", fileName: "fixture", contentHash: "foreign" }).returning();
    const badImportRow = await movement(-1250, source.id, { importId: foreignImport.id }); await denied(() => match(req(matched), params(badImportRow.id)), 422);
    for (const bankId of [source.id, foreign.id]) {
      const unsafe = await movement(-1250, bankId); await db.execute(sql`update bank_transaction set amount = 9007199254740992 where id = ${unsafe.id}`);
      await denied(() => match(req(matched), params(unsafe.id)), bankId === source.id ? 422 : 404);
    }
    const unsafeBalance = await movement(-1250, source.id); await db.execute(sql`update bank_transaction set balance = 9007199254740992 where id = ${unsafeBalance.id}`);
    await denied(() => match(req(matched), params(unsafeBalance.id)), 422);
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-03", advisorLockDate: "2026-10-02" });
    await denied(() => record(req({ ...input, date: "2026-10-03" }, keys.bank)), 422);
    const lockedCounter = await movement(1250, target.id, { date: "2026-10-03" });
    await denied(() => match(req({ ...matched, counterTransactionId: lockedCounter.id }, keys.bank), params(fresh.id)), 422);
    const lockedSource = await movement(-1250, source.id, { date: "2026-10-03" });
    await denied(() => match(req(matched, keys.bank), params(lockedSource.id)), 422);
    await mcpDenied("match_transfer", { transactionId: lockedSource.id, ...matched }, mk);
    const advisor = await data(await record(req({ ...input, date: "2026-10-03" }))); await check(advisor.journalEntryId);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true });
    await denied(() => record(req(input)), 422); await denied(() => match(req(matched), params(fresh.id)), 422);
    await db.delete(fiscalYear).where(eq(fiscalYear.organizationId, a.id));
    for (const [currency, major, rate, total] of [["EUR", "12.50", "1.5", 1875], ["JPY", "1250", "0.01", 1250], ["KWD", "1.250", "3", 375], ["IRR", "1250", "0.01", 1250]] as const) {
      const from = await newBank(currency), to = await newBank(currency);
      await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: currency, targetCurrency: "USD", date: "2026-10-04", rate: Number(rate) * 1000000, rateExact: rate, rateDirection: "quote_per_base", rateMigrationStatus: "exact", rateFormatVersion: 1, rateProvenance: "fixture" });
      const result = await data(await record(req({ ...input, fromBankAccountId: from.id, toBankAccountId: to.id, amount: Number(major), amountExact: major, amountMinor: "1250" })));
      const saved = await check(result.journalEntryId, 1250, total); assert.ok(saved.lines.every(l => l.rateExact === rate && l.currencyCode === currency));
      const row = await movement(1250, from.id, { currencyCode: currency });
      const resultMcp = await mk.call("match_transfer", { transactionId: row.id, targetBankAccountId: to.id }); assert.equal(resultMcp.isError, false); await check(resultMcp.body.journalEntryId, 1250, total);
    }
    const gbp1 = await newBank("GBP"), gbp2 = await newBank("GBP");
    await denied(() => record(req({ ...input, fromBankAccountId: gbp1.id, toBankAccountId: gbp2.id })), 422);
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "GBP", targetCurrency: "USD", date: "2026-10-04", rate: 2000000, rateExact: "2", rateDirection: "quote_per_base", rateMigrationStatus: "exact", rateFormatVersion: 1, rateProvenance: "fixture" });
    await denied(() => record(req({ ...input, fromBankAccountId: gbp1.id, toBankAccountId: gbp2.id, amount: undefined, amountMinor: "9007199254740991" })), 422);
    const [inverseRate] = await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "USD", targetCurrency: "CHF", date: "2026-10-04", rate: 3000000 }).returning();
    const chf1 = await newBank("CHF"), chf2 = await newBank("CHF");
    await denied(() => record(req({ ...input, fromBankAccountId: chf1.id, toBankAccountId: chf2.id })), 422);
    await db.update(exchangeRate).set({ rate: 2000000, rateExact: "2" }).where(eq(exchangeRate.id, inverseRate.id));
    const inverse = await data(await record(req({ ...input, fromBankAccountId: chf1.id, toBankAccountId: chf2.id, amount: 12.50 })));
    await check(inverse.journalEntryId, 1250, 625);
    const cad1 = await newBank("CAD"), cad2 = await newBank("CAD");
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "CAD", targetCurrency: "USD", date: "2026-10-05", rate: 1000000 });
    await denied(() => record(req({ ...input, fromBankAccountId: cad1.id, toBankAccountId: cad2.id })), 422);
    const tiny1 = await newBank("SGD"), tiny2 = await newBank("SGD");
    await db.insert(exchangeRate).values({ organizationId: a.id, baseCurrency: "SGD", targetCurrency: "USD", date: "2026-10-04", rate: 1 });
    await denied(() => record(req({ ...input, fromBankAccountId: tiny1.id, toBankAccountId: tiny2.id, amount: undefined, amountMinor: "1" })), 422);
    const [badGl] = await db.insert(chartAccount).values({ organizationId: b.id, code: "1100", name: "Foreign GL", type: "asset" }).returning();
    const glBank = await newBank("USD", a.id, { chartAccountId: badGl.id }); await denied(() => record(req({ ...input, toBankAccountId: glBank.id })), 404);
    const sourceGl = (await db.select().from(bankAccount).where(eq(bankAccount.id, source.id)))[0].chartAccountId!;
    const sharedBank = await newBank("USD", a.id, { chartAccountId: sourceGl }); await denied(() => record(req(input)), 422);
    await db.update(bankAccount).set({ chartAccountId: null }).where(eq(bankAccount.id, sharedBank.id));
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, sourceGl)); await denied(() => record(req(input)), 422);
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, sourceGl));
    for (const extra of [{ deletedAt: new Date() }, { currencyCode: "EUR" }, { type: "expense" as const }]) {
      await db.update(chartAccount).set(extra).where(eq(chartAccount.id, sourceGl)); await denied(() => record(req(input)), 422);
      await denied(() => match(req(matched), params(fresh.id)), 422);
      await db.update(chartAccount).set({ deletedAt: null, currencyCode: "USD", type: "asset" }).where(eq(chartAccount.id, sourceGl));
    }
    const rollback1 = await newBank(), rollback2 = await newBank(), rollbackRow = await movement(-1250, rollback1.id);
    await db.execute(sql.raw("CREATE FUNCTION fail_transfer_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type = 'bank_transfer' OR NEW.action = 'matched_transfer' THEN RAISE EXCEPTION 'Synthetic audit fault'; END IF; RETURN NEW; END $$"));
    await db.execute(sql.raw("CREATE TRIGGER fail_transfer_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_transfer_audit()"));
    await denied(() => record(req({ ...input, fromBankAccountId: rollback1.id, toBankAccountId: rollback2.id })), 500);
    await denied(() => match(req({ targetBankAccountId: rollback2.id }), params(rollbackRow.id)), 500);
    const rollbackCounter = await movement(1250, rollback2.id);
    await denied(() => match(req({ targetBankAccountId: rollback2.id, counterTransactionId: rollbackCounter.id }), params(rollbackRow.id)), 500);
    await mcpDenied("record_bank_transfer", { ...input, fromBankAccountId: rollback1.id, toBankAccountId: rollback2.id, amount: 1250 });
    await mcpDenied("match_transfer", { transactionId: rollbackRow.id, targetBankAccountId: rollback2.id, counterTransactionId: rollbackCounter.id });
    await db.execute(sql.raw("DROP TRIGGER fail_transfer_audit ON audit_log")); await db.execute(sql.raw("DROP FUNCTION fail_transfer_audit()"));
    const raceRow = await movement();
    const race = await Promise.all([match(req(matched), params(raceRow.id)), match(req(matched), params(raceRow.id))]);
    assert.deepEqual(race.map(r => r.status).sort(), [201, 400]); await check((await race.find(r => r.status === 201)!.json()).journalEntryId);
    const x1 = await movement(), x2 = await movement(), common = await movement(1250, target.id);
    const counterRace = await Promise.all([match(req({ ...matched, counterTransactionId: common.id }), params(x1.id)), match(req({ ...matched, counterTransactionId: common.id }), params(x2.id))]);
    assert.deepEqual(counterRace.map(r => r.status).sort(), [201, 400]);
    const reverseA = await movement(), reverseB = await movement(1250, target.id);
    const oppositeRace = await Promise.all([match(req({ ...matched, counterTransactionId: reverseB.id }), params(reverseA.id)),
      match(req({ targetBankAccountId: source.id, counterTransactionId: reverseA.id }), params(reverseB.id))]);
    assert.deepEqual(oppositeRace.map(r => r.status).sort(), [201, 400]);
    const competingRow = await movement();
    const competing = await Promise.all([match(req(matched), params(competingRow.id)), categorize(req({ accountId: category.id }), params(competingRow.id))]);
    assert.deepEqual(competing.map(r => r.status).sort(), [201, 400]);
    const records = await Promise.all([record(req(input)), record(req({ ...input, fromBankAccountId: target.id, toBankAccountId: source.id }))]);
    for (const result of records) await check((await data(result)).journalEntryId);
    console.log("REST and MCP bank transfers verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); await mk.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
