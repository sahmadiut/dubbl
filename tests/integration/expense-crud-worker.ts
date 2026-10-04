// Only the harness-created disposable PostgreSQL database is used.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, chartAccount, taxRate, costCenter,
  expenseClaim, expenseItem, periodLock, fiscalYear, journalEntry, attachment } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/expenses/route";
import { GET as get, PATCH as update, DELETE as remove } from "../../app/api/v1/expenses/[id]/route";
import { GET as counts } from "../../app/api/v1/expenses/counts/route";
import { registerExpenseCrudTools } from "../../lib/mcp/tools/expense-crud";
import { registerExpenseTools } from "../../lib/mcp/tools/expenses";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Expense fixture", version: "1.0.0" });
  registerExpenseCrudTools(server, ctx); registerExpenseTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const names = (await client.listTools()).tools.map(tool => tool.name);
  for (const name of ["list_expense_claims", "get_expense_claim", "get_expense_claim_counts", "create_expense_claim", "update_expense_claim", "delete_expense_claim", "submit_expense_claim", "pay_expense_claim"])
    assert.ok(names.includes(name), name);
  assert.equal(names.length, new Set(names).size);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Expense A", slug: "expense-a" }, { name: "Expense B", slug: "expense-b" }]).returning();
  const [owner, viewer, expenseOnly, outsider] = await db.insert(users).values([
    { email: "expense-owner@example.test", passwordHash: "fixture-secret-never-disclose" }, { email: "expense-viewer@example.test" },
    { email: "expense-only@example.test" }, { email: "expense-outsider@example.test" }]).returning();
  const [readRole, expenseRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "Read only", permissions: [] },
    { organizationId: a.id, name: "Expense only", permissions: ["manage:expenses"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: readRole.id }, { organizationId: a.id, userId: expenseOnly.id, customRoleId: expenseRole.id },
    { organizationId: b.id, userId: outsider.id }]);
  const keys = { a: "dk_expense_a", b: "dk_expense_b", viewer: "dk_expense_viewer", expenseOnly: "dk_expense_only", expired: "dk_expense_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "expenseOnly" ? expenseOnly.id : owner.id, name: label,
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_expense", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const [account, foreignAccount, asset] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "5990", name: "Expense", type: "expense" }, { organizationId: b.id, code: "5990", name: "Foreign expense", type: "expense" },
    { organizationId: a.id, code: "1100", name: "Cash", type: "asset" }]).returning();
  const [tax, foreignTax, salesTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "VAT", rate: 1000, type: "purchase" },
    { organizationId: b.id, name: "Foreign VAT", rate: 1000 }, { organizationId: a.id, name: "Sales", rate: 1000, type: "sales" }]).returning();
  const [center, foreignCenter] = await db.insert(costCenter).values([{ organizationId: a.id, code: "A", name: "Own" }, { organizationId: b.id, code: "B", name: "Foreign" }]).returning();
  const [receipt, foreignReceipt] = await db.insert(attachment).values([
    { organizationId: a.id, fileKey: `${a.id}/fixture/receipt.pdf`, fileName: "receipt.pdf", fileSize: 1, mimeType: "application/pdf" },
    { organizationId: b.id, fileKey: `${b.id}/fixture/receipt.pdf`, fileName: "receipt.pdf", fileSize: 1, mimeType: "application/pdf" }]).returning();
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), readOnly = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const request = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/expenses", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const read = (key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/expenses${query}`, { headers: { authorization: `Bearer ${key}` } });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const getOne = (id: string, key = keys.a) => get(read(key), params(id));
  const patch = (id: string, body: unknown, key = keys.a) => update(request(body, key), params(id));
  const del = (id: string, key = keys.a) => remove(request({}, key), params(id));
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const tables = ["expense_claim", "expense_item", "journal_entry", "journal_line", "payment", "payment_allocation", "chart_account", "number_sequence"];
  const snapshot = async () => [...await Promise.all(tables.map(table => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`)).then(r => r.rows))),
    (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  async function denied(fn: () => Promise<Response>, status: number) { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); }
  async function mcpDenied(name: string, args: Record<string, unknown> = {}, client = ma) {
    const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before);
  }
  const line = { date: "2026-10-04", description: "Travel", amount: 12.5, accountId: account.id, taxRateId: tax.id, costCenterId: center.id,
    receiptFileKey: receipt.fileKey, receiptFileName: receipt.fileName };
  const input = { title: "Fixture", items: [line] };
  try {
    const first = (await data(await create(request({ ...input, items: [{ ...line, amountMinor: "1250", amountExact: "12.50" }] }, keys.expenseOnly)), 201)).expenseClaim;
    assert.equal(first.organizationId, a.id); assert.equal(first.submittedBy, expenseOnly.id); assert.equal(first.totalAmount, 1250); assert.equal(first.totalAmountMinor, "1250");
    const detail = (await data(await getOne(first.id))).expenseClaim;
    const invalidJson = () => new Request("http://fixture.test/api/v1/expenses", { method: "POST", headers: { authorization: `Bearer ${keys.a}` }, body: "{" });
    await denied(() => create(invalidJson()), 400); await denied(() => update(invalidJson(), params(first.id)), 400);
    assert.equal(detail.items[0].amountMinor, "1250"); assert.equal(detail.items[0].account.organizationId, a.id); assert.equal(detail.items[0].taxRateId, tax.id);
    assert.equal("passwordHash" in detail.submittedByUser, false); assert.equal("sessionRevokedAt" in detail.submittedByUser, false);
    assert.equal((await data(await list(read(keys.a, "?limit=1&status=draft")))).pagination.total, 1);
    assert.equal((await ma.call("list_expense_claims")).body.expenseClaims[0].totalAmountMinor, "1250");
    assert.equal((await readOnly.call("get_expense_claim", { expenseClaimId: first.id })).body.expenseClaim.items[0].amount, 1250);
    assert.equal((await data(await counts(read(keys.viewer)))).counts.draft.amountMinor, "1250");
    assert.equal((await ma.call("get_expense_claim_counts")).body.counts.draft.currencyCode, "USD");
    assert.equal((await data(await list(read(keys.b)))).data.length, 0);
    assert.deepEqual((await mb.call("get_expense_claim_counts")).body, { counts: {}, total: 0 });
    for (const [key, status] of [["dk_invalid", 401], [keys.expired, 401], [keys.viewer, 403]] as const) await denied(() => create(request(input, key)), status);
    await denied(() => create(request(input, keys.b)), 422);
    await mcpDenied("create_expense_claim", { ...input, items: [{ ...line, amount: 1250 }] }, mb);
    await mcpDenied("get_expense_claim_counts", { amountMinor: "1" });
    for (const operation of [() => patch(first.id, { title: "denied" }, keys.viewer), () => del(first.id, keys.viewer)]) await denied(operation, 403);
    for (const operation of [() => getOne(first.id, keys.b), () => patch(first.id, { title: "foreign" }, keys.b), () => del(first.id, keys.b)]) await denied(operation, 404);
    await denied(() => getOne("bad"), 400); await denied(() => getOne(randomUUID()), 404);
    await denied(() => list(read(keys.a, "?status=bogus")), 400); await denied(() => list(read(keys.a, "?page=bad")), 400);
    await mcpDenied("create_expense_claim", { ...input, items: [{ ...line, amount: 1250 }] }, readOnly);
    await mcpDenied("update_expense_claim", { expenseClaimId: first.id, title: "denied" }, readOnly);
    await mcpDenied("delete_expense_claim", { expenseClaimId: first.id }, readOnly);
    for (const name of ["get_expense_claim", "update_expense_claim", "delete_expense_claim"]) await mcpDenied(name, { expenseClaimId: first.id }, mb);
    for (const extra of [{ amount: undefined }, { amount: -1 }, { amountMinor: "1251" }, { amountExact: "12.51" }, { amountMinor: "01" },
      { amountMinor: "-1", amount: undefined }, { amountExact: "1e3", amount: undefined }, { date: "2026-02-30" }, { accountId: "bad" },
      { distanceMiles: 2147483648 }, { isMileage: true }, { mileageRateMinor: "-1" }, { projectId: randomUUID() }]) {
      await denied(() => create(request({ ...input, items: [{ ...line, ...extra }] })), 400);
      await mcpDenied("create_expense_claim", { ...input, items: [{ ...line, amount: 1250, ...extra }] });
    }
    for (const amountMinor of ["9007199254740992", "9223372036854775807"]) {
      await denied(() => create(request({ ...input, items: [{ ...line, amount: undefined, amountMinor }] })), 422);
      await mcpDenied("create_expense_claim", { ...input, items: [{ ...line, amount: undefined, amountMinor }] });
    }
    await denied(() => create(request({ title: "Overflow", items: [{ ...line, amount: undefined, amountMinor: "9007199254740991" }, { ...line, amountMinor: undefined, amount: 0.01 }] })), 422);
    for (const extra of [{ accountId: foreignAccount.id }, { taxRateId: foreignTax.id }, { costCenterId: foreignCenter.id }, { accountId: randomUUID() },
      { receiptFileKey: foreignReceipt.fileKey }, { receiptFileKey: `${a.id}/missing/receipt.pdf` }]) {
      await denied(() => create(request({ ...input, items: [{ ...line, ...extra }] })), 422);
      await mcpDenied("create_expense_claim", { ...input, items: [{ ...line, amount: 1250, ...extra }] });
      await denied(() => patch(first.id, { items: [{ ...line, ...extra }] }), 422);
    }
    for (const extra of [{ accountId: asset.id }, { taxRateId: salesTax.id }]) await denied(() => create(request({ ...input, items: [{ ...line, ...extra }] })), 400);
    await db.update(chartAccount).set({ isActive: false }).where(eq(chartAccount.id, account.id)); await denied(() => create(request(input)), 400);
    await db.update(chartAccount).set({ isActive: true }).where(eq(chartAccount.id, account.id));
    await db.update(taxRate).set({ recoverablePercent: 10001 }).where(eq(taxRate.id, tax.id)); await denied(() => create(request(input)), 422);
    await db.update(taxRate).set({ recoverablePercent: 10000 }).where(eq(taxRate.id, tax.id));
    const mileage = (await ma.call("create_expense_claim", { title: "Mileage", items: [{ ...line, amount: 1250, isMileage: true, distanceMiles: 1800, mileageRate: 67, mileageRateMinor: "67" }] })).body.expenseClaim;
    assert.equal(mileage.totalAmount, 1250); // MCP used to multiply documented cents again.
    const savedMileage = (await data(await getOne(mileage.id))).expenseClaim.items[0]; assert.equal(savedMileage.mileageRateMinor, "67");
    const edited = (await data(await patch(mileage.id, { title: "Corrected", items: [{ id: savedMileage.id, date: line.date, description: "Retained", amountExact: "10.00" }] }))).expenseClaim;
    assert.equal(edited.totalAmountMinor, "1000"); assert.equal(edited.currencyCode, "USD");
    const retained = (await ma.call("get_expense_claim", { expenseClaimId: mileage.id })).body.expenseClaim.items[0];
    for (const field of ["taxRateId", "costCenterId", "accountId", "isMileage", "distanceMiles", "mileageRate", "receiptFileKey", "receiptFileName"]) assert.equal(retained[field], savedMileage[field]);
    assert.equal((await ma.call("update_expense_claim", { expenseClaimId: mileage.id, items: [{ id: retained.id, date: line.date, description: "Minor", amount: 1250, amountMinor: "1250" }] })).body.expenseClaim.totalAmount, 1250);
    await denied(() => patch(first.id, { items: [{ ...line, id: retained.id }] }), 400);
    await denied(() => patch(first.id, { items: [{ ...line, id: detail.items[0].id }, { ...line, id: detail.items[0].id }] }), 400);
    for (const extra of [{ currencyCode: "EUR" }, { totalAmount: 1 }, { status: "paid" }, { submittedBy: outsider.id }]) await denied(() => patch(first.id, extra), 400);
    await mcpDenied("update_expense_claim", { expenseClaimId: first.id, currencyCode: "EUR" });
    for (const status of ["submitted", "approved", "paid"] as const) {
      await db.update(expenseClaim).set({ status }).where(eq(expenseClaim.id, first.id));
      await denied(() => patch(first.id, { title: "state" }), 400); await denied(() => del(first.id), 400);
      await mcpDenied("update_expense_claim", { expenseClaimId: first.id, title: "state" }); await mcpDenied("delete_expense_claim", { expenseClaimId: first.id });
    }
    await db.update(expenseClaim).set({ status: "rejected" }).where(eq(expenseClaim.id, first.id));
    await data(await patch(first.id, { title: "Rejected correction", description: null }));
    const [lock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: line.date }).returning();
    await denied(() => create(request(input)), 422); await denied(() => patch(first.id, { title: "locked" }), 422);
    await denied(() => patch(first.id, { items: [{ ...line, date: "2026-10-05" }] }), 422); await denied(() => del(first.id), 422);
    await mcpDenied("delete_expense_claim", { expenseClaimId: first.id }); await db.delete(periodLock).where(eq(periodLock.id, lock.id));
    const [tieredLock] = await db.insert(periodLock).values({ organizationId: a.id, lockDate: line.date, advisorLockDate: "2026-10-03" }).returning();
    await denied(() => create(request(input, keys.expenseOnly)), 422);
    const bypassed = (await data(await create(request(input)), 201)).expenseClaim;
    await data(await del(bypassed.id)); await db.delete(periodLock).where(eq(periodLock.id, tieredLock.id));
    const [year] = await db.insert(fiscalYear).values({ organizationId: a.id, name: "Closed", startDate: "2026-10-05", endDate: "2026-10-05", isClosed: true }).returning();
    await denied(() => patch(first.id, { items: [{ ...line, date: "2026-10-05" }] }), 422); await db.delete(fiscalYear).where(eq(fiscalYear.id, year.id));
    // SQL faults after header/line changes demonstrate full rollback, including audit.
    await db.execute(sql.raw("create function fail_expense_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type='expense' then raise exception 'fixture expense audit failure'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger fixture_expense_audit before insert on audit_log for each row execute function fail_expense_audit()"));
    await denied(() => create(request(input)), 500); await denied(() => patch(first.id, { items: [{ ...line, amountMinor: "1250" }] }), 500); await denied(() => del(first.id), 500);
    await mcpDenied("create_expense_claim", { ...input, items: [{ ...line, amount: 1250 }] });
    await mcpDenied("update_expense_claim", { expenseClaimId: first.id, title: "rollback" }); await mcpDenied("delete_expense_claim", { expenseClaimId: first.id });
    await db.execute(sql.raw("drop trigger fixture_expense_audit on audit_log; drop function fail_expense_audit()"));
    await db.execute(sql.raw("create function fail_expense_line() returns trigger language plpgsql as $$ begin raise exception 'fixture expense line failure'; end $$"));
    await db.execute(sql.raw("create trigger fixture_expense_line before insert on expense_item for each row execute function fail_expense_line()"));
    await denied(() => create(request(input)), 500); await denied(() => patch(first.id, { items: [line] }), 500);
    await db.execute(sql.raw("drop trigger fixture_expense_line on expense_item; drop function fail_expense_line()"));
    // Saved unsupported values fail during reads and before draft mutations.
    for (const changes of [{ totalAmount: "9007199254740992" }, { totalAmount: "-1" }, { totalAmount: "1251" }]) {
      await db.execute(sql`update expense_claim set total_amount=${changes.totalAmount}::bigint where id=${first.id}`);
      await denied(() => getOne(first.id), 422); await denied(() => list(read()), 422); await denied(() => patch(first.id, { title: "bad" }), 422); await denied(() => del(first.id), 422);
      await mcpDenied("get_expense_claim", { expenseClaimId: first.id });
    }
    await db.update(expenseClaim).set({ totalAmount: 1250 }).where(eq(expenseClaim.id, first.id));
    for (const extra of [{ accountId: foreignAccount.id }, { taxRateId: foreignTax.id }, { costCenterId: foreignCenter.id }, { receiptFileKey: foreignReceipt.fileKey }]) {
      await db.update(expenseItem).set(extra).where(eq(expenseItem.id, detail.items[0].id));
      await denied(() => getOne(first.id), 422); await denied(() => list(read()), 422); await denied(() => patch(first.id, { title: "foreign saved" }), 422);
      await db.update(expenseItem).set({ accountId: account.id, taxRateId: tax.id, costCenterId: center.id, receiptFileKey: receipt.fileKey }).where(eq(expenseItem.id, detail.items[0].id));
    }
    for (const column of ["amount", "mileage_rate"]) {
      await db.execute(sql.raw(`update expense_item set ${column}='9007199254740992'::bigint where id='${detail.items[0].id}'`));
      await denied(() => getOne(first.id), 422); await denied(() => patch(first.id, { title: "unsafe line" }), 422);
      await mcpDenied("get_expense_claim", { expenseClaimId: first.id });
      await db.update(expenseItem).set({ amount: 1250, mileageRate: null }).where(eq(expenseItem.id, detail.items[0].id));
    }
    await db.update(expenseClaim).set({ approvedBy: outsider.id }).where(eq(expenseClaim.id, first.id)); await denied(() => getOne(first.id), 422);
    await db.update(expenseClaim).set({ approvedBy: null }).where(eq(expenseClaim.id, first.id));
    await db.update(expenseClaim).set({ submittedBy: outsider.id }).where(eq(expenseClaim.id, first.id)); await denied(() => getOne(first.id), 422);
    await db.update(expenseClaim).set({ submittedBy: owner.id }).where(eq(expenseClaim.id, first.id));
    assert.equal("passwordHash" in (await data(await getOne(first.id))).expenseClaim.submittedByUser, false);
    const [foreignJournal] = await db.insert(journalEntry).values({ organizationId: b.id, entryNumber: 1, date: line.date, description: "Foreign" }).returning();
    await db.update(expenseClaim).set({ journalEntryId: foreignJournal.id }).where(eq(expenseClaim.id, first.id)); await denied(() => getOne(first.id), 422);
    await denied(() => del(first.id), 400); await db.update(expenseClaim).set({ journalEntryId: null }).where(eq(expenseClaim.id, first.id));
    // Concurrent edit/delete returns one serialized result, never leaves orphan/replacement lines.
    const race = (await data(await create(request(input)), 201)).expenseClaim;
    const results = await Promise.all([patch(race.id, { items: [{ ...line, amount: 1 }] }), ma.call("delete_expense_claim", { expenseClaimId: race.id })]);
    assert.ok([200, 404].includes(results[0].status)); assert.equal(results[1].isError, false);
    assert.equal((await db.select().from(expenseItem).where(eq(expenseItem.expenseClaimId, race.id))).length, 0);
    await data(await del(first.id)); assert.equal((await ma.call("delete_expense_claim", { expenseClaimId: mileage.id })).body.success, true);
    await denied(() => getOne(first.id), 404); await denied(() => del(first.id), 404);
    assert.deepEqual((await data(await counts(read()))), { counts: {}, total: 0 });
    // Organization-default and zero/three-decimal currencies; exact clients never rescale historic minor units.
    for (const [currencyCode, amountExact] of [["JPY", "1250"], ["KWD", "1.250"], ["IRR", "1250"]]) {
      await db.update(organization).set({ defaultCurrency: currencyCode }).where(eq(organization.id, a.id));
      const claim = (await data(await create(request({ title: "Currency", items: [{ date: line.date, description: "Exact", amountExact, amountMinor: "1250" }] })), 201)).expenseClaim;
      assert.equal(claim.currencyCode, currencyCode); assert.equal(claim.totalAmount, 1250);
      assert.equal((await data(await counts(read()))).counts.draft.currencyCode, currencyCode);
      await data(await patch(claim.id, { title: "Retain currency" })); await data(await del(claim.id));
    }
    await db.update(organization).set({ defaultCurrency: "USD" }).where(eq(organization.id, a.id));
    const max = (await ma.call("create_expense_claim", { title: "Max", items: [{ date: line.date, description: "Safe", amountMinor: "9007199254740991" }] })).body.expenseClaim;
    assert.equal(max.totalAmount, Number.MAX_SAFE_INTEGER); assert.equal((await data(await getOne(max.id))).expenseClaim.items[0].amountMinor, "9007199254740991");
    assert.equal((await data(await counts(read()))).counts.draft.amountMinor, "9007199254740991");
    const one = (await data(await create(request({ title: "One", items: [{ date: line.date, description: "one", amountMinor: "1" }] })), 201)).expenseClaim;
    await denied(() => counts(read()), 422); await mcpDenied("get_expense_claim_counts"); await data(await del(one.id));
    await db.execute(sql`update expense_claim set total_amount='9007199254740992'::bigint where id=${max.id}`); await denied(() => counts(read()), 422);
    await db.update(expenseClaim).set({ totalAmount: Number.MAX_SAFE_INTEGER }).where(eq(expenseClaim.id, max.id));
    const euro = (await data(await create(request({ title: "Euro", currencyCode: "EUR", items: [{ date: line.date, description: "Euro", amountMinor: "1" }] })), 201)).expenseClaim;
    await denied(() => counts(read()), 422); await mcpDenied("get_expense_claim_counts");
    await data(await del(euro.id)); await data(await del(max.id));
    const zero = (await ma.call("create_expense_claim", { title: "Zero", items: [{ date: line.date, description: "Zero", amountMinor: "0" }] })).body.expenseClaim;
    assert.equal(zero.totalAmount, 0); await data(await del(zero.id));
    assert.equal((await db.select().from(journalEntry).where(eq(journalEntry.organizationId, a.id))).length, 0);
    const audits = (await db.execute(sql`select count(*)::int as count from audit_log where entity_type='expense'`)).rows[0]; assert.ok(Number(audits.count) > 10);
    console.log("REST and MCP expense CRUD verified");
  } finally { await ma.close(); await mb.close(); await readOnly.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
