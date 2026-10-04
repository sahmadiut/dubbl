import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, bankAccount, bankTransaction, bankRule, chartAccount, journalEntry, journalLine, contact, taxRate,
  periodLock, payment, paymentAllocation, invoice, bill } from "../../lib/db/schema";
import { GET as list, POST as create } from "../../app/api/v1/bank-rules/route";
import { GET as detail, PATCH as update, DELETE as remove } from "../../app/api/v1/bank-rules/[id]/route";
import { POST as apply } from "../../app/api/v1/bank-accounts/[id]/apply-rules/route";
import { GET as suggest } from "../../app/api/v1/bank-rules/suggestions/route";
import { applyBankRules, createBankRule, updateBankRule, deleteBankRule } from "../../lib/api/bank-rules";
import { autoReconcileBankTransactions } from "../../lib/api/bank-auto-reconcile";
import { unreconcileBankTransaction } from "../../lib/api/bank-reconciliations";
import { categorizeBankTransaction } from "../../lib/api/bank-categorization";
import { createInvoice } from "../../lib/api/invoice-writes";
import { sendInvoice } from "../../lib/api/invoice-lifecycle";
import { createBill } from "../../lib/api/bill-writes";
import { receiveBill } from "../../lib/api/bill-lifecycle";
import { createSettlementPayment } from "../../lib/api/payment-settlements";
import { registerBankRuleTools } from "../../lib/mcp/tools/bank-rules";
import type { AuthContext } from "../../lib/api/auth-context";
async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Rule fixture", version: "1" }); registerBankRuleTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools; assert.equal(tools.length, 8);
  for (const tool of tools) { assert.equal(tool.inputSchema.additionalProperties, false); for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description); }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a,b] = await db.insert(organization).values([{ name: "Rules A", slug: "rules-a" }, { name: "Rules B", slug: "rules-b" }]).returning();
  const [owner, viewer, banker, manager] = await db.insert(users).values([{ email: "rules-owner@example.test" }, { email: "rules-view@example.test" }, { email: "rules-bank@example.test" }, { email: "rules-manage@example.test" }]).returning();
  const roles = await db.insert(customRole).values([{ organizationId: a.id, name: "View", permissions: [] }, { organizationId: a.id, name: "Bank", permissions: ["manage:banking"] }, { organizationId: a.id, name: "Rules", permissions: ["manage:bank-rules"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: roles[0].id }, { organizationId: a.id, userId: banker.id, customRoleId: roles[1].id }, { organizationId: a.id, userId: manager.id, customRoleId: roles[2].id }]);
  const keys = { a: "dk_rules_a", b: "dk_rules_b", viewer: "dk_rules_view", banker: "dk_rules_bank", manager: "dk_rules_manage", expired: "dk_rules_expired" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "banker" ? banker.id : label === "manager" ? manager.id : owner.id,
    name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_rules", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" }, ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }),
    ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] }), mk = await mcp({ ...ctx, userId: banker.id, role: "member", permissions: ["manage:banking"] });
  const req = (body: unknown = {}, key = keys.a, query = "") => new Request(`http://fixture.test/api/v1/bank-rules${query}`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 200) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const tables = ["bank_rule", "bank_account", "bank_transaction", "chart_account", "journal_entry", "journal_line", "payment", "payment_allocation", "invoice", "bill"];
  const snapshot = async () => [...await Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows))),
    (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mcpDenied = async (name: string, args: Record<string, unknown>, client = ma) => { const before = await snapshot(); assert.equal((await client.call(name, args)).isError, true); assert.deepEqual(await snapshot(), before); };
  const rejected = async (fn: () => Promise<unknown>) => { const before = await snapshot(); await assert.rejects(fn); assert.deepEqual(await snapshot(), before); };
  const [revenue, expense, foreignGl] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "4000", name: "Revenue", type: "revenue" }, { organizationId: a.id, code: "5000", name: "Expense", type: "expense" }, { organizationId: b.id, code: "4000", name: "Foreign", type: "revenue" }]).returning();
  const [party, foreignParty] = await db.insert(contact).values([{ organizationId: a.id, name: "Party", type: "both" }, { organizationId: b.id, name: "Foreign", type: "both" }]).returning();
  const [tax, foreignTax] = await db.insert(taxRate).values([{ organizationId: a.id, name: "Tax", rate: 1000, type: "both" }, { organizationId: b.id, name: "Foreign tax", rate: 1000, type: "both" }]).returning();
  await db.insert(chartAccount).values([{ organizationId: a.id, code: "1200", name: "AR", type: "asset" }, { organizationId: a.id, code: "2100", name: "AP", type: "liability" }]);
  let code = 1110;
  const bank = async (org = a.id, currencyCode = "USD") => {
    const [gl] = await db.insert(chartAccount).values({ organizationId: org, code: String(code++), name: "Synthetic bank GL", type: "asset", currencyCode }).returning();
    return (await db.insert(bankAccount).values({ organizationId: org, accountName: "Synthetic bank", currencyCode, balance: 2500, chartAccountId: gl.id }).returning())[0];
  };
  const movement = async (parent: string, amount = 1250, extra = {}) => (await db.insert(bankTransaction).values({ bankAccountId: parent, amount, date: "2026-10-04", description: "Fixture", reference: "FIX", balance: 2500, ...extra }).returning())[0];
  const rowById = async (id: string) => (await db.select().from(bankTransaction).where(eq(bankTransaction.id, id)))[0];
  const rule = (extra = {}) => ({ name: "Fixture", matchField: "description", matchType: "contains", matchValue: "fixture", accountId: revenue.id, ...extra });
  const journal = async (parent: typeof bankAccount.$inferSelect, amount = 1250, extra = {}) => {
    const [max] = await db.select({ n: sql<number>`coalesce(max(entry_number),0)::int` }).from(journalEntry).where(eq(journalEntry.organizationId, parent.organizationId));
    const [entry] = await db.insert(journalEntry).values({ organizationId: parent.organizationId, entryNumber: max.n + 1, date: "2026-10-04", description: "Fixture", reference: "FIX", status: "posted", sourceType: "manual", ...extra }).returning();
    await db.insert(journalLine).values([{ accountId: parent.chartAccountId!, debitAmount: amount > 0 ? amount : 0, creditAmount: amount < 0 ? -amount : 0 }, { accountId: revenue.id, debitAmount: amount < 0 ? -amount : 0, creditAmount: amount > 0 ? amount : 0 }]
      .map(l => ({ ...l, journalEntryId: entry.id, currencyCode: parent.currencyCode, exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base", rateFormatVersion: 1, rateMigrationStatus: "exact" })));
    return entry;
  };
  try {
    const main = await bank(), foreign = await bank(b.id), fresh = await movement(main.id), ownRule = (await data(await create(req(rule())), 201)).bankRule;
    const malformed=()=>new Request("http://fixture.test/api/v1/bank-rules",{method:"POST",headers:{authorization:`Bearer ${keys.a}`,"content-type":"application/json"},body:"{"});
    await denied(()=>create(malformed()),400); await denied(()=>update(malformed(),params(ownRule.id)),400);
    for (const key of [keys.viewer, keys.banker, keys.expired, "dk_invalid"]) await denied(() => create(req(rule(), key)), [keys.viewer,keys.banker].includes(key) ? 403 : 401);
    for (const key of [keys.expired,"dk_invalid"]) { await denied(()=>list(req({},key)),401); await denied(()=>suggest(req({},key)),401); }
    assert.equal((await data(await list(req({},keys.viewer)))).pagination.total,1);
    for (const route of [detail,update,remove]) await denied(() => route(req({}, keys.b), params(ownRule.id)), 404);
    await denied(() => apply(req({}, keys.b), params(main.id)), 404); await denied(() => apply(req({}, keys.manager), params(main.id)), 403);
    for (const extra of [{ accountId: foreignGl.id }, { contactId: foreignParty.id }, { taxRateId: foreignTax.id }, { splitAllocations: [{ accountId: foreignGl.id }] }, { splitAllocations: [{ accountId: expense.id, taxRateId: foreignTax.id }] }])
      await denied(() => create(req(rule(extra))), 404);
    for (const extra of [{ splitAllocations: [{ accountId: expense.id, amount: 1, amountMinor: "2" }] }, { conditions: [{ field: "amount", op: "equals", value: "1x" }] }, { unknown: true }, { priority: 2147483648 }, { splitAllocations: [{ accountId: expense.id, amount: -1 }] }])
      await denied(() => create(req(rule(extra))), 400);
    await denied(() => create(req(rule({ splitAllocations: [{ accountId: expense.id, amountMinor: "9007199254740992" }] }))), 422);
    await denied(() => create(req(rule({ conditions: [{ field: "amount", op: "gt", value: "9007199254740992" }] }))), 422);
    const legacy = await data(await detail(req(), params(ownRule.id))); assert.equal(legacy.bankRule.matchValue, "fixture");
    const exact = await ma.call("create_bank_rule", rule({ name: "Split", priority: 50, conditions: [{ field: "amount", op: "equals", value: "-1250" }],
      splitAllocations: [{ accountId: expense.id, amountMinor: "250", taxRateId: tax.id }, { accountId: expense.id }], contactId: party.id, autoReconcile: false }));
    assert.equal(exact.isError, false); assert.equal(exact.body.rule.splitAllocations[0].amountMinor, "250");
    const listed = await data(await list(req({}, keys.a, "?limit=100"))); assert.equal(listed.pagination.total, 2); assert.equal(listed.data[0].name, "Split");
    const ml = await ma.call("list_bank_rules", {}); assert.equal(ml.body.rules[0].splitAllocations[0].amount, 250);
    assert.equal((await ma.call("get_bank_rule", { ruleId: exact.body.rule.id })).body.rule.splitAllocations[0].amountMinor, "250");
    await denied(() => list(req({}, keys.a, "?page=1x")), 400); await denied(() => list(req({}, keys.a, "?isActive=wrong")), 400);
    await denied(() => update(req({ conditions: [], matchValue: "" }), params(exact.body.rule.id)), 400);
    for (const [name,args] of [["get_bank_rule",{ruleId:ownRule.id}],["update_bank_rule",{ruleId:ownRule.id,name:"Changed"}],["delete_bank_rule",{ruleId:ownRule.id}],
      ["apply_bank_rules",{bankAccountId:main.id}],["auto_reconcile_bank_transactions",{bankAccountId:main.id}]] as const) await mcpDenied(name,args,mb);
    for (const [name,args] of [["create_bank_rule",rule()],["update_bank_rule",{ruleId:ownRule.id,name:"Changed"}],["delete_bank_rule",{ruleId:ownRule.id}],
      ["apply_bank_rules",{bankAccountId:main.id}],["auto_reconcile_bank_transactions",{bankAccountId:main.id}]] as const) { await mcpDenied(name,args,ro); await mcpDenied(name,{...args,unknown:1}); }
    const negative = await movement(main.id,-1250), excluded = await movement(main.id,1250,{status:"excluded"}), foreignRow = await movement(foreign.id);
    const zero=await movement(main.id,0), pending=await movement(main.id,1250,{pending:true});
    const beforePreview = await snapshot(), preview = await ma.call("apply_bank_rules",{bankAccountId:main.id,dryRun:true}); assert.equal(preview.isError,false); assert.equal(preview.body.matched,2); assert.deepEqual(await snapshot(),beforePreview);
    const result = await data(await apply(req({},keys.banker),params(main.id))); assert.equal(result.applied,2); assert.equal(result.split,1); assert.equal(result.reconciled,1);
    assert.equal((await rowById(fresh.id)).status,"unreconciled"); assert.equal((await rowById(excluded.id)).status,"excluded"); assert.equal((await rowById(foreignRow.id)).accountId,null);
    assert.equal((await rowById(zero.id)).accountId,null); assert.equal((await rowById(pending.id)).accountId,null);
    const splitRow = await rowById(negative.id); assert.ok(splitRow.journalEntryId); assert.equal(splitRow.contactId,party.id);
    const splitLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId,splitRow.journalEntryId!));
    assert.equal(splitLines.reduce((s,l)=>s+BigInt(l.debitAmount),0n),1250n); assert.equal(splitLines.reduce((s,l)=>s+BigInt(l.creditAmount),0n),1250n); assert.ok(splitLines.every(l=>l.rateExact==="1"));
    assert.equal((await data(await apply(req(),params(main.id)))).applied,0);
    await unreconcileBankTransaction(ctx,negative.id); assert.equal((await rowById(negative.id)).status,"unreconciled");
    const suggestions = await ma.call("get_bank_rule_suggestions",{}); assert.equal(suggestions.isError,false); assert.ok(suggestions.body.suggestions.some((s:{accountId:string})=>s.accountId===revenue.id));
    await movement(main.id,1250,{accountId:revenue.id});
    const restSuggestions=await data(await suggest(req())); assert.ok(restSuggestions.suggestions.some((s:{accountId:string;occurrences:number})=>s.accountId===revenue.id&&s.occurrences>=2));
    const keywordMcp=await ma.call("get_bank_rule_suggestions",{style:"keywords",limit:20}); assert.deepEqual(keywordMcp.body,restSuggestions);
    assert.deepEqual((await data(await suggest(req({},keys.b)))).suggestions,[]);
    // No defaults in a partial patch: preserved priority, splits and legacy fields.
    const patched = await data(await update(req({name:"Renamed split"}),params(exact.body.rule.id))); assert.equal(patched.bankRule.priority,50); assert.equal(patched.bankRule.splitAllocations[0].amountMinor,"250");
    await data(await remove(req(),params(exact.body.rule.id))); await denied(()=>detail(req(),params(exact.body.rule.id)),404);
    const single = await updateBankRule(ctx,ownRule.id,{autoReconcile:true}); assert.equal(single.autoReconcile,true);
    // Large numeric compatibility, one journal per concurrent apply, and exact undo.
    const raceBank = await bank(), raceRow = await movement(raceBank.id,3000000000);
    const race = await Promise.all([apply(req(),params(raceBank.id)),apply(req(),params(raceBank.id))]); const raceBodies = await Promise.all(race.map(r=>data(r)));
    assert.deepEqual(raceBodies.map(r=>r.applied).sort(),[0,1]);
    const posted = await rowById(raceRow.id); assert.equal(posted.status,"reconciled");
    const postedLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId,posted.journalEntryId!)); assert.equal(postedLines[0].debitAmount + postedLines[0].creditAmount,3000000000);
    await unreconcileBankTransaction(ctx,raceRow.id); assert.ok((await db.select().from(journalEntry).where(eq(journalEntry.id,posted.journalEntryId!)))[0].reversedByEntryId);
    // Invalid saved JSON/ranges and tenant references reject before any financial write.
    await db.update(bankRule).set({splitAllocations:[{accountId:revenue.id,amount:9007199254740992}]}).where(eq(bankRule.id,ownRule.id));
    await denied(()=>apply(req(),params(main.id)),422); await denied(()=>detail(req(),params(ownRule.id)),422); await mcpDenied("list_bank_rules",{});
    await denied(()=>remove(req(),params(ownRule.id)),422);
    await db.update(bankRule).set({splitAllocations:null,accountId:foreignGl.id}).where(eq(bankRule.id,ownRule.id)); await denied(()=>apply(req(),params(main.id)),422);
    await db.update(bankRule).set({accountId:revenue.id}).where(eq(bankRule.id,ownRule.id));
    const corruptBank=await bank(); await movement(corruptBank.id); await db.update(bankAccount).set({chartAccountId:foreignGl.id}).where(eq(bankAccount.id,corruptBank.id));
    await denied(()=>apply(req(),params(corruptBank.id)),422);
    const corruptRow=await movement(main.id,1250,{contactId:foreignParty.id}); await denied(()=>apply(req(),params(main.id)),422); await db.delete(bankTransaction).where(eq(bankTransaction.id,corruptRow.id));
    const unsafe = await movement(main.id); await db.execute(sql`update bank_transaction set amount=9007199254740992 where id=${unsafe.id}`); await denied(()=>apply(req(),params(main.id)),422); await db.delete(bankTransaction).where(eq(bankTransaction.id,unsafe.id));
    const lockedBank = await bank(); await movement(lockedBank.id,1250,{date:"2026-10-02"});
    await db.insert(periodLock).values({organizationId:a.id,lockDate:"2026-10-03",advisorLockDate:"2026-10-03"}); await denied(()=>apply(req(),params(lockedBank.id)),422); await db.delete(periodLock).where(eq(periodLock.organizationId,a.id));
    // Atomic audit fault rolls back journal, state and rule create/update/delete.
    await db.execute(sql`create function fail_rule_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type <> 'api_key' then raise exception 'Synthetic audit failure'; end if; return NEW; end $$`);
    await db.execute(sql`create trigger fail_rule_audit before insert on audit_log for each row execute function fail_rule_audit()`);
    const auditBank = await bank(); await movement(auditBank.id);
    await denied(()=>apply(req(),params(auditBank.id)),500); await denied(()=>create(req(rule())),500); await denied(()=>update(req({name:"Fail"}),params(ownRule.id)),500); await denied(()=>remove(req(),params(ownRule.id)),500);
    await db.execute(sql`drop trigger fail_rule_audit on audit_log`); await db.execute(sql`drop function fail_rule_audit()`);
    await deleteBankRule(ctx,ownRule.id);
    const maxRule=await createBankRule(ctx,rule({conditions:[{field:"amount",op:"equals",value:String(Number.MAX_SAFE_INTEGER)}],splitAllocations:[{accountId:revenue.id,percent:50},{accountId:revenue.id}]}));
    const maxBank=await bank(), maxRow=await movement(maxBank.id,Number.MAX_SAFE_INTEGER);
    assert.equal((await mk.call("apply_bank_rules",{bankAccountId:maxBank.id})).body.split,1);
    const maxLines=await db.select().from(journalLine).where(eq(journalLine.journalEntryId,(await rowById(maxRow.id)).journalEntryId!)); assert.equal(maxLines.reduce((s,l)=>s+BigInt(l.debitAmount),0n),BigInt(Number.MAX_SAFE_INTEGER));
    await deleteBankRule(ctx,maxRule.id);
    // Currency scales remain independent: identical 1250 conditions/amounts across currencies.
    for (const currencyCode of ["USD","JPY","KWD","IRR"]) {
      const [org] = await db.insert(organization).values({name:`Currency ${currencyCode}`,slug:`rules-${currencyCode}`,defaultCurrency:currencyCode}).returning();
      const cctx={...ctx,organizationId:org.id}; const parent=await bank(org.id,currencyCode);
      const [gl]=await db.insert(chartAccount).values({organizationId:org.id,code:"4000",name:"Category",type:"revenue",currencyCode}).returning();
      await createBankRule(cctx,{name:"Scale",conditions:[{field:"amount",op:"equals",value:"1250"}],splitAllocations:[{accountId:gl.id,amountMinor:"250"},{accountId:gl.id}]});
      const row=await movement(parent.id); const applied=await applyBankRules(cctx,{bankAccountId:parent.id}); assert.equal(applied.split,1);
      const lines=await db.select().from(journalLine).where(eq(journalLine.journalEntryId,(await rowById(row.id)).journalEntryId!)); assert.equal(lines.reduce((s,l)=>s+BigInt(l.debitAmount),0n),1250n); assert.ok(lines.every(l=>l.currencyCode===currencyCode));
    }
    // Auto matching must use one bank GL, exact signed amount, and qualified existing history.
    const autoBank=await bank(), otherBank=await bank(), autoRow=await movement(autoBank.id), autoEntry=await journal(autoBank), wrongBankEntry=await journal(otherBank);
    const beforeAuto=await snapshot(); await mcpDenied("auto_reconcile_bank_transactions",{bankAccountId:autoBank.id},ro); assert.deepEqual(await snapshot(),beforeAuto);
    const autoRace=await Promise.all([ma.call("auto_reconcile_bank_transactions",{bankAccountId:autoBank.id}),mk.call("auto_reconcile_bank_transactions",{bankAccountId:autoBank.id})]); assert.ok(autoRace.every(r=>!r.isError)); assert.equal(autoRace.reduce((s,r)=>s+r.body.reconciled,0),1);
    assert.equal((await rowById(autoRow.id)).journalEntryId,autoEntry.id); assert.notEqual((await rowById(autoRow.id)).journalEntryId,wrongBankEntry.id); await unreconcileBankTransaction(ctx,autoRow.id);
    assert.equal((await db.select().from(journalEntry).where(eq(journalEntry.id,autoEntry.id)))[0].reversedByEntryId,null);
    await db.update(bankTransaction).set({status:"excluded"}).where(eq(bankTransaction.id,autoRow.id));
    const noMatchBank=await bank(); await movement(noMatchBank.id,-1250); await journal(noMatchBank,1250); await journal(noMatchBank,-1251);
    assert.equal((await autoReconcileBankTransactions(ctx,{bankAccountId:noMatchBank.id,confidenceThreshold:70})).reconciled,0);
    const tiedBank=await bank(); await movement(tiedBank.id); await journal(tiedBank); await journal(tiedBank); assert.equal((await autoReconcileBankTransactions(ctx,{bankAccountId:tiedBank.id})).reconciled,0);
    const wrongCurrency=await bank(a.id,"EUR"); await movement(wrongCurrency.id); await journal(wrongCurrency); assert.equal((await autoReconcileBankTransactions(ctx,{bankAccountId:wrongCurrency.id})).reconciled,0);
    const autoPendingBank=await bank(); await movement(autoPendingBank.id,1250,{pending:true}); await journal(autoPendingBank); assert.equal((await autoReconcileBankTransactions(ctx,{bankAccountId:autoPendingBank.id})).reconciled,0);
    // Existing received/made cash uses payment links; no new payment or recognition.
    for (const kind of ["invoice","bill"] as const) {
      const parent=await bank(), input={contactId:party.id,issueDate:"2026-10-01",dueDate:"2026-10-31",lines:[{description:"Fixture",unitPriceMinor:"1250",accountId:kind==="invoice"?revenue.id:expense.id}]};
      const doc=kind==="invoice"?(await sendInvoice(ctx,(await createInvoice(ctx,input,"rest")).invoice.id)).invoice:(await receiveBill(ctx,(await createBill(ctx,input,"rest")).bill.id)).bill;
      const pay=await createSettlementPayment(ctx,{contactId:party.id,type:kind==="invoice"?"received":"made",date:"2026-10-04",bankAccountId:parent.id,amountMinor:"1250",reference:"FIX",allocations:[{documentType:kind,documentId:doc.id,amountMinor:"1250"}]});
      const payId=(pay.payment as {id:string}).id;
      const cash=(await db.select().from(payment).where(eq(payment.id,payId)))[0], saved=(await db.select().from(journalEntry).where(eq(journalEntry.id,cash.journalEntryId!)))[0];
      const row=await movement(parent.id,kind==="invoice"?1250:-1250,{description:saved.description!,reference:saved.reference});
      const table=kind==="invoice"?invoice:bill, beforeDoc=(await db.select().from(table).where(eq(table.id,doc.id)))[0];
      const result=await ma.call("auto_reconcile_bank_transactions",{bankAccountId:parent.id}); assert.equal(result.isError,false,JSON.stringify(result)); assert.equal(result.body.reconciled,1);
      assert.equal((await db.select().from(payment).where(eq(payment.id,payId)))[0].bankTransactionId,row.id); assert.deepEqual((await db.select().from(table).where(eq(table.id,doc.id)))[0],beforeDoc);
      assert.equal((await db.select().from(paymentAllocation).where(eq(paymentAllocation.paymentId,payId))).length,1); await unreconcileBankTransaction(ctx,row.id);
      assert.equal((await db.select().from(payment).where(eq(payment.id,payId)))[0].deletedAt,null);
    }
    // Manual categorization vs rule apply shares the same lock and creates one journal.
    const cr=await createBankRule(ctx,rule({autoReconcile:true})), cp=await bank(), cm=await movement(cp.id);
    const concurrent=await Promise.allSettled([applyBankRules(ctx,{bankAccountId:cp.id}),categorizeBankTransaction(ctx,cm.id,{accountId:revenue.id},undefined,false)]);
    assert.ok(concurrent.some(r=>r.status==="fulfilled")); const entries=await db.select().from(journalEntry).where(and(eq(journalEntry.sourceId,cm.id),eq(journalEntry.status,"posted"))); assert.equal(entries.length,1);
    await deleteBankRule(ctx,cr.id);
    // Saved inconsistent FX and audit faults cannot link automatic cash.
    const badBank=await bank(), badRow=await movement(badBank.id), badEntry=await journal(badBank);
    await db.update(journalLine).set({rateExact:"2",exchangeRate:2000000}).where(eq(journalLine.journalEntryId,badEntry.id)); await rejected(()=>autoReconcileBankTransactions(ctx,{bankAccountId:badBank.id}));
    await db.update(journalLine).set({rateExact:"1",exchangeRate:1000000}).where(eq(journalLine.journalEntryId,badEntry.id));
    await db.execute(sql`create function fail_auto_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit failure'; end $$`); await db.execute(sql`create trigger fail_auto_audit before insert on audit_log for each row execute function fail_auto_audit()`);
    await rejected(()=>autoReconcileBankTransactions(ctx,{bankAccountId:badBank.id})); assert.equal((await rowById(badRow.id)).journalEntryId,null);
    await db.execute(sql`drop trigger fail_auto_audit on audit_log`); await db.execute(sql`drop function fail_auto_audit()`);
    console.log("REST and MCP bank rules verified");
  } finally { await Promise.all([ma.close(),mb.close(),ro.close(),mk.close()]); }
}
run().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
