// Runs only in configuration-integration.test.ts's disposable migrated database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, customRole, apiKey, chartAccount, contact, approvalRequest, journalLine } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { GET as getOrganization, PATCH as updateOrganization } from "../../app/api/v1/organization/route";
import { PUT as mileage } from "../../app/api/v1/organization/mileage-rate/route";
import { POST as createRate } from "../../app/api/v1/tax-rates/route";
import { GET as getRate, PATCH as updateRate } from "../../app/api/v1/tax-rates/[id]/route";
import { POST as applyProfile } from "../../app/api/v1/tax-profiles/route";
import { POST as saveJurisdiction, GET as lookup } from "../../app/api/v1/tax-lookup/route";
import { POST as createWorkflow } from "../../app/api/v1/approval-workflows/route";
import { GET as getWorkflow } from "../../app/api/v1/approval-workflows/[id]/route";
import { POST as approvalAction } from "../../app/api/v1/approval-requests/[id]/action/route";
import { POST as createInvoice } from "../../app/api/v1/invoices/route";
import { POST as sendInvoice } from "../../app/api/v1/invoices/[id]/send/route";
import { POST as createPeriod } from "../../app/api/v1/tax-periods/route";
import { GET as getPeriod } from "../../app/api/v1/tax-periods/[id]/route";
import { POST as file } from "../../app/api/v1/tax-periods/[id]/file/route";

const configurationTools = [
  "get_organization", "update_organization", "set_organization_currency", "get_organization_mileage_rate", "update_organization_mileage_rate",
  "list_tax_rates", "get_tax_rate", "create_tax_rate", "update_tax_rate", "delete_tax_rate", "list_tax_profiles", "apply_tax_profile",
  "lookup_tax_rate", "save_tax_jurisdiction", "delete_tax_jurisdiction",
  "list_tax_periods", "get_tax_period", "create_tax_period", "update_tax_period", "delete_tax_period", "file_tax_period", "file_vat_return", "record_vat_settlement",
  "list_approval_workflows", "get_approval_workflow", "create_approval_workflow", "update_approval_workflow", "delete_approval_workflow",
  "list_approval_requests", "get_approval_request", "approve_request", "reject_request", "comment_approval_request",
];
async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Combined configuration", version: "1" });
  registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  const tools = (await client.listTools()).tools;
  for (const name of configurationTools) {
    const matches = tools.filter(tool => tool.name === name);
    assert.equal(matches.length, 1, `${name} registration`);
    assert.equal(matches[0].inputSchema.additionalProperties, false, `${name} strict input`);
    for (const field of Object.values(matches[0].inputSchema.properties ?? {}))
      assert.ok((field as { description?: string }).description, `${name} field description`);
  }
  return {
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args }), text = (result.content as { text: string }[])[0].text;
      return { isError: result.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
    },
    async ok(name: string, args: Record<string, unknown> = {}) {
      const result = await this.call(name, args); assert.equal(result.isError, false, `${name}: ${JSON.stringify(result.body)}`); return result.body;
    },
    async close() { await client.close(); await server.close(); },
  };
}
async function data(response: Response, status = 200) {
  const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const tables = ["organization", "chart_account", "tax_rate", "tax_component", "tax_jurisdiction", "tax_period", "tax_return_line",
  "approval_workflow", "approval_workflow_step", "approval_request", "approval_action", "invoice", "invoice_line", "number_sequence", "journal_entry", "journal_line", "audit_log"];
const snapshot = () => Promise.all(tables.map(table => db.execute(sql.raw(
  `select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id),'[]'::jsonb) as rows from ${table} t`,
)).then(result => result.rows)));
async function unchanged(operation: () => Promise<unknown>) {
  const before = await snapshot(); await operation(); assert.deepEqual(await snapshot(), before);
}
async function balanced(id: string, amount: bigint, currency: string) {
  const lines = await db.select().from(journalLine).where(eq(journalLine.journalEntryId, id));
  assert.equal(lines.reduce((sum, line) => sum + BigInt(line.debitAmount), 0n), amount);
  assert.equal(lines.reduce((sum, line) => sum + BigInt(line.creditAmount), 0n), amount);
  for (const line of lines) { assert.equal(line.currencyCode, currency); assert.equal(line.rateExact, "1"); assert.equal(line.rateMigrationStatus, "exact"); }
}

async function run() {
  const [owner, viewer] = await db.insert(users).values([{ email: "config-owner@example.test" }, { email: "config-viewer@example.test" }]).returning();
  const orgs = await db.insert(organization).values(["USD", "JPY", "KWD", "IRR"].map(currency => ({
    name: `Configuration ${currency}`, slug: `configuration-${currency.toLowerCase()}`, defaultCurrency: currency,
    billApprovalThreshold: 1250, countryCode: "GB",
  }))).returning();
  const memberships = await db.insert(member).values(orgs.map(org => ({ organizationId: org.id, userId: owner.id, role: "owner" as const }))).returning();
  const [readOnly] = await db.insert(customRole).values({ organizationId: orgs[0].id, name: "Configuration viewer", permissions: ["view:data"] }).returning();
  await db.insert(member).values({ organizationId: orgs[0].id, userId: viewer.id, customRoleId: readOnly.id });
  const keys = [...orgs.map(org => `dk_configuration_${org.defaultCurrency}`), "dk_configuration_viewer"];
  for (const [i, key] of keys.entries()) await db.insert(apiKey).values({
    organizationId: orgs[i]?.id ?? orgs[0].id, createdBy: i === 4 ? viewer.id : owner.id, name: key,
    keyPrefix: "dk_configuration", keyHash: createHash("sha256").update(key).digest("hex"),
  });
  const clients = await Promise.all(orgs.map(org => mcp({ organizationId: org.id, userId: owner.id, role: "owner" })));
  const ro = await mcp({ organizationId: orgs[0].id, userId: viewer.id, role: "member", permissions: ["view:data"] });
  const request = (body?: unknown, i = 0, query = "") => new Request(`http://fixture.test/api/v1/configuration${query}`, {
    method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${keys[i]}`, "content-type": "application/json", "x-organization-id": orgs[(i + 1) % 4].id },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    for (const [i, org] of orgs.entries()) {
      const client = clients[i], foreign = clients[(i + 1) % 4];
      const settings = await data(await getOrganization(request(undefined, i)));
      assert.deepEqual(await client.ok("get_organization"), settings);
      assert.equal(settings.organization.billApprovalThresholdMinor, "1250");
      assert.equal(settings.organization.mileageRateMinor, "67");
      await data(await mileage(request({ mileageRate: 1250 }, i)));
      assert.equal((await client.ok("update_organization_mileage_rate", { mileageRateMinor: "1250" })).mileageRate, 1250);
      await data(await updateOrganization(request({ peppolId: `config-${i}`, fiscalYearStartMonth: 4 }, i)));
      assert.equal((await client.ok("get_organization")).organization.defaultCurrency, org.defaultCurrency);
      for (const patch of [{ billApprovalThresholdMinor: "1" }, { vatScheme: "cash" }, { taxRegime: "vat" },
        { interestRate: 500 }, { taxLookupEnabled: 1 }]) await unchanged(async () => {
        await data(await updateOrganization(request(patch, i)), 400);
        assert.equal((await client.call("update_organization", patch)).isError, true);
      });
      if (org.defaultCurrency === "IRR") {
        // Legacy IRR settings remain readable; functional posting stays gated.
        await unchanged(async () => {
          assert.equal((await client.call("set_organization_currency", { currencyCode: "IRR" })).body.status, 403);
        });
        const period = (await client.ok("create_tax_period", { name: "IRR gate", type: "monthly", startDate: "2026-01-01", endDate: "2026-01-31" })).taxPeriod;
        await unchanged(async () => { assert.equal((await client.call("file_tax_period", { taxPeriodId: period.id })).body.status, 403); });
        await client.ok("delete_tax_period", { taxPeriodId: period.id });
        continue;
      }
      // Settings currency changes retain monetary integers before any journal exists.
      const changed = await client.ok("set_organization_currency", { currencyCode: "EUR" });
      assert.equal(changed.organization.mileageRateMinor, "1250"); assert.equal(changed.organization.billApprovalThresholdMinor, "1250");
      await data(await updateOrganization(request({ defaultCurrency: org.defaultCurrency }, i)));
      const profile = await data(await applyProfile(request({}, i)), 201);
      assert.equal(profile.country, "GB");
      assert.equal((await client.ok("apply_tax_profile", {})).created.length, 0);
      const [bank, revenue, output] = await db.insert(chartAccount).values([
        { organizationId: org.id, code: "1100", name: "Bank", type: "asset", subType: "bank", currencyCode: org.defaultCurrency },
        { organizationId: org.id, code: "4000", name: "Revenue", type: "revenue", currencyCode: org.defaultCurrency },
        { organizationId: org.id, code: "2200", name: "Output VAT", type: "liability", currencyCode: org.defaultCurrency },
        { organizationId: org.id, code: "1200", name: "Receivables", type: "asset", currencyCode: org.defaultCurrency },
      ]).returning();
      const [customer] = await db.insert(contact).values({ organizationId: org.id, name: "Domestic customer", type: "customer", currencyCode: org.defaultCurrency }).returning();
      const rate = (await data(await createRate(request({ name: "Integration 10%", rate: 1000, isDefault: true, components: [{ name: "Single tax", rate: 1000, accountId: output.id }] }, i)), 201)).taxRate;
      assert.deepEqual(await client.ok("get_tax_rate", { taxRateId: rate.id }), await data(await getRate(request(undefined, i), params(rate.id))));
      const jurisdiction = await client.ok("save_tax_jurisdiction", { country: "GB", combinedRate: 1000 });
      await data(await saveJurisdiction(request({ country: "GB", combinedRate: 1000 }, i)), 201);
      assert.equal((await client.ok("lookup_tax_rate", { country: "GB" })).rate.combinedRate, 1000);
      assert.deepEqual(await client.ok("lookup_tax_rate", { country: "GB" }), await data(await lookup(request(undefined, i, "?country=GB"))));
      const workflowBody = { name: "Tax-inclusive invoice approval", entityType: "invoice", conditions: [
        { field: "total", operator: "gte", value: "3300000000", valueMinor: "3300000000" },
        { field: "currencyCode", operator: "eq", value: org.defaultCurrency },
      ], steps: [{ approverId: memberships[i].id }] };
      const workflow = (await data(await createWorkflow(request(workflowBody, i)), 201)).workflow;
      assert.deepEqual(await client.ok("get_approval_workflow", { workflowId: workflow.id }), await data(await getWorkflow(request(undefined, i), params(workflow.id))));
      // Existing invoice numeric price is MAJOR units; configuration money is minor units.
      const majorPrice = 3000000000 / (org.defaultCurrency === "JPY" ? 1 : org.defaultCurrency === "KWD" ? 1000 : 100);
      const invoiceBody = { contactId: customer.id, currencyCode: org.defaultCurrency, issueDate: "2026-01-15", dueDate: "2026-02-15", submitForApproval: true };
      const line = { description: "Synthetic taxed sale", quantity: 1, accountId: revenue.id, taxRateId: rate.id };
      const legacy = (await data(await createInvoice(request({ ...invoiceBody, lines: [{ ...line, unitPrice: majorPrice }] }, i)), 201)).invoice;
      const exact = (await client.ok("create_invoice", { ...invoiceBody, lines: [{ ...line, unitPriceMinor: "3000000000" }] })).invoice;
      for (const sale of [legacy, exact]) {
        assert.equal(sale.status, "pending_approval"); assert.equal(sale.subtotalMinor, "3000000000");
        assert.equal(sale.taxTotal, 300000000); assert.equal(sale.totalMinor, "3300000000");
      }
      // Editing the configuration cannot change already saved invoice tax.
      await client.ok("update_tax_rate", { taxRateId: rate.id, rate: 2000 });
      const pending = await db.select().from(approvalRequest).where(eq(approvalRequest.organizationId, org.id));
      for (const sale of [legacy, exact]) {
        const approval = pending.find(row => row.entityId === sale.id)!;
        if (sale.id === legacy.id) {
          await data(await approvalAction(request({ action: "approve" }, i), params(approval.id)));
          const sent = (await data(await sendInvoice(request({}, i), params(sale.id)))).invoice;
          await balanced(sent.journalEntryId, 3300000000n, org.defaultCurrency);
        } else {
          await client.ok("approve_request", { requestId: approval.id });
          const sent = (await client.ok("send_invoice", { invoiceId: sale.id })).invoice;
          await balanced(sent.journalEntryId, 3300000000n, org.defaultCurrency);
        }
      }
      const periodBody = { name: "Combined month", type: "monthly", startDate: "2026-01-01", endDate: "2026-01-31" };
      const period = (i % 2 ? await client.ok("create_tax_period", periodBody) : await data(await createPeriod(request(periodBody, i)), 201)).taxPeriod;
      // Every configuration domain rejects tenant controls through full SDK registration.
      const mutationPairs = [
        ["update_organization_mileage_rate", { mileageRateMinor: "1" }], ["update_organization", { peppolId: "denied" }],
        ["create_tax_rate", { name: "denied", rate: 1000 }], ["apply_tax_profile", { country: "GB" }],
        ["save_tax_jurisdiction", { country: "GB", combinedRate: 1000 }], ["create_approval_workflow", workflowBody],
        ["create_tax_period", periodBody], ["file_tax_period", { taxPeriodId: period.id }],
        ["record_vat_settlement", { bankGlAccountId: bank.id, amountMinor: "1" }],
      ] as const;
      for (const [name, args] of mutationPairs) await unchanged(async () => {
        assert.equal((await client.call(name, { ...args, organizationId: orgs[(i + 1) % 4].id })).isError, true, name);
        assert.equal((await ro.call(name, args)).isError, true, name);
      });
      await unchanged(async () => {
        for (const [name, args] of [["get_tax_rate", { taxRateId: rate.id }], ["get_approval_workflow", { workflowId: workflow.id }],
          ["get_tax_period", { taxPeriodId: period.id }]] as const) assert.equal((await foreign.call(name, args)).body.status, 404);
        await data(await getRate(request(undefined, (i + 1) % 4), params(rate.id)), 404);
        await data(await getWorkflow(request(undefined, (i + 1) % 4), params(workflow.id)), 404);
        await data(await getPeriod(request(undefined, (i + 1) % 4), params(period.id)), 404);
        await data(await mileage(request({ mileageRate: 1, mileageRateMinor: "2" }, i)), 400);
        assert.equal((await client.call("update_organization_mileage_rate", { mileageRateMinor: "9007199254740992" })).body.status, 422);
        await data(await updateRate(request({ rateMinor: "1000" }, i), params(rate.id)), 400);
        await data(await createWorkflow(request({ ...workflowBody, conditions: [{ field: "total", operator: "gte", valueMinor: "01" }] }, i)), 400);
        await data(await updateOrganization(request({ defaultCurrency: "EUR" }, i)), 409);
        await data(await mileage(request({ mileageRate: 1 }, 4)), 403);
        await data(await createRate(request({ name: "denied", rate: 1000 }, 4)), 403);
        await data(await createWorkflow(request(workflowBody, 4)), 403);
        await data(await file(request({}, 4), params(period.id)), 403);
      });
      // Required audit faults leave configuration, frozen boxes, journals and status intact.
      await db.execute(sql`alter table audit_log add constraint config_fixture_fault check (false) not valid`);
      try {
        await unchanged(async () => {
          await data(await mileage(request({ mileageRate: 1 }, i)), 500);
          assert.equal((await client.call("update_tax_rate", { taxRateId: rate.id, rate: 4000 })).isError, true);
          assert.equal((await client.call("update_approval_workflow", { workflowId: workflow.id, name: "rollback" })).isError, true);
          await data(await file(request({}, i), params(period.id)), 500);
          assert.equal((await client.call("file_tax_period", { taxPeriodId: period.id })).isError, true);
        });
      } finally { await db.execute(sql`alter table audit_log drop constraint config_fixture_fault`); }
      const filed = i % 2 ? await data(await file(request({}, i), params(period.id))) : await client.ok("file_tax_period", { taxPeriodId: period.id });
      assert.equal(filed.currencyCode, org.defaultCurrency); assert.equal(filed.outputVatMinor, "600000000");
      assert.equal(filed.inputVatMinor, "0"); assert.equal(filed.net, 600000000); assert.equal(filed.netMinor, "600000000");
      assert.equal(filed.filedLines.find((row: { boxNumber: string }) => row.boxNumber === "5").amountMinor, "600000000");
      await balanced(filed.clearingJournalEntryId, 600000000n, org.defaultCurrency);
      assert.deepEqual(await client.ok("get_tax_period", { taxPeriodId: period.id }), await data(await getPeriod(request(undefined, i), params(period.id))));
      await unchanged(async () => { assert.equal((await client.call("file_vat_return", { taxPeriodId: period.id })).isError, true); });
      await db.execute(sql`alter table audit_log add constraint config_fixture_fault check (false) not valid`);
      try {
        await unchanged(async () => { assert.equal((await client.call("record_vat_settlement", { taxPeriodId: period.id, bankGlAccountId: bank.id, amountMinor: "600000000", date: "2026-02-01" })).isError, true); });
      } finally { await db.execute(sql`alter table audit_log drop constraint config_fixture_fault`); }
      const payment = await data(await file(request({ mode: "settle", bankGlAccountId: bank.id, amount: 300000000, date: "2026-02-01" }, i), params(period.id)));
      const remainder = await client.ok("record_vat_settlement", { taxPeriodId: period.id, bankGlAccountId: bank.id, amountMinor: "300000000", date: "2026-02-02" });
      for (const settlement of [payment, remainder]) { assert.equal(settlement.amountMinor, "300000000"); await balanced(settlement.settlementJournalEntryId, 300000000n, org.defaultCurrency); }
      const controls = await db.execute(sql`select c.code, coalesce(sum(l.debit_amount-l.credit_amount),0)::text as balance
        from chart_account c left join journal_line l on l.account_id=c.id where c.organization_id=${org.id}
        and c.code in ('2200','2240','1100') group by c.code`);
      assert.deepEqual(Object.fromEntries(controls.rows.map(row => [row.code, row.balance])), { "1100": "-600000000", "2200": "0", "2240": "0" });
      assert.equal((await client.ok("get_organization")).organization.mileageRateMinor, "1250");
      await client.ok("delete_tax_jurisdiction", { jurisdictionId: jurisdiction.jurisdiction.id });
    }
    console.log("Combined configuration contracts verified");
  } finally { await Promise.all([...clients, ro].map(client => client.close())); }
}
try { await run(); } finally { await (db.$client as unknown as { end: () => Promise<void> }).end(); }
