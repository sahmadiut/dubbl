// Runs only in the harness-created disposable migrated PostgreSQL database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, subscription, contact, chartAccount, taxRate, costCenter } from "../../lib/db/schema";
import { POST, GET as LIST } from "../../app/api/v1/expenses/route";
import { GET, PATCH } from "../../app/api/v1/expenses/[id]/route";
import { GET as COUNTS } from "../../app/api/v1/expenses/counts/route";
import { GET as SETTING } from "../../app/api/v1/organization/mileage-rate/route";
import { POST as RECURRING } from "../../app/api/v1/recurring/route";
import { registerExpenseCrudTools } from "../../lib/mcp/tools/expense-crud";
import { registerOrganizationTools } from "../../lib/mcp/tools/organization";
import { registerRecurringTemplateTools } from "../../lib/mcp/tools/recurring-templates";
import { processRecurringPayableTemplate } from "../../lib/api/recurring-payable";
import { expenseEditorItems, expenseEditorPreview, expenseUiDocument, expenseUiHeader, expenseUiMinor, expenseUiDecimal,
  expenseUiCounts, expenseUiMileageSetting } from "../../lib/money/expense-ui";
import { recurringExpensePayload, recurringExpensePreview } from "../../lib/money/recurring-expense-ui";

type Claim = { id: string; totalAmount: number; totalAmountMinor: string; currencyCode: string;
  items: { id: string; description: string; amount: number; amountMinor: string; mileageRate: number | null;
    mileageRateMinor: string | null; distanceMiles: number | null; isMileage: boolean; taxRateId: string | null; costCenterId: string | null }[] };

async function run() {
  const [owner] = await db.insert(users).values({ email: "expense-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Expense UI ${currencyCode}`, slug: `expense-ui-${currencyCode}`, defaultCurrency: currencyCode, mileageRate: 67 }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_expense_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "UI", keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_expense" });
    const [supplier] = await db.insert(contact).values({ organizationId: org.id, name: "Supplier", type: "supplier", currencyCode: "USD" }).returning();
    const [account] = await db.insert(chartAccount).values({ organizationId: org.id, code: "5900", name: "Expense", type: "expense", currencyCode }).returning();
    const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "Purchase tax", rate: 1000, type: "purchase" }).returning();
    const [center] = await db.insert(costCenter).values({ organizationId: org.id, name: "Office", code: "OFF" }).returning();
    const server = new McpServer({ name: "Expense UI", version: "1" }), ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    registerExpenseCrudTools(server, ctx); registerOrganizationTools(server, ctx); registerRecurringTemplateTools(server, ctx);
    const client = new Client({ name: "UI fixture", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args }); assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const req = (method: string, body?: unknown) => new Request("http://fixture.test/api/v1/expenses", { method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const read = async (id: string) => { const response = await GET(req("GET"), params(id)); assert.equal(response.status, 200); return expenseUiDocument((await response.json()).expenseClaim as Claim); };
    const line = (amount: string) => ({ date: "2026-10-11", description: "Travel", amount, category: "Travel", accountId: account.id, taxRateId: tax.id, receiptFileKey: "", receiptFileName: "" });
    try {
      const settingResponse = await SETTING(req("GET")); assert.equal(settingResponse.status, 200);
      const setting = expenseUiMileageSetting(await settingResponse.json());
      assert.deepEqual(setting, expenseUiMileageSetting(await call("get_organization_mileage_rate")));
      const ordinary = currencyCode === "USD" ? "12.505" : currencyCode === "KWD" ? "1.2505" : "1250.5";
      const cases = [[line(ordinary)], [{ ...line(""), isMileage: true, distanceMiles: "120.005", mileageRate: setting.rate }]];
      if (currencyCode === "USD") cases.push([line("90071992547409.91")], [{ ...line(""), isMileage: true, distanceMiles: "3", mileageRate: "0.005" }]);
      for (const items of cases) {
        const payload = expenseEditorItems(items, currencyCode, true), preview = expenseEditorPreview(items, currencyCode);
        assert.equal(preview.error, null); assert.equal(payload.total, preview.total);
        const input = { title: "Travel", currencyCode, items: payload.items.map(item => ({ ...item, costCenterId: center.id })) };
        const response = await POST(req("POST", input)); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
        const rest = expenseUiHeader((await response.json()).expenseClaim as Claim);
        const mcp = expenseUiHeader((await call("create_expense_claim", input)).expenseClaim as Claim);
        for (const saved of [rest, mcp]) {
          assert.equal(expenseUiMinor(saved, "totalAmount"), preview.total);
          const document = await read(saved.id);
          const linked = expenseUiDocument((await call("get_expense_claim", { expenseClaimId: saved.id })).expenseClaim as Claim);
          assert.equal(expenseUiMinor(linked, "totalAmount"), preview.total);
          const stored = (await db.execute(sql`select c.total_amount::text, c.currency_code, i.amount::text, i.mileage_rate::text, i.distance_miles, i.tax_rate_id, i.cost_center_id
            from expense_claim c join expense_item i on i.expense_claim_id=c.id where c.id=${saved.id}`)).rows[0];
          assert.equal(stored.total_amount, String(preview.total)); assert.equal(stored.amount, String(preview.amounts[0])); assert.equal(stored.currency_code, currencyCode);
          assert.equal(stored.tax_rate_id, tax.id); assert.equal(stored.cost_center_id, center.id);
          if ("distanceMiles" in payload.items[0]) { assert.equal(stored.distance_miles, payload.items[0].distanceMiles); assert.equal(stored.mileage_rate, payload.items[0].mileageRateMinor); }
          // Edit follows the real drawer: ID carries mileage, cost center and tax not edited by this UI.
          const edit = expenseEditorItems([{ ...line(expenseUiDecimal(expenseUiMinor(document.items[0], "amount"), currencyCode)), id: document.items[0].id, taxRateId: undefined }], currencyCode);
          const edited = await PATCH(req("PATCH", { items: edit.items }), params(saved.id)); assert.equal(edited.status, 200);
          const after = await read(saved.id);
          assert.equal(after.totalAmountMinor, document.totalAmountMinor);
          for (const field of ["isMileage", "distanceMiles", "mileageRate", "mileageRateMinor", "taxRateId", "costCenterId"] as const) assert.equal(after.items[0][field], document.items[0][field]);
          const mcpEdit = expenseEditorItems([{ ...line("1"), id: after.items[0].id, taxRateId: undefined }], currencyCode);
          await call("update_expense_claim", { expenseClaimId: saved.id, items: mcpEdit.items });
          assert.equal(expenseUiMinor(await read(saved.id), "totalAmount"), mcpEdit.total);
        }
      }
      const listedResponse = await LIST(req("GET")); assert.equal(listedResponse.status, 200);
      for (const row of (await listedResponse.json()).data as Claim[]) expenseUiHeader(row);
      const countResponse = await COUNTS(req("GET")); assert.equal(countResponse.status, 200);
      expenseUiCounts(await countResponse.json()); expenseUiCounts(await call("get_expense_claim_counts"));
      for (const amountMinor of ["9007199254740992", "-1"]) {
        const denied = await POST(req("POST", { title: "Invalid", currencyCode, items: [{ date: "2026-10-11", description: "Bad", amountMinor }] }));
        assert.ok([400, 422].includes(denied.status));
      }
      // The existing recurring payable generator remains the owner; expense prices stay fixed-two and gross-only.
      const recurringLines = [{ description: "Rent", amount: "12.50", accountId: account.id }];
      const recurring = recurringExpensePayload({ name: "Rent", contactId: supplier.id, currencyCode, frequency: "monthly", startDate: "2026-10-11", endDate: "2026-11-11", maxOccurrences: "2" }, recurringLines);
      const recurringResponse = await RECURRING(req("POST", recurring)); assert.equal(recurringResponse.status, 201);
      const templates = [(await recurringResponse.json()).template, (await call("create_recurring_template", recurring)).template];
      for (const template of templates) {
        assert.equal(template.type, "expense"); assert.equal(template.currencyCode, currencyCode);
        assert.equal(await processRecurringPayableTemplate(org.id, template.id, "2026-10-11"), 1);
        const generated = (await db.execute(sql`select total_amount::text, currency_code, status from expense_claim where organization_id=${org.id} and title='Rent' order by created_at desc limit 1`)).rows[0];
        assert.equal(generated.total_amount, String(recurringExpensePreview(recurringLines, currencyCode).total)); assert.equal(generated.currency_code, currencyCode); assert.equal(generated.status, "draft");
        const after = (await call("get_recurring_template", { templateId: template.id })).template;
        assert.equal(after.nextRunDate, "2026-11-11"); assert.equal(after.occurrencesGenerated, 1);
        assert.equal(await processRecurringPayableTemplate(org.id, template.id, "2026-12-11"), 1);
        assert.equal((await call("get_recurring_template", { templateId: template.id })).template.status, "completed");
        assert.equal(await processRecurringPayableTemplate(org.id, template.id, "2026-12-11"), 0);
      }
    } finally { await client.close(); await server.close(); }
  }
  console.log("Expense UI REST MCP SQL verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
