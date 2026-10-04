import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, subscription, bankAccount, bankTransaction, bankStatementImport, bankImportProfile, chartAccount, bankRule, periodLock } from "../../lib/db/schema";
import { POST as statement } from "../../app/api/v1/bank-accounts/[id]/transactions/import/route";
import { POST as bulkPreview } from "../../app/api/v1/bulk/bank-transactions/preview/route";
import { POST as bulkImport } from "../../app/api/v1/bulk/bank-transactions/import/route";
import { GET as detail } from "../../app/api/v1/bank-imports/[id]/route";
import { GET as profileGet, PUT as profileSave, DELETE as profileDelete } from "../../app/api/v1/bank-accounts/[id]/import-profile/route";
import { registerBankImportTools } from "../../lib/mcp/tools/bank-imports";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Bank import fixture", version: "1" }); registerBankImportTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }); const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 8);
  for (const tool of tools) for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  return { async call(name: string, args: Record<string, unknown>) { const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } }; },
    async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Import A", slug: "import-a" }, { name: "Import B", slug: "import-b" }]).returning();
  const [owner, viewer] = await db.insert(users).values([{ email: "import-owner@example.test" }, { email: "import-viewer@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "Read", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: viewer.id, customRoleId: role.id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro" }, { organizationId: b.id, plan: "pro" }]);
  for (const [key, organizationId, createdBy, expired] of [["dk_import_a", a.id, owner.id, false], ["dk_import_b", b.id, owner.id, false], ["dk_import_viewer", a.id, viewer.id, false], ["dk_import_expired", a.id, owner.id, true]] as const)
    await db.insert(apiKey).values({ organizationId, createdBy, name: key, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_import", expiresAt: expired ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const req = (body?: unknown, key = "dk_import_a", method = body === undefined ? "GET" : "POST") => new Request("https://fixture.test/api/v1/bank", { method, headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const snapshot = async () => (await db.execute(sql`select jsonb_build_object(
    'bank', (select jsonb_agg(to_jsonb(t) order by id) from bank_account t),
    'transactions', (select jsonb_agg(to_jsonb(t) order by id) from bank_transaction t),
    'imports', (select jsonb_agg(to_jsonb(t) order by id) from bank_statement_import t),
    'profiles', (select jsonb_agg(to_jsonb(t) order by id) from bank_import_profile t),
    'jobs', (select jsonb_agg(to_jsonb(t) order by id) from bulk_import_job t),
    'audit', (select jsonb_agg(to_jsonb(t) order by id) from audit_log t),
    'journals', (select jsonb_agg(to_jsonb(t) order by id) from journal_entry t)) as snapshot`)).rows;
  const unchanged = async (work: () => Promise<unknown>) => { const before = await snapshot(); await work(); assert.deepEqual(await snapshot(), before); };
  const denied = async (work: () => Promise<Response>, status: number) => unchanged(async () => data(await work(), status));
  const mcpDenied = async (name: string, args: Record<string, unknown>, client = ma) => unchanged(async () => assert.equal((await client.call(name, args)).isError, true));
  try {
    const [bank, , foreign] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Bank", balance: 5000 }, { organizationId: a.id, accountName: "Other" }, { organizationId: b.id, accountName: "Secret bank" }]).returning();
    const csv = "date,description,amount,amountMinor,balanceMinor\n2026-10-04,Deposit,12.50,1250,5000\n2026-10-04,Deposit,12.50,1250,5000\n2026-10-04,Withdraw,-2.50,-250,4750";
    const input = { content: csv, format: "csv", fileName: "fixture.csv" };
    await unchanged(async () => {
      const rest = await data(await statement(req({ ...input, mode: "preview" }), params(bank.id)));
      assert.equal(rest.preview.rowCount, 3); assert.equal(rest.preview.duplicates.length, 1); assert.equal(rest.preview.transactions[0].amount, 1250); assert.equal(rest.preview.transactions[0].amountMinor, "1250"); assert.equal(rest.preview.transactions[0].balanceMinor, "5000");
      const mc = await ma.call("preview_bank_statement_import", { bankAccountId: bank.id, ...input }); assert.equal(mc.isError, false); assert.deepEqual(mc.body, rest);
    });
    const imported = await data(await statement(req(input), params(bank.id)), 201);
    assert.equal(imported.import.imported, 2); assert.equal(imported.import.duplicateCount, 1);
    assert.equal((await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bank.id) }))!.balance, 4750);
    const replay = await ma.call("import_bank_statement", { bankAccountId: bank.id, ...input }); assert.equal(replay.isError, false); assert.equal(replay.body.import.imported, 0); assert.equal(replay.body.import.duplicateCount, 3);
    assert.equal((await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bank.id) }))!.balance, 4750);
    await unchanged(async () => {
      const read = await data(await detail(req(), params(imported.import.importId))); assert.equal(read.import.bankAccount.balanceMinor, "4750"); assert.equal(read.import.transactions.length, 2); assert.equal(read.import.transactions[0].amountMinor, String(read.import.transactions[0].amount));
      assert.deepEqual((await ma.call("get_bank_statement_import", { importId: imported.import.importId })).body, read);
    });
    const concurrent = { content: "date,description,amount\n2026-10-04,Concurrent,0.01", format: "csv" };
    const runs = await Promise.all([statement(req(concurrent), params(bank.id)), statement(req(concurrent), params(bank.id))]);
    const summaries = await Promise.all(runs.map(r => data(r, 201))); assert.equal(summaries.reduce((s, r) => s + r.import.imported, 0), 1);
    assert.equal(summaries.reduce((s, r) => s + r.import.duplicateCount, 0), 1);
    const bulk = { fileName: "bulk.csv", source: "custom", rows: [
      { date: "10/04/2026", description: "Bulk one", bankAccountCode: "BANK", amount: 1.25, amountExact: "1.25", amountMinor: "125" },
      { date: "2026-10-04", description: "Bulk two", bankAccountCode: "Other", debit: "12.50", credit: "2.50" },
      { date: "10/04/2026", description: "Bulk one", bankAccountCode: "BANK", amountMinor: "125" },
    ] };
    await unchanged(async () => { const p = await data(await bulkPreview(req(bulk))); assert.equal(p.validCount, 3); assert.equal(p.preview[0].data.amount, 1.25); assert.equal(p.preview[1].data.amount, -10); assert.equal(p.preview[1].data.amountMinor, "-1000"); assert.deepEqual((await ma.call("preview_bank_transaction_import", bulk)).body, p); });
    const bulkResult = await data(await bulkImport(req(bulk)), 201); assert.equal(bulkResult.job.processedRows, 2); assert.equal(bulkResult.duplicates, 1);
    const bulkReplay = await ma.call("import_bank_transactions", bulk); assert.equal(bulkReplay.isError, false); assert.equal(bulkReplay.body.job.processedRows, 0); assert.equal(bulkReplay.body.duplicates, 3);
    assert.equal((await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bank.id) }))!.balance, 4750);
    const profile = { dateFormat: "DD/MM/YYYY", decimalSeparator: ",", thousandSeparator: ".", csvDelimiter: ";", debitIsNegative: false };
    const saved = await data(await profileSave(req(profile, "dk_import_a", "PUT"), params(bank.id))); assert.equal(saved.profile.timezone, "UTC");
    assert.deepEqual((await ma.call("get_bank_import_profile", { bankAccountId: bank.id })).body, saved);
    const pCsv = { content: "date;description;debit;credit\n04/10/2026;Profile;12,50;2,50", format: "csv" };
    assert.equal((await data(await statement(req({ ...pCsv, mode: "preview" }), params(bank.id)))).preview.transactions[0].amountMinor, "1000");
    assert.equal((await ma.call("import_bank_statement", { bankAccountId: bank.id, ...pCsv })).isError, false);
    assert.equal((await ma.call("save_bank_import_profile", { bankAccountId: bank.id, ...profile })).isError, false);
    assert.equal((await db.query.bankImportProfile.findMany({ where: eq(bankImportProfile.bankAccountId, bank.id) })).length, 1);
    assert.equal((await ma.call("delete_bank_import_profile", { bankAccountId: bank.id })).body.success, true);
    assert.equal((await data(await profileGet(req(), params(bank.id)))).profile, null);
    await data(await profileDelete(req(undefined, "dk_import_a", "DELETE"), params(bank.id)));

    for (const [key, status] of [["dk_import_b", 404], ["dk_import_viewer", 403], ["dk_bad", 401], ["dk_import_expired", 401]] as const) {
      await denied(() => statement(req(input, key), params(bank.id)), status);
      await denied(() => statement(req({ ...input, mode: "preview" }, key), params(bank.id)), status);
      await denied(() => profileSave(req(profile, key, "PUT"), params(bank.id)), status);
      await denied(() => profileDelete(req(undefined, key, "DELETE"), params(bank.id)), status);
    }
    for (const name of ["import_bank_statement", "preview_bank_statement_import"]) { await mcpDenied(name, { bankAccountId: bank.id, ...input }, mb); await mcpDenied(name, { bankAccountId: bank.id, ...input }, ro); }
    for (const name of ["import_bank_transactions", "preview_bank_transaction_import"]) await mcpDenied(name, bulk, ro);
    for (const name of ["get_bank_import_profile", "save_bank_import_profile", "delete_bank_import_profile"]) await mcpDenied(name, { bankAccountId: bank.id }, mb);
    await mcpDenied("get_bank_statement_import", { importId: imported.import.importId }, mb);
    await denied(() => detail(req(undefined, "dk_import_b"), params(imported.import.importId)), 404);
    await denied(() => profileGet(req(undefined, "dk_import_b"), params(bank.id)), 404);
    await denied(() => statement(req(input), params(foreign.id)), 404); await denied(() => statement(req(input), params(randomUUID())), 404);
    await denied(() => statement(req(input), params("bad")), 400);
    await mcpDenied("preview_bank_statement_import", { bankAccountId: bank.id, ...input, unexpected: 1 });
    await denied(() => statement(new Request("https://fixture.test", { method: "POST", headers: { authorization: "Bearer dk_import_a" }, body: "{" }), params(bank.id)), 400);
    for (const content of ["date,amount\n2026-10-04,12.501", "date,amount\n2026-02-30,12.50", "date,amountMinor\n2026-10-04,9007199254740992", "date,amount,amountMinor\n2026-10-04,12.50,1"]) {
      await denied(() => statement(req({ content, format: "csv" }), params(bank.id)), content.includes("900719925") ? 422 : 400);
      await mcpDenied("import_bank_statement", { bankAccountId: bank.id, content, format: "csv" });
    }
    await denied(() => statement(req({ ...input, csv: "different" }), params(bank.id)), 400);
    await denied(() => profileSave(req({ decimalSeparator: ".", thousandSeparator: "." }, "dk_import_a", "PUT"), params(bank.id)), 400);
    const badRows = { ...bulk, rows: [bulk.rows[0], { ...bulk.rows[1], amount: "12.50", amountMinor: "1" }] };
    await denied(() => bulkImport(req(badRows)), 400); await mcpDenied("import_bank_transactions", badRows);
    await unchanged(async () => { const p = await data(await bulkPreview(req(badRows))); assert.equal(p.validCount, 1); assert.equal(p.preview[1].valid, false); assert.ok(p.preview[1].errors.length); });
    await denied(() => bulkImport(req({ rows: [{ ...bulk.rows[0], bankAccountCode: "Secret bank" }] })), 400);
    await denied(() => bulkImport(req({ rows: [{ ...bulk.rows[0], bankAccountCode: "%" }] })), 400);
    await denied(() => bulkImport(req({ rows: [{ ...bulk.rows[0], amount: 90071992547409.9 }] })), 422);
    await denied(() => bulkImport(req({ rows: [{ ...bulk.rows[0], currencyCode: "EUR" }] })), 400);
    const [gl, foreignGl] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "6001", name: "Import suggestion", type: "expense" }, { organizationId: b.id, code: "6001", name: "Secret GL", type: "expense" }]).returning();
    const [rule] = await db.insert(bankRule).values({ organizationId: a.id, name: "Suggest", matchField: "description", matchType: "contains", matchValue: "RULE", accountId: gl.id, autoReconcile: true }).returning();
    await data(await statement(req({ content: "date,description,amount\n2026-10-04,RULE one,1.00", format: "csv" }), params(bank.id)), 201);
    const ruled = await db.query.bankTransaction.findFirst({ where: eq(bankTransaction.description, "RULE one") }); assert.equal(ruled!.accountId, gl.id); assert.equal(ruled!.status, "unreconciled"); assert.equal(ruled!.journalEntryId, null);
    await db.update(bankRule).set({ accountId: foreignGl.id }).where(eq(bankRule.id, rule.id));
    await denied(() => statement(req({ content: "date,description,amount\n2026-10-04,RULE two,1.00", format: "csv" }), params(bank.id)), 422);
    await db.update(bankRule).set({ isActive: false }).where(eq(bankRule.id, rule.id));
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2026-10-03", advisorLockDate: "2026-10-03" });
    const locked = { content: "date,description,amount\n2026-10-02,Locked,1.00", format: "csv" };
    await denied(() => statement(req(locked), params(bank.id)), 422); await mcpDenied("import_bank_statement", { bankAccountId: bank.id, ...locked });
    await denied(() => bulkImport(req({ rows: [{ date: "2026-10-04", description: "Open", amount: "1.00", bankAccountCode: "Bank" }, { date: "2026-10-02", description: "Closed", amount: "1.00", bankAccountCode: "Other" }] })), 422);
    // Force a storage failure after one account's history/rows/audit have been written.
    await db.execute(sql`create function fail_import_fixture() returns trigger language plpgsql as $$ begin if NEW.description = 'force rollback' then raise exception 'fixture rollback'; end if; return NEW; end $$`);
    await db.execute(sql`create trigger fail_import_fixture before insert on bank_transaction for each row execute function fail_import_fixture()`);
    await denied(() => bulkImport(req({ rows: [{ date: "2026-10-04", description: "Before rollback", amount: "1.00", bankAccountCode: "Bank" }, { date: "2026-10-04", description: "force rollback", amount: "1.00", bankAccountCode: "Other" }] })), 500);
    await denied(() => statement(req({ content: "date,description,amount\n2026-10-04,force rollback,1.00", format: "csv" }), params(bank.id)), 500);
    await db.execute(sql`drop trigger fail_import_fixture on bank_transaction`); await db.execute(sql`drop function fail_import_fixture()`);
    for (const [currencyCode, major] of [["JPY", "1250"], ["KWD", "1.250"], ["IRR", "1250"]] as const) {
      const [scaleBank] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: currencyCode, currencyCode }).returning();
      const scaleInput = { content: `date,description,amount\n2026-10-04,Scale,${major}`, format: "csv" };
      assert.equal((await data(await statement(req({ ...scaleInput, mode: "preview" }), params(scaleBank.id)))).preview.transactions[0].amountMinor, "1250");
      assert.equal((await ma.call("import_bank_statement", { bankAccountId: scaleBank.id, ...scaleInput })).body.import.imported, 1);
    }
    // Exercise every format through actual adapters, alternating commit transports.
    const formats = {
      csv: "date,description,amountExact,amountMinor\n2026-10-04,Format,12.50,1250",
      tsv: "date\tdescription\tamount\n2026-10-04\tFormat\t12.50",
      qif: "!Type:Bank\nD10/04/2026\nT12.50\nPFormat\n^",
      ofx: "<OFX><CURDEF>USD\n<ACCTID>1\n<STMTTRN><DTPOSTED>20261004000000\n<TRNAMT>12.50\n<FITID>1\n</STMTTRN></OFX>",
      camt053: '<Document><Ccy>USD</Ccy><Ntry><Amt Ccy="USD">12.50</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-04</Dt></BookgDt></Ntry></Document>',
      mt940: ":20:1\n:25:bank\n:60F:C261004USD0,00\n:61:261004C12,50NTRFref\n:62F:C261004USD12,50",
      bai2: "02,sender,receiver,1,261004,0000,USD/\n03,bank,USD/\n16,195,1250,,ref,,Format/",
    };
    const contentByFormat = { ...formats, qfx: formats.ofx, qbo: formats.ofx, camt052: formats.camt053, camt054: formats.camt053, mt942: formats.mt940 };
    for (const [index, [format, content]] of Object.entries(contentByFormat).entries()) {
      const [fmtBank] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: format }).returning();
      const body = { format, content };
      const p = await data(await statement(req({ ...body, mode: "preview" }), params(fmtBank.id)));
      assert.equal(p.preview.transactions[0].amount, 1250); assert.equal(p.preview.transactions[0].amountMinor, "1250");
      const mcPreview = await ma.call("preview_bank_statement_import", { bankAccountId: fmtBank.id, ...body }); assert.deepEqual(mcPreview.body, p);
      const imported = index % 2 ? (await ma.call("import_bank_statement", { bankAccountId: fmtBank.id, ...body })).body : await data(await statement(req(body), params(fmtBank.id)), 201);
      assert.equal(imported.import.imported, 1);
    }
    for (const [key, status] of [["dk_import_viewer", 403], ["dk_bad", 401], ["dk_import_expired", 401]] as const) {
      await denied(() => bulkImport(req(bulk, key)), status); await denied(() => bulkPreview(req(bulk, key)), status);
    }
    await mcpDenied("import_bank_transactions", bulk, mb);
    const [overlapBank] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: "Overlap" }).returning();
    const overlap = (second = false) => `<Document><Ccy>USD</Ccy><Bal><Cd>OPBD</Cd><Amt Ccy="USD">100.00</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal><Ntry><Amt Ccy="USD">1.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-04</Dt></BookgDt><NtryRef>first</NtryRef></Ntry>${second ? '<Ntry><Amt Ccy="USD">2.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-04</Dt></BookgDt><NtryRef>second</NtryRef></Ntry>' : ""}</Document>`;
    await data(await statement(req({ content: overlap(), format: "camt053" }), params(overlapBank.id)), 201);
    await data(await statement(req({ content: overlap(true), format: "camt053" }), params(overlapBank.id)), 201);
    assert.equal((await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, overlapBank.id) }))!.balance, 10300);
    const [edgeBank] = await db.insert(bankAccount).values({ organizationId: a.id, accountName: "Edge", balance: 0 }).returning();
    const edge = { content: "date,description,amountMinor,balanceMinor\n2026-10-04,Safe edge,9007199254740991,9007199254740991", format: "csv" };
    const edgeResult = await data(await statement(req(edge), params(edgeBank.id)), 201); assert.equal(edgeResult.import.transactions[0].amountMinor, "9007199254740991");
    const overflow = '<Document><Ccy>USD</Ccy><Bal><Cd>OPBD</Cd><Amt Ccy="USD">90071992547409.91</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal><Ntry><Amt Ccy="USD">0.01</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-04</Dt></BookgDt></Ntry></Document>';
    await denied(() => statement(req({ content: overflow, format: "camt053" }), params(edgeBank.id)), 422);
    await db.execute(sql`update bank_account set balance = 9007199254740992 where id = ${bank.id}`); await denied(() => statement(req(input), params(bank.id)), 422);
    await db.update(bankAccount).set({ balance: 4750 }).where(eq(bankAccount.id, bank.id));
    await db.update(bankStatementImport).set({ organizationId: b.id }).where(eq(bankStatementImport.id, imported.import.importId)); await denied(() => detail(req(), params(imported.import.importId)), 404);
    await db.update(bankStatementImport).set({ organizationId: a.id }).where(eq(bankStatementImport.id, imported.import.importId));
    await db.update(bankTransaction).set({ bankAccountId: foreign.id }).where(eq(bankTransaction.importId, imported.import.importId)); await denied(() => detail(req(), params(imported.import.importId)), 422);
    await db.update(bankTransaction).set({ bankAccountId: bank.id }).where(eq(bankTransaction.importId, imported.import.importId));
    await db.update(bankTransaction).set({ accountId: foreignGl.id }).where(eq(bankTransaction.importId, imported.import.importId)); await denied(() => detail(req(), params(imported.import.importId)), 422);
    await db.update(bankTransaction).set({ accountId: null }).where(eq(bankTransaction.importId, imported.import.importId));
    await db.update(bankAccount).set({ deletedAt: new Date() }).where(eq(bankAccount.id, bank.id));
    await denied(() => statement(req(input), params(bank.id)), 404); await denied(() => detail(req(), params(imported.import.importId)), 404); await denied(() => profileGet(req(), params(bank.id)), 404);
    console.log("REST and MCP bank imports verified");
  } finally { await ma.close(); await mb.close(); await ro.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
