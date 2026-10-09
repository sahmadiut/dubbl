// Invoked only by the migrated, disposable parent-integration fixture.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, chartAccount, bankAccount, fixedAsset, journalEntry, journalLine, depreciationEntry } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { POST as createAsset } from "../../app/api/v1/fixed-assets/route";
import { GET as getAsset, PATCH as patchAsset, DELETE as deleteAsset } from "../../app/api/v1/fixed-assets/[id]/route";
import { POST as createCategory } from "../../app/api/v1/asset-categories/route";
import { DELETE as deleteCategory } from "../../app/api/v1/asset-categories/[id]/route";
import { POST as addCost } from "../../app/api/v1/fixed-assets/[id]/cwip-cost/route";
import { POST as capitalize } from "../../app/api/v1/fixed-assets/[id]/capitalize/route";
import { POST as depreciate } from "../../app/api/v1/fixed-assets/[id]/depreciate/route";
import { POST as undo } from "../../app/api/v1/fixed-assets/[id]/rollback-depreciation/route";
import { POST as revalue } from "../../app/api/v1/fixed-assets/[id]/revalue/route";
import { POST as dispose } from "../../app/api/v1/fixed-assets/[id]/dispose/route";
import { POST as batch } from "../../app/api/v1/fixed-assets/run-depreciation/route";
import { POST as createLoan } from "../../app/api/v1/loans/route";
import { GET as getLoan, DELETE as deleteLoan } from "../../app/api/v1/loans/[id]/route";
import { POST as payLoan } from "../../app/api/v1/loans/[id]/post-payment/route";
import { PATCH as settings } from "../../app/api/v1/organization/route";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Asset/loan integration", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of ["list_asset_categories", "get_asset_category", "create_asset_category", "update_asset_category", "delete_asset_category",
    "list_fixed_assets", "get_fixed_asset", "create_fixed_asset", "update_fixed_asset", "delete_fixed_asset",
    "run_asset_depreciation", "run_assets_depreciation", "rollback_asset_depreciation",
    "revalue_fixed_asset", "impair_fixed_asset", "dispose_fixed_asset", "list_cwip_costs", "add_cwip_cost", "capitalize_cwip_asset",
    "list_loans", "get_loan", "create_loan", "update_loan", "delete_loan", "post_loan_payment", "set_organization_currency", "update_organization"]) {
    const tool = tools.find(tool => tool.name === name); assert.ok(tool, name);
    assert.equal(tool.inputSchema.additionalProperties, false, name);
    for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
  }
  return { async call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
async function run() {
  const [owner] = await db.insert(users).values({ email: "asset-loan@example.test" }).returning();
  let sequence = 0;
  const clients: Awaited<ReturnType<typeof connect>>[] = [];
  async function tenant(permissions?: string[]) {
    const number = ++sequence;
    const [org] = await db.insert(organization).values({ name: "Parent fixture " + number, slug: "asset-loan-" + number }).returning();
    const [role] = permissions === undefined ? [] : await db.insert(customRole).values({ organizationId: org.id, name: "Fixture permissions", permissions }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner", customRoleId: role?.id });
    const key = "dk_parent_" + number;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_parent",
      keyHash: createHash("sha256").update(key).digest("hex") });
    const ctx: AuthContext = { organizationId: org.id, userId: owner.id, role: "owner", permissions };
    const mcp = await connect(ctx); clients.push(mcp);
    const req = (body: unknown = {}, overrideKey = key) => new Request("http://fixture.test", { method: "POST", headers: {
      authorization: "Bearer " + overrideKey, "content-type": "application/json", "x-organization-id": "00000000-0000-4000-8000-000000000099",
    }, body: JSON.stringify(body) });
    return { org, ctx, mcp, req };
  }
  const p = (id: string) => ({ params: Promise.resolve({ id }) });
  const data = async (response: Response, status = 200) => {
    const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
  };
  async function snapshot() {
    const tables = ["organization", "fixed_asset", "asset_category", "cwip_cost", "depreciation_entry", "asset_revaluation", "loan", "loan_schedule", "chart_account", "bank_account", "journal_entry", "journal_line", "audit_log"];
    const query = "select jsonb_build_object(" + tables.map(t => `'${t}',(select jsonb_agg(to_jsonb(t) order by id) from ${t} t)`).join(",") + ") as state";
    const result = await db.execute(sql.raw(query)); return JSON.stringify(result.rows[0].state);
  }
  async function denied(run: () => Promise<Response>, status: number) {
    const before = await snapshot(); await data(await run(), status); assert.equal(await snapshot(), before);
  }
  async function mdenied(t: Awaited<ReturnType<typeof tenant>>, name: string, args: Record<string, unknown>, status?: number) {
    const before = await snapshot(), result = await t.mcp.call(name, args);
    assert.equal(result.isError, true, JSON.stringify(result)); if (status !== undefined) assert.equal(result.body.status, status); assert.equal(await snapshot(), before);
  }
  async function mdata(t: Awaited<ReturnType<typeof tenant>>, name: string, args: Record<string, unknown>) {
    const result = await t.mcp.call(name, args); assert.equal(result.isError, false, JSON.stringify(result)); return result.body;
  }
  async function accounts(t: Awaited<ReturnType<typeof tenant>>) {
    const rows = await db.insert(chartAccount).values([
      { organizationId: t.org.id, code: "1501", name: "Asset cost", type: "asset" as const },
      { organizationId: t.org.id, code: "1701", name: "Construction", type: "asset" as const },
      { organizationId: t.org.id, code: "5901", name: "Depreciation", type: "expense" as const },
      { organizationId: t.org.id, code: "1591", name: "Accumulated", type: "asset" as const },
      { organizationId: t.org.id, code: "1101", name: "Cash", type: "asset" as const },
      { organizationId: t.org.id, code: "2301", name: "Liability", type: "liability" as const },
      { organizationId: t.org.id, code: "5902", name: "Interest", type: "expense" as const },
    ]).returning();
    const [cost, cwip, expense, accumulated, cash, liability, interest] = rows;
    return { cost, cwip, expense, accumulated, cash, liability, interest };
  }
  const assetInput = { name: "Integrated asset", assetNumber: "PARENT", purchaseDate: "2024-01-01", purchasePriceMinor: "12000", usefulLifeMonths: 12 };
  try {
    // Currency history without a single GL row, including soft-deleted roots.
    for (const kind of ["asset", "category", "loan"] as const) {
      const t = await tenant(), ac = await accounts(t);
      const created = kind === "asset" ? await data(await createAsset(t.req(assetInput)), 201)
        : kind === "category" ? await data(await createCategory(t.req({ name: "Template", defaultResidualValueMinor: "1250" })), 201)
        : await data(await createLoan(t.req({ name: "Unposted", principalAmount: 125, interestRate: 0, termMonths: 2, startDate: "2024-01-01",
          principalAccountId: ac.liability.id, interestAccountId: ac.interest.id })), 201);
      const journals = await db.select().from(journalEntry).where(eq(journalEntry.organizationId, t.org.id)); assert.equal(journals.length, 0);
      await denied(() => settings(t.req({ defaultCurrency: "GBP" })), 409);
      await mdenied(t, "set_organization_currency", { currencyCode: "GBP" }, 409);
      await mdenied(t, "update_organization", { defaultCurrency: "GBP" }, 409);
      assert.equal((await data(await settings(t.req({ defaultCurrency: "USD", name: "Metadata edit" })))).organization.name, "Metadata edit");
      const id = kind === "asset" ? created.asset.id : kind === "category" ? created.category.id : created.loan.id;
      await data(await (kind === "asset" ? deleteAsset(t.req(), p(id)) : kind === "category" ? deleteCategory(t.req(), p(id)) : deleteLoan(t.req(), p(id))));
      await denied(() => settings(t.req({ defaultCurrency: "GBP" })), 409);
      await mdenied(t, "set_organization_currency", { currencyCode: "GBP" }, 409);
      await mdenied(t, "update_organization", { defaultCurrency: "GBP" }, 409);
    }
    const empty = await tenant();
    assert.equal((await data(await settings(empty.req({ defaultCurrency: "GBP" })))).organization.defaultCurrency, "GBP");
    assert.equal((await mdata(empty, "set_organization_currency", { currencyCode: "USD" })).organization.defaultCurrency, "USD");
    // Real cross-transport lifecycle: exact CWIP -> capitalization -> charge/undo -> valuation -> disposal.
    const t = await tenant(), ac = await accounts(t);
    const restricted = await tenant([]);
    await denied(() => createAsset(restricted.req(assetInput)), 403);
    await mdenied(restricted, "create_fixed_asset", assetInput, 403);
    await denied(() => settings(restricted.req({ defaultCurrency: "GBP" })), 403);
    await mdenied(restricted, "set_organization_currency", { currencyCode: "GBP" }, 403);
    await denied(() => createAsset(t.req(assetInput, "dk_invalid")), 401);
    await denied(() => createAsset(t.req({ ...assetInput, purchasePriceMinor: "9007199254740992" })), 422);
    await mdenied(t, "create_fixed_asset", { ...assetInput, purchasePrice: 12001 });
    await denied(() => createAsset(t.req({ ...assetInput, organizationId: empty.org.id })), 400);
    await mdenied(t, "create_fixed_asset", { ...assetInput, organizationId: empty.org.id });
    await mdenied(t, "create_asset_category", { name: "Strict template", organizationId: empty.org.id });
    await mdenied(t, "update_organization", { defaultCurrency: "GBP", organizationId: empty.org.id });
    const category = (await mdata(t, "create_asset_category", { name: "Plant", defaultUsefulLifeMonths: 12,
      assetAccountId: ac.cost.id, cwipAccountId: ac.cwip.id, depreciationAccountId: ac.expense.id, accumulatedDepAccountId: ac.accumulated.id })).category;
    const root = (await data(await createAsset(t.req({ ...assetInput, categoryId: category.id, purchasePriceMinor: "0", isCwip: true })), 201)).asset;
    for (const [name, args] of [
      ["add_cwip_cost", { assetId: root.id, date: "2024-01-15", amountMinor: "1", sourceAccountId: ac.cash.id }],
      ["run_asset_depreciation", { assetId: root.id, date: "2024-04-01" }],
      ["revalue_fixed_asset", { assetId: root.id, date: "2024-06-01", revaluedAmountMinor: "15000" }],
    ] as const) await mdenied(t, name, { ...args, organizationId: empty.org.id });
    await data(await addCost(t.req({ date: "2024-01-15", amount: 5000, sourceAccountId: ac.cash.id }), p(root.id)));
    const cost2 = await mdata(t, "add_cwip_cost", { assetId: root.id, date: "2024-02-01", amountMinor: "7000", sourceAccountId: ac.cash.id, idempotencyKey: "cost-two" });
    assert.equal(cost2.asset.purchasePriceMinor, "12000");
    const cap = await data(await capitalize(t.req({ date: "2024-03-01" }), p(root.id)));
    assert.equal(cap.capitalizedCost, 12000); assert.equal(cap.capitalizedCostMinor, "12000");
    const capState = await snapshot();
    assert.deepEqual(await mdata(t, "capitalize_cwip_asset", { assetId: root.id, date: "2024-03-01" }), cap); assert.equal(await snapshot(), capState);
    const dep = await mdata(t, "run_asset_depreciation", { assetId: root.id, date: "2024-04-01", idempotencyKey: "charge" });
    assert.equal(dep.depreciationEntry.amountMinor, "1000"); assert.equal(dep.asset.netBookValueMinor, "11000");
    const originalLines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, dep.journalEntryId));
    const reversal = await data(await undo(t.req({ date: "2024-04-20", depreciationEntryId: dep.depreciationEntry.id }), p(root.id)));
    assert.equal(reversal.asset.netBookValueMinor, "12000");
    assert.deepEqual(await db.select().from(journalLine).where(eq(journalLine.journalEntryId, dep.journalEntryId)), originalLines);
    const reverseState = await snapshot();
    assert.deepEqual(await mdata(t, "rollback_asset_depreciation", { assetId: root.id, date: "2024-04-20", depreciationEntryId: dep.depreciationEntry.id }), reversal);
    assert.equal(await snapshot(), reverseState);
    await data(await depreciate(t.req({ date: "2024-05-01" }), p(root.id)));
    const up = await data(await revalue(t.req({ date: "2024-06-01", revaluedAmountMinor: "15000", idempotencyKey: "up" }), p(root.id)));
    assert.equal(up.revaluation.changeAmountMinor, "4000"); assert.equal(up.asset.revaluationSurplusBalanceMinor, "4000");
    const down = await mdata(t, "impair_fixed_asset", { assetId: root.id, date: "2024-07-01", recoverableAmountMinor: "14000", idempotencyKey: "down" });
    assert.equal(down.impairment.changeAmountMinor, "-1000"); assert.equal(down.asset.revaluationSurplusBalanceMinor, "3000");
    await denied(() => depreciate(t.req({ date: "2024-08-01" }), p(root.id)), 422);
    await mdenied(t, "rollback_asset_depreciation", { assetId: root.id, date: "2024-08-01" }, 422);
    await denied(() => patchAsset(t.req({ usefulLifeMonths: 24 }), p(root.id)), 409);
    // Batch must roll back earlier ordinary assets when an unsupported valued asset is encountered.
    await db.insert(fixedAsset).values({ organizationId: t.org.id, id: "00000000-0000-4000-8000-000000000001", name: "First in batch", assetNumber: "FIRST",
      purchaseDate: "2024-01-01", purchasePrice: 12000, netBookValue: 12000, usefulLifeMonths: 12, depreciationAccountId: ac.expense.id, accumulatedDepAccountId: ac.accumulated.id });
    await denied(() => batch(t.req({ date: "2024-08-01" })), 422);
    const sold = await mdata(t, "dispose_fixed_asset", { assetId: root.id, date: "2024-08-01", disposalAmountMinor: "13000", proceedsAccountId: ac.cash.id });
    assert.equal(sold.gainOrLossMinor, "-1000"); assert.equal(sold.catchUpAmountMinor, "0"); assert.equal(sold.asset.revaluationSurplusBalanceMinor, "0");
    const soldState = await snapshot();
    assert.deepEqual(await data(await dispose(t.req({ date: "2024-08-01", disposalAmount: 13000, proceedsAccountId: ac.cash.id }), p(root.id))), sold);
    assert.equal(await snapshot(), soldState);
    const detail = await data(await getAsset(t.req(), p(root.id)));
    assert.deepEqual(await mdata(t, "get_fixed_asset", { assetId: root.id }), detail);
    assert.equal(detail.asset.cwipCosts.length, 2); assert.equal(detail.asset.revaluations.length, 2); assert.equal(detail.asset.depreciationEntries.length, 1);
    // Scoped lifecycle reads and writers use the same root in both transports.
    await denied(() => getAsset(empty.req(), p(root.id)), 404);
    await mdenied(empty, "dispose_fixed_asset", { assetId: root.id, date: "2024-09-01", disposalAmountMinor: "1" }, 404);
    // Wrong-base accounts cannot be used by the depreciation path after capitalization.
    const [gbp] = await db.insert(chartAccount).values({ organizationId: t.org.id, code: "5999", name: "GBP expense", type: "expense", currencyCode: "GBP" }).returning();
    const wrong = (await data(await createAsset(t.req({ ...assetInput, assetNumber: "WRONG", depreciationAccountId: gbp.id, accumulatedDepAccountId: ac.accumulated.id })), 201)).asset;
    await denied(() => depreciate(t.req({ date: "2024-02-01" }), p(wrong.id)), 422);
    await mdenied(t, "run_asset_depreciation", { assetId: wrong.id, date: "2024-02-01" }, 422);
    // One tenant can independently use loan GL posting without moving statement balances or allocations.
    const [bank] = await db.insert(bankAccount).values({ organizationId: t.org.id, accountName: "Fixture cash", bankName: "Fixture", accountType: "checking", chartAccountId: ac.cash.id, balance: 76543 }).returning();
    const loanInput = { name: "Integrated loan", principalAmountMinor: "12000", interestRate: 0, termMonths: 3, startDate: "2024-03-01",
      principalAccountId: ac.liability.id, interestAccountId: ac.interest.id, bankAccountId: bank.id, idempotencyKey: "loan" };
    await denied(() => createLoan(restricted.req(loanInput)), 403);
    await mdenied(restricted, "create_loan", loanInput, 403);
    await mdenied(t, "create_loan", { ...loanInput, organizationId: empty.org.id });
    const borrowing = await data(await createLoan(t.req(loanInput)), 201);
    await denied(() => getLoan(empty.req(), p(borrowing.loan.id)), 404);
    await mdenied(empty, "post_loan_payment", { loanId: borrowing.loan.id }, 404);
    assert.deepEqual(await mdata(t, "create_loan", { ...loanInput, principalAmount: 12000 }), borrowing);
    const persisted = await data(await getLoan(t.req(), p(borrowing.loan.id)));
    let paid = 0n;
    for (const row of persisted.schedule) {
      const results = await Promise.all([data(await payLoan(t.req({ scheduleEntryId: row.id }), p(borrowing.loan.id))),
        mdata(t, "post_loan_payment", { loanId: borrowing.loan.id, scheduleEntryId: row.id })]);
      assert.deepEqual(results[0], results[1]); paid += BigInt(results[0].entry.principalAmountMinor);
    }
    assert.equal(paid, 12000n); assert.equal((await data(await getLoan(t.req(), p(borrowing.loan.id)))).loan.status, "paid_off");
    assert.equal((await db.select().from(bankAccount).where(eq(bankAccount.id, bank.id)))[0].balance, 76543);
    await denied(() => deleteLoan(t.req(), p(borrowing.loan.id)), 400);
    // All resulting GL journals balance, with identity FX, without changing prior posted legs.
    const journals = await db.select().from(journalEntry).where(eq(journalEntry.organizationId, t.org.id));
    for (const entry of journals) {
      const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, entry.id));
      assert.equal(entry.status, "posted"); assert.ok(lines.length >= 2);
      assert.equal(lines.reduce((n, l) => n + BigInt(l.debitAmount) - BigInt(l.creditAmount), 0n), 0n);
      assert.ok(lines.every(l => l.currencyCode === "USD" && l.rateExact === "1" && l.rateDirection === "quote_per_base"));
    }
    // Cross-writer races: capitalization/depreciation, then single/disposal.
    const race = await tenant(), rac = await accounts(race);
    const r = (await data(await createAsset(race.req({ ...assetInput, isCwip: true, assetAccountId: rac.cost.id, cwipAccountId: rac.cwip.id,
      depreciationAccountId: rac.expense.id, accumulatedDepAccountId: rac.accumulated.id })), 201)).asset;
    const [capitalized, charged] = await Promise.all([capitalize(race.req({ date: "2024-02-01" }), p(r.id)), depreciate(race.req({ date: "2024-03-01" }), p(r.id))]);
    await data(capitalized); assert.ok([200, 400].includes(charged.status));
    await data(await depreciate(race.req({ date: "2024-03-01" }), p(r.id)));
    const [disposed, racingCharge] = await Promise.all([dispose(race.req({ date: "2024-04-01", disposalAmountMinor: "10000", proceedsAccountId: rac.cash.id }), p(r.id)),
      depreciate(race.req({ date: "2024-04-01" }), p(r.id))]);
    await data(disposed); assert.ok([200, 400].includes(racingCharge.status));
    const april = await db.select().from(depreciationEntry).where(and(eq(depreciationEntry.fixedAssetId, r.id), eq(depreciationEntry.date, "2024-04-01")));
    assert.equal(april.length, 1); assert.equal(april[0].amount, 1000);
    assert.equal((await data(await getAsset(race.req(), p(r.id)))).asset.accumulatedDepreciationMinor, "2000");
    // Settings and new master creation serialize on the same organization row.
    const concurrent = await tenant();
    const [newAsset, changed] = await Promise.all([createAsset(concurrent.req(assetInput)), settings(concurrent.req({ defaultCurrency: "GBP" }))]);
    await data(newAsset, 201); assert.ok([200, 409].includes(changed.status));
    await denied(() => settings(concurrent.req({ defaultCurrency: changed.status === 200 ? "USD" : "GBP" })), 409);
    console.log("Asset/loan integration verified");
  } finally { for (const client of clients) await client.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
