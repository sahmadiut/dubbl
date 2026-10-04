import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, subscription, apiKey, customRole, bankAccount, bankTransaction, chartAccount,
  journalEntry, journalLine, taxRate, taxComponent, contact, costCenter, project, exchangeRate, periodLock, fiscalYear, payment, expenseClaim } from "../../lib/db/schema";
import { POST as categorize } from "../../app/api/v1/bank-transactions/[id]/categorize/route";
import { POST as split } from "../../app/api/v1/bank-transactions/[id]/split-account/route";
import { POST as expense } from "../../app/api/v1/bank-transactions/[id]/create-expense/route";
import { POST as bulk } from "../../app/api/v1/bulk/bank-transactions/categorize/route";
import { POST as approveExpense } from "../../app/api/v1/expenses/[id]/approve/route";
import { registerBankCategorizationTools } from "../../lib/mcp/tools/bank-categorization";
import { registerBankTransactionTools } from "../../lib/mcp/tools/bank-transactions";
import { registerBulkTools } from "../../lib/mcp/tools/bulk";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Bank coding fixture", version: "1" });
  registerBankCategorizationTools(server, ctx); registerBankTransactionTools(server, ctx); registerBulkTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools, names = tools.map(t => t.name);
  assert.equal(names.length, new Set(names).size);
  for (const name of ["categorize_bank_transaction", "split_bank_transaction", "create_expense_from_bank_transaction", "bulk_categorize_bank_transactions", "bulk_cash_code"]) {
    const tool = tools.find(t => t.name === name); assert.ok(tool);
    assert.equal(tool.inputSchema.additionalProperties, false);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  }
  return { async call(name: string, args: Record<string, unknown>) { const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } }; },
    async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [a,b] = await db.insert(organization).values([{ name: "Coding A", slug: "coding-a" }, { name: "Coding B", slug: "coding-b" }]).returning();
  const [owner,viewer,expenseUser] = await db.insert(users).values([{ email: "coding-owner@example.test" }, { email: "coding-viewer@example.test" }, { email: "coding-expense@example.test" }]).returning();
  const [viewRole, expenseRole] = await db.insert(customRole).values([{ organizationId: a.id, name: "View", permissions: [] }, { organizationId: a.id, name: "Expense", permissions: ["manage:expenses"] }]).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" },
    { organizationId: a.id, userId: viewer.id, customRoleId: viewRole.id }, { organizationId: a.id, userId: expenseUser.id, customRoleId: expenseRole.id }]);
  await db.insert(subscription).values([{ organizationId: a.id, plan: "pro" }, { organizationId: b.id, plan: "pro" }]);
  const keys = { a: "dk_coding_a", b: "dk_coding_b", viewer: "dk_coding_viewer", expense: "dk_coding_expense", expired: "dk_coding_expired" };
  for (const [label,key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "viewer" ? viewer.id : label === "expense" ? expenseUser.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"),
    keyPrefix: "dk_coding", expiresAt: label === "expired" ? new Date("2020-01-01") : null });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), ro = await mcp({ ...ctx, userId: viewer.id, role: "member", permissions: [] });
  const me = await mcp({ ...ctx, userId: expenseUser.id, role: "member", permissions: ["manage:expenses"] });
  const req = (body: unknown = {}, key = keys.a) => new Request("http://fixture.test/api/v1/bank-transactions", { method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id }, body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 201) => { const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body; };
  const tables = ["bank_account", "bank_transaction", "chart_account", "journal_entry", "journal_line", "expense_claim", "expense_item"];
  const snapshot = async () => [...await Promise.all(tables.map(t => db.execute(sql.raw(`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${t} t`)).then(r => r.rows))),
    (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from audit_log t where entity_type <> 'api_key'`)).rows];
  const denied = async (fn: () => Promise<Response>, status: number) => { const before = await snapshot(); await data(await fn(), status); assert.deepEqual(await snapshot(), before); };
  const mcpDenied = async (name: string, args: Record<string, unknown>, client = ma) => { const before = await snapshot(); assert.equal((await client.call(name,args)).isError,true); assert.deepEqual(await snapshot(), before); };
  const [target, second, income, foreign, inactive, deleted, thirdCurrency] = await db.insert(chartAccount).values([
    { organizationId: a.id, code: "5000", name: "Expense", type: "expense" }, { organizationId: a.id, code: "5100", name: "Other", type: "expense" },
    { organizationId: a.id, code: "4000", name: "Income", type: "revenue" }, { organizationId: b.id, code: "5000", name: "Foreign", type: "expense" },
    { organizationId: a.id, code: "5101", name: "Inactive", type: "expense", isActive: false },
    { organizationId: a.id, code: "5102", name: "Deleted", type: "expense", deletedAt: new Date() },
    { organizationId: a.id, code: "5103", name: "Third currency", type: "expense", currencyCode: "GBP" }]).returning();
  const newBank = async (currencyCode = "USD", org = a.id) => (await db.insert(bankAccount).values({ organizationId: org, accountName: "Synthetic bank", currencyCode, balance: 1250 }).returning())[0];
  const bank = await newBank(), foreignBank = await newBank("USD", b.id);
  const movement = async (amount = -1250, parent = bank.id, extra = {}) => (await db.insert(bankTransaction).values({ bankAccountId: parent, amount, description: "Synthetic movement", date: "2026-10-04", ...extra }).returning())[0];
  const code = { accountId: target.id };
  const expenseInput = (extra = {}) => ({ title: "Paid expense", items: [{ date: "2026-10-04", description: "Item", amount: 12.50, accountId: target.id }], ...extra });
  const expenseMcpInput = () => expenseInput({ items: [{ date: "2026-10-04", description: "Item", amount: 1250, amountMinor: "1250", amountExact: "12.50", accountId: target.id }] });
  const balanced = async (id: string, total?: number) => {
    const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId,id)); assert.ok(lines.length >= 2);
    const d = lines.reduce((s,l) => s + BigInt(l.debitAmount),0n), c = lines.reduce((s,l) => s + BigInt(l.creditAmount),0n);
    assert.equal(d,c); if (total !== undefined) assert.equal(d,BigInt(total));
    for (const l of lines) { assert.ok(l.debitAmount >= 0 && l.creditAmount >= 0); assert.equal(l.rateMigrationStatus,"exact"); assert.ok(l.rateExact); }
    return lines;
  };
  try {
    const fresh = await movement(), foreignRow = await movement(-1250,foreignBank.id);
    const routeInputs = [[categorize,code],[split,{ allocations: [{ ...code, amountMinor: "1250" }] }],[expense,expenseInput()]] as const;
    for (const [route,input] of routeInputs) {
      for (const key of [keys.b,"dk_invalid",keys.expired,keys.viewer]) await denied(async () => route(req(input,key),params(fresh.id)),key === keys.b ? 404 : key === keys.viewer ? 403 : 401);
      await denied(async () => route(req(input),params(foreignRow.id)),404); await denied(async () => route(req(input),params(randomUUID())),404);
      await denied(async () => route(req(input),params("bad")),400);
    }
    await denied(async () => bulk(req({ items: [{ transactionId: fresh.id,...code }] },keys.viewer)),403);
    for (const [name,args] of [["categorize_bank_transaction",{ transactionId: fresh.id,...code }], ["split_bank_transaction",{ transactionId: fresh.id,allocations: [{ ...code,amountMinor: "1250" }] }],
      ["create_expense_from_bank_transaction",{ transactionId: fresh.id,...expenseMcpInput() }]] as const) {
      await mcpDenied(name,args,mb); await mcpDenied(name,args,ro); await mcpDenied(name,{ ...args,unknown: 1 });
    }
    for (const name of ["bulk_categorize_bank_transactions","bulk_cash_code"]) await mcpDenied(name,name === "bulk_cash_code" ? { transactionIds: [fresh.id],...code } : { items: [{ transactionId: fresh.id,...code }] },ro);
    await denied(async () => categorize(req(code,keys.expense),params(fresh.id)),403);
    const first = await data(await categorize(req(code),params(fresh.id))); await balanced(first.journalEntryId,1250);
    const corrected = await ma.call("categorize_bank_transaction",{ transactionId: fresh.id,accountId: second.id,memo: "Correction" }); assert.equal(corrected.isError,false);
    assert.equal(corrected.body.transactionId,fresh.id); await balanced(corrected.body.journalEntryId,1250);
    assert.equal((await db.select().from(journalEntry).where(eq(journalEntry.id,first.journalEntryId)))[0].status,"void");
    assert.equal((await db.select().from(bankAccount).where(eq(bankAccount.id,bank.id)))[0].balance,1250);
    const [vat,partial,reverse,sales,purchase,blocked,exempt,us] = await db.insert(taxRate).values([
      { organizationId:a.id,name:"VAT",rate:2000 }, { organizationId:a.id,name:"Partial",rate:2000,kind:"partial_block",recoverablePercent:5000 },
      { organizationId:a.id,name:"Reverse",rate:2000,kind:"reverse_charge",recoverablePercent:5000 }, { organizationId:a.id,name:"Sales only",rate:2000,type:"sales" },
      { organizationId:a.id,name:"Purchase only",rate:2000,type:"purchase" }, { organizationId:a.id,name:"Blocked",rate:2000,kind:"blocked" },
      { organizationId:a.id,name:"Exempt",rate:2000,kind:"exempt" }, { organizationId:a.id,name:"US",rate:2000,kind:"sales_tax_us" }]).returning();
    for (const [tax,amount,total,parts] of [[vat,-1200,1200,[1000,200]],[partial,-1200,1200,[1100,100]],[reverse,-1000,1200,[1100,100]],
      [blocked,-1200,1200,[1200]],[exempt,-1200,1200,[1200]],[us,-1200,1200,[1200]],[vat,1200,1200,[1000,200]],[us,1200,1200,[1000,200]]] as const) {
      const row = await movement(amount), entry = await data(await categorize(req({ accountId: amount > 0 ? income.id : target.id,taxRateId: tax.id }),params(row.id)));
      const lines = await balanced(entry.journalEntryId,total);
      assert.deepEqual(lines.filter(l => amount < 0 ? l.debitAmount > 0 : l.creditAmount > 0).map(l => amount < 0 ? l.debitAmount : l.creditAmount).sort((x,y) => x-y),[...parts].sort((x,y) => x-y));
    }
    const splitRow = await movement(-2200), splitResult = await data(await split(req({ allocations: [{ ...code,amount:1200,amountMinor:"1200",taxRateId:vat.id },{ accountId:second.id,amountMinor:"1000",taxRateId:reverse.id }] }),params(splitRow.id)));
    await balanced(splitResult.journalEntryId,2400); await denied(async () => split(req({ allocations:[{...code,amount:2200}] }),params(splitRow.id)),400);
    const mcpSplit = await movement(1250); assert.equal((await ma.call("split_bank_transaction",{transactionId:mcpSplit.id,allocations:[{ accountId:income.id,amountMinor:"1250" }] })).isError,false);
    for (const body of [{allocations:[{...code,amountMinor:"1251"}]},{allocations:[{...code,amount:1250,amountMinor:"1251"}]},{allocations:[{...code,amountMinor:"0"}]},{allocations:[{...code,amountMinor:"01"}]}]) {
      const row=await movement(); await denied(async () => split(req(body),params(row.id)),400); await mcpDenied("split_bank_transaction",{transactionId:row.id,...body});
    }
    const rangeRow=await movement(); await denied(async () => split(req({allocations:[{...code,amountMinor:"9007199254740992"}]}),params(rangeRow.id)),422);
    await denied(async () => split(req({allocations:[{...code,amountMinor:"9007199254740991"},{...code,amountMinor:"1"}]}),params(rangeRow.id)),422);
    for (const targetId of [foreign.id,inactive.id,deleted.id,thirdCurrency.id]) {
      const row=await movement(); await denied(async () => categorize(req({accountId:targetId}),params(row.id)),targetId === foreign.id ? 404 : targetId === thirdCurrency.id ? 422 : 400);
      await mcpDenied("categorize_bank_transaction",{transactionId:row.id,accountId:targetId});
    }
    const [foreignContact,liveContact] = await db.insert(contact).values([{organizationId:b.id,name:"Foreign"},{organizationId:a.id,name:"Live"}]).returning();
    const [foreignCost,liveCost] = await db.insert(costCenter).values([{organizationId:b.id,name:"Foreign",code:"F"},{organizationId:a.id,name:"Live",code:"L"}]).returning();
    const [foreignProject,liveProject] = await db.insert(project).values([{organizationId:b.id,name:"Foreign"},{organizationId:a.id,name:"Live"}]).returning();
    const [foreignTax] = await db.insert(taxRate).values({organizationId:b.id,name:"Foreign",rate:2000}).returning();
    for (const refs of [{contactId:foreignContact.id},{costCenterId:foreignCost.id},{projectId:foreignProject.id},{taxRateId:foreignTax.id}]) {
      const row=await movement(); await denied(async () => categorize(req({...code,...refs}),params(row.id)),404);
      await mcpDenied("categorize_bank_transaction",{transactionId:row.id,...code,...refs});
      await denied(async () => expense(req(expenseInput(refs)),params(row.id)),404);
      if (!("contactId" in refs)) {
        await denied(async () => split(req({allocations:[{...code,...refs,amountMinor:"1250"}]}),params(row.id)),404);
        await mcpDenied("split_bank_transaction",{transactionId:row.id,allocations:[{...code,...refs,amountMinor:"1250"}]});
      }
    }
    const dimensions={ contactId:liveContact.id,costCenterId:liveCost.id,projectId:liveProject.id,taxRateId:vat.id };
    const dimensionRow=await movement(), dimensionEntry=await data(await categorize(req({...code,...dimensions}),params(dimensionRow.id)));
    const coded=(await balanced(dimensionEntry.journalEntryId)).find(l=>l.accountId===target.id)!; assert.equal(coded.costCenterId,liveCost.id); assert.equal(coded.projectId,liveProject.id);
    const [compound] = await db.insert(taxRate).values({organizationId:a.id,name:"Compound",rate:2000}).returning(); await db.insert(taxComponent).values({taxRateId:compound.id,name:"Component",rate:1000});
    const compoundRow=await movement(),salesRow=await movement(),purchaseRow=await movement(1250);
    await denied(async () => categorize(req({...code,taxRateId:compound.id}),params(compoundRow.id)),422);
    await denied(async () => categorize(req({...code,taxRateId:sales.id}),params(salesRow.id)),400);
    await denied(async () => categorize(req({accountId:income.id,taxRateId:purchase.id}),params(purchaseRow.id)),400);
    for (const extra of [{status:"excluded" as const},{transferGroupId:randomUUID()},{amount:0}]) {
      const row=await movement(-1250,bank.id,extra); await denied(async () => categorize(req(code),params(row.id)),400);
    }
    const paymentRow=await movement(); await db.insert(payment).values({organizationId:a.id,contactId:liveContact.id,paymentNumber:"PAY-001",type:"received",amount:1250,date:"2026-10-04",bankTransactionId:paymentRow.id});
    await denied(async () => categorize(req(code),params(paymentRow.id)),400);
    const big=await movement(-Number.MAX_SAFE_INTEGER), bigEntry=await data(await categorize(req(code),params(big.id))); await balanced(bigEntry.journalEntryId,Number.MAX_SAFE_INTEGER);
    const unsafe=await movement(); await db.execute(sql`update bank_transaction set amount=9007199254740992 where id=${unsafe.id}`);
    await denied(async () => categorize(req(code),params(unsafe.id)),422); await denied(async () => categorize(req(code,keys.b),params(unsafe.id)),404);
    await db.execute(sql`update bank_transaction set amount=-1250 where id=${unsafe.id}`);
    const eur=await newBank("EUR"), missing=await movement(-1200,eur.id); await denied(async () => categorize(req(code),params(missing.id)),422);
    const [rate] = await db.insert(exchangeRate).values({organizationId:a.id,baseCurrency:"EUR",targetCurrency:"USD",date:"2026-10-01",rate:1500000,rateExact:"1.5",rateDirection:"quote_per_base",rateFormatVersion:1,rateMigrationStatus:"exact"}).returning();
    const eurEntry=await data(await categorize(req(code),params(missing.id))); await balanced(eurEntry.journalEntryId,1800);
    await db.update(exchangeRate).set({rate:2000000,rateExact:"2"}).where(eq(exchangeRate.id,rate.id));
    const eurCorrection=await data(await categorize(req({accountId:second.id}),params(missing.id))); const correctedLines=await balanced(eurCorrection.journalEntryId,1800); assert.ok(correctedLines.every(l=>l.rateExact==="1.5"));
    const oldRate=await db.select().from(exchangeRate).where(eq(exchangeRate.id,rate.id));
    await db.delete(exchangeRate).where(eq(exchangeRate.id,rate.id));
    const noLookup=await data(await categorize(req(code),params(missing.id))); await balanced(noLookup.journalEntryId,1800);
    await db.insert(exchangeRate).values(oldRate);
    // The old journal must be checked before a correction can replace it.
    const savedBankLine=(await db.select().from(journalLine).where(eq(journalLine.journalEntryId,noLookup.journalEntryId))).find(l=>l.creditAmount===1800)!;
    await db.update(journalLine).set({creditAmount:1799}).where(eq(journalLine.id,savedBankLine.id));
    await denied(async ()=>categorize(req(code),params(missing.id)),422);
    await db.update(journalLine).set({creditAmount:1800}).where(eq(journalLine.id,savedBankLine.id));
    await db.update(organization).set({defaultCurrency:"EUR"}).where(eq(organization.id,a.id));
    await denied(async ()=>categorize(req(code),params(missing.id)),422);
    await db.update(organization).set({defaultCurrency:"USD"}).where(eq(organization.id,a.id));
    const mismatch=await movement(-1250,bank.id,{currencyCode:"EUR"}); await denied(async ()=>categorize(req(code),params(mismatch.id)),422);
    const badLinkBank=await newBank(),badLinkRow=await movement(-1250,badLinkBank.id);
    await db.update(bankAccount).set({chartAccountId:foreign.id}).where(eq(bankAccount.id,badLinkBank.id));
    await denied(async ()=>categorize(req(code),params(badLinkRow.id)),404);
    await db.update(bankAccount).set({chartAccountId:null,deletedAt:new Date()}).where(eq(bankAccount.id,badLinkBank.id));
    await denied(async ()=>categorize(req(code),params(badLinkRow.id)),404);
    const overflowTax=await movement(-Number.MAX_SAFE_INTEGER);
    await denied(async ()=>categorize(req({...code,taxRateId:reverse.id}),params(overflowTax.id)),422);
    const fxOverflow=await movement(-Number.MAX_SAFE_INTEGER,eur.id); await denied(async ()=>categorize(req(code),params(fxOverflow.id)),422);
    const incomingMcp=await movement(1250); const mcpIncoming=await ma.call("categorize_bank_transaction",{transactionId:incomingMcp.id,accountId:income.id}); assert.equal(mcpIncoming.isError,false); await balanced(mcpIncoming.body.journalEntryId,1250);
    for (const [currency,major,cashTotal,fx] of [["JPY","1250",1250,"1"],["KWD","1.250",1250,"1"],["IRR","1250",1250,"1"]] as const) {
      const parent=await newBank(currency); await db.insert(exchangeRate).values({organizationId:a.id,baseCurrency:currency,targetCurrency:"USD",date:"2026-10-01",rate:1000000,rateExact:fx,rateDirection:"quote_per_base",rateFormatVersion:1,rateMigrationStatus:"exact"});
      const row=await movement(-cashTotal,parent.id), result=await data(await expense(req(expenseInput({currencyCode:currency,items:[{date:"2026-10-04",description:"Item",amount:Number(major),amountExact:major,amountMinor:"1250",accountId:target.id}]})),params(row.id)));
      assert.equal(result.expenseClaim.totalAmount,1250); assert.equal(result.expenseClaim.totalAmountMinor,"1250"); assert.equal(result.expenseClaim.status,"paid");
      await balanced(result.journalEntryId,currency==="KWD"?125:125000);
      const mcpRow=await movement(-1250,parent.id), mcpResult=await me.call("create_expense_from_bank_transaction",{
        transactionId:mcpRow.id,title:"MCP paid expense",currencyCode:currency,
        items:[{date:"2026-10-04",description:"Item",amount:1250,amountExact:major,amountMinor:"1250",accountId:target.id}],
      });
      assert.equal(mcpResult.isError,false); assert.equal(mcpResult.body.expenseClaim.totalAmountMinor,"1250");
      await balanced(mcpResult.body.journalEntryId,currency==="KWD"?125:125000);
    }
    const paidRow=await movement(), paid=await data(await expense(req(expenseInput({items:[{date:"2026-10-04",description:"First",amountMinor:"1000",accountId:target.id},{date:"2026-10-04",description:"Second",amountExact:"2.50",accountId:second.id}]}),keys.expense),params(paidRow.id)));
    assert.equal(paid.expenseClaim.journalEntryId,paid.journalEntryId); await balanced(paid.journalEntryId,1250);
    await denied(async () => expense(req(expenseInput()),params(paidRow.id)),400); await denied(async () => categorize(req(code),params(paidRow.id)),400);
    await denied(async () => approveExpense(req(),params(paid.expenseClaim.id)),400);
    const mcpPaidRow=await movement(); const mcpPaid=await me.call("create_expense_from_bank_transaction",{transactionId:mcpPaidRow.id,...expenseInput({items:[{date:"2026-10-04",description:"No account",amountMinor:"1250"}]})}); assert.equal(mcpPaid.isError,false);
    await balanced(mcpPaid.body.journalEntryId,1250);
    const invalidMcpExpense=await movement();
    for (const item of [{amount:1250,amountMinor:"1251"},{amountMinor:"9007199254740992"},{amount:1250,amountExact:"12.49"}])
      await mcpDenied("create_expense_from_bank_transaction",{transactionId:invalidMcpExpense.id,title:"Bad aliases",items:[{date:"2026-10-04",description:"Item",...item}]});
    for (const input of [expenseInput({currencyCode:"EUR"}),expenseInput({items:[{date:"2026-10-04",description:"Mismatch",amount:12.49}]}),expenseInput({items:[{date:"2026-02-30",description:"Bad date",amount:12.50}]}),expenseInput({items:[{date:"2026-10-04",description:"Foreign",amount:12.50,accountId:foreign.id},{date:"2026-10-04",description:"Second",amount:0,accountId:second.id}]})]) {
      const row=await movement(); await denied(async () => expense(req(input),params(row.id)),input.items[0].accountId===foreign.id?404:400);
      await mcpDenied("create_expense_from_bank_transaction",{transactionId:row.id,...input});
    }
    const incomingExpense=await movement(1250); await denied(async () => expense(req(expenseInput()),params(incomingExpense.id)),400);
    // A cleared bank link must not erase the already-created claim's identity.
    await db.update(bankTransaction).set({status:"unreconciled",journalEntryId:null}).where(eq(bankTransaction.id,paidRow.id));
    await denied(async () => expense(req(expenseInput()),params(paidRow.id)),400);
    const locked=await movement(); await db.insert(periodLock).values({organizationId:a.id,lockDate:"2026-10-04"});
    for(const [route,input] of routeInputs) await denied(async ()=>route(req(input),params(locked.id)),422);
    await db.delete(periodLock).where(eq(periodLock.organizationId,a.id));
    const [year]=await db.insert(fiscalYear).values({organizationId:a.id,name:"Closed",startDate:"2026-10-01",endDate:"2026-10-31",isClosed:true}).returning();
    await denied(async ()=>categorize(req(code),params(locked.id)),422); await db.delete(fiscalYear).where(eq(fiscalYear.id,year.id));
    await db.insert(periodLock).values({organizationId:a.id,lockDate:"2026-10-03"});
    await denied(async ()=>expense(req(expenseInput({items:[{date:"2026-10-03",description:"Locked item",amount:12.50}]})),params(locked.id)),422);
    await db.delete(periodLock).where(eq(periodLock.organizationId,a.id));
    // New syntactic errors reject the entire bulk before any first-item posting.
    const batchBad=await movement(); await denied(async ()=>bulk(req({items:[{transactionId:batchBad.id,...code},{transactionId:"bad",...code}]})),400);
    const malformed=new Request("http://fixture.test",{method:"POST",headers:{authorization:`Bearer ${keys.a}`},body:"{"}); await denied(async ()=>categorize(malformed,params(batchBad.id)),400);
    const batchA=await movement(), batchB=await movement();
    const batch=await data(await bulk(req({items:[{transactionId:batchA.id,...code},{transactionId:foreignRow.id,...code},{transactionId:batchB.id,...code},{transactionId:batchA.id,...code}]})));
    assert.deepEqual(batch.summary,{total:4,succeeded:2,failed:2}); assert.equal(batch.results[3].success,false);
    const cashA=await movement(), cashB=await movement(); const cash=await ma.call("bulk_cash_code",{transactionIds:[cashA.id,cashB.id,foreignRow.id],...code}); assert.equal(cash.isError,false); assert.equal(cash.body.succeeded,2); assert.equal(cash.body.failed,1);
    const itemA=await movement(); const perItem=await ma.call("bulk_categorize_bank_transactions",{items:[{transactionId:itemA.id,...code},{transactionId:foreignRow.id,...code}]}); assert.equal(perItem.isError,false); assert.equal(perItem.body.summary.succeeded,1);
    await mcpDenied("bulk_cash_code",{transactionIds:[fresh.id],...code,unknown:1});
    const concurrent=await movement(); const beforeEntries=await db.select({id:journalEntry.id}).from(journalEntry);
    const race=await Promise.all([ma.call("split_bank_transaction",{transactionId:concurrent.id,allocations:[{...code,amountMinor:"1250"}]}),ma.call("split_bank_transaction",{transactionId:concurrent.id,allocations:[{...code,amountMinor:"1250"}]})]);
    assert.equal(race.filter(r=>!r.isError).length,1); assert.equal((await db.select({id:journalEntry.id}).from(journalEntry)).length,beforeEntries.length+1);
    const expenseRace=await movement(); const beforeClaims=await db.select({id:expenseClaim.id}).from(expenseClaim);
    const expenseRaces=await Promise.all([me.call("create_expense_from_bank_transaction",{transactionId:expenseRace.id,...expenseMcpInput()}),me.call("create_expense_from_bank_transaction",{transactionId:expenseRace.id,...expenseMcpInput()})]);
    assert.equal(expenseRaces.filter(r=>!r.isError).length,1); assert.equal((await db.select({id:expenseClaim.id}).from(expenseClaim)).length,beforeClaims.length+1);
    const concurrentCode=await movement(); const corrections=await Promise.all([categorize(req(code),params(concurrentCode.id)),categorize(req({accountId:second.id}),params(concurrentCode.id))]);
    for (const response of corrections) await data(response);
    const active=await db.select().from(journalEntry).where(and(eq(journalEntry.sourceId,concurrentCode.id),eq(journalEntry.status,"posted"))); assert.equal(active.length,1);
    // Forced failure after bank auto-link, journal and claim writes must roll back all effects.
    const rollbackBank=await newBank(), rollback=await movement(-1250,rollbackBank.id);
    await db.execute(sql`create function reject_coding_audit() returns trigger language plpgsql as $$ begin if NEW.entity_type='bank_transaction' then raise exception 'synthetic coding audit failure'; end if; return NEW; end $$`);
    await db.execute(sql`create trigger reject_coding_audit before insert on audit_log for each row execute function reject_coding_audit()`);
    const originalError=console.error; console.error=()=>{};
    try {
      for (const [route,input] of routeInputs) await denied(async ()=>route(req(input),params(rollback.id)),500);
      await mcpDenied("categorize_bank_transaction",{transactionId:rollback.id,...code});
      const before=await snapshot(); const failedBatch=await data(await bulk(req({items:[{transactionId:rollback.id,...code}]}))); assert.equal(failedBatch.summary.failed,1); assert.deepEqual(await snapshot(),before);
      await denied(async ()=>categorize(req(code),params(fresh.id)),500);
    } finally { console.error=originalError; await db.execute(sql`drop trigger reject_coding_audit on audit_log`); await db.execute(sql`drop function reject_coding_audit()`); }
    console.log("REST and MCP bank categorization verified: aliases, taxes, scales, saved FX corrections, authorization, atomicity and concurrency");
  } finally { await ma.close(); await mb.close(); await ro.close(); await me.close(); }
}
run().then(()=>process.exit(0)).catch(error=>{ console.error(error); process.exit(1); });
