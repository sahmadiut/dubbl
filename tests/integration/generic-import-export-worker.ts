import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { apiKey, bankAccount, bankTransaction, bill, billLine, chartAccount, contact, customRole, inventoryItem, invoice, invoiceLine, journalEntry, journalLine, member, organization, users } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";
import { registerAllTools } from "../../lib/mcp/tools";
import { parseCSV } from "../../lib/import-export/csv-utils";
import * as accounts from "../../app/api/v1/bulk/accounts/import/route";
import * as contacts from "../../app/api/v1/bulk/contacts/import/route";
import * as products from "../../app/api/v1/bulk/products/import/route";
import * as accountPreview from "../../app/api/v1/bulk/accounts/preview/route";
import * as contactPreview from "../../app/api/v1/bulk/contacts/preview/route";
import * as productPreview from "../../app/api/v1/bulk/products/preview/route";
import { GET as jobs } from "../../app/api/v1/bulk/import-jobs/route";
import { GET as exportAccounts } from "../../app/api/v1/export/accounts/route";
import { GET as exportContacts } from "../../app/api/v1/export/contacts/route";
import { GET as exportProducts } from "../../app/api/v1/export/products/route";
import { GET as exportInvoices } from "../../app/api/v1/export/invoices/route";
import { GET as exportBills } from "../../app/api/v1/export/bills/route";
import { GET as exportEntries } from "../../app/api/v1/export/entries/route";
import { GET as exportBank } from "../../app/api/v1/export/bank-transactions/route";
import { GET as exportAll } from "../../app/api/v1/export/all/route";

async function connect(ctx: AuthContext) {
  const server = new McpServer({ name: "Generic import/export fixture", version: "1" }); registerAllTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  return { tools: (await client.listTools()).tools, async call(name: string, input: object = {}) {
    const r = await client.callTool({ name, arguments: { ...input } }); const text = (r.content as { text: string }[])[0].text;
    return { error: r.isError === true, body: text.startsWith("{") ? JSON.parse(text) : { error: text } };
  }, async close() { await client.close(); await server.close(); } };
}
function zipFiles(buffer: Uint8Array) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength), files: Record<string, string> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true), nameLength = view.getUint16(at + 26, true), extraLength = view.getUint16(at + 28, true);
    const dataAt = at + 30 + nameLength + extraLength;
    files[new TextDecoder().decode(buffer.slice(at + 30, at + 30 + nameLength))] = new TextDecoder().decode(buffer.slice(dataAt, dataAt + size));
    at = dataAt + size;
  }
  return files;
}
async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Generic A", slug: "generic-a" }, { name: "Generic B", slug: "generic-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "generic-owner@example.test" }, { email: "generic-denied@example.test" }]).returning();
  const [role] = await db.insert(customRole).values({ organizationId: a.id, name: "No grants", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: denied.id, role: "member", customRoleId: role.id }]);
  const keys = { a: "dk_generic_a", b: "dk_generic_b", denied: "dk_generic_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "b" ? b.id : a.id,
    createdBy: label === "denied" ? denied.id : owner.id, name: label, keyPrefix: "dk_generic", keyHash: createHash("sha256").update(key).digest("hex") });
  const ctx: AuthContext = { organizationId: a.id, userId: owner.id, role: "owner" };
  const ma = await connect(ctx), mb = await connect({ ...ctx, organizationId: b.id }), no = await connect({ ...ctx, userId: denied.id, role: "member", permissions: [] });
  const req = (path: string, key = keys.a, body?: object) => new Request(`http://fixture.test/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": b.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const body = async (r: Response, status = 200) => { const data = await r.json(); assert.equal(r.status, status, JSON.stringify(data)); return data; };
  const good = async (name: string, args: object = {}) => { const r = await ma.call(name, args); assert.equal(r.error, false, JSON.stringify(r)); return r.body; };
  const tables = ["chart_account", "contact", "inventory_item", "inventory_movement", "inventory_cost_layer", "journal_entry", "journal_line", "bulk_import_job", "audit_log", "invoice", "invoice_line", "bill", "bill_line", "bank_account", "bank_transaction"];
  const snapshot = async () => (await db.execute(sql.raw(tables.map(n => `select '${n}' as name, coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as rows from "${n}" t`).join(" union all ")))).rows;
  const unchanged = async (fn: () => Promise<unknown>) => { const before = await snapshot(); await fn(); assert.deepEqual(await snapshot(), before); };
  try {
    for (const name of ["get_import_template", "import_csv_data", "preview_csv_import_rows", "export_csv_data", "export_all_csv_data", "list_import_jobs", "import_journal_entries", "preview_journal_entries"]) {
      const tool = ma.tools.find(t => t.name === name)!; assert.equal(tool.inputSchema.additionalProperties, false, name);
      for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description, name);
    }
    const template = await good("get_import_template", { source: "quickbooks", entityType: "products" });
    assert.ok(template.columns.some((c: { field: string }) => c.field === "unitPriceMinor"));
    const direct = [
      { entity: "accounts", import: accounts.POST, preview: accountPreview.POST, row: { code: "8000", name: "Imported account", type: "Expense" }, csv: 'Account #,Account Name,Account Type\n8001,Imported MCP,Expense' },
      { entity: "contacts", import: contacts.POST, preview: contactPreview.POST, row: { name: 'Contact, "one"\ncontinued', type: "vendor" }, csv: 'Display Name,Type,Billing City\nMCP contact,vendor,Tehran' },
      { entity: "products", import: products.POST, preview: productPreview.POST, row: { name: "Legacy product", sku: "GENERIC-1", unitPrice: 0.29, costPrice: "12.50" }, csv: 'Item Name,SKU,unitPriceMinor,costPriceMinor\nMCP product,GENERIC-2,2147483750,29' },
    ];
    for (const spec of direct) {
      const input = { fileName: "source.csv", source: "quickbooks", rows: [spec.row] }, previewInput = { source: input.source, rows: input.rows };
      const preview = await body(await spec.preview(req(`bulk/${spec.entity}/preview`, keys.a, previewInput)));
      assert.deepEqual(preview, await good("preview_csv_import_rows", { entityType: spec.entity, ...previewInput }));
      assert.equal(preview.validCount, 1);
      assert.equal((await body(await spec.import(req(`bulk/${spec.entity}/import`, keys.a, input)), 201)).job.processedRows, 1);
      assert.equal((await good("import_csv_data", { entityType: spec.entity, source: "quickbooks", csvContent: spec.csv })).processedRows, 1);
      await unchanged(async () => {
        assert.equal((await spec.import(req("bulk/import", "dk_invalid", input))).status, 401);
        assert.equal((await spec.import(req("bulk/import", keys.denied, input))).status, 403);
        assert.equal((await spec.preview(req("bulk/preview", keys.denied, previewInput))).status, 403);
        assert.equal((await no.call("import_csv_data", { entityType: spec.entity, csvContent: spec.csv })).body.status, 403);
        assert.equal((await no.call("preview_csv_import_rows", { entityType: spec.entity, ...previewInput })).body.status, 403);
        assert.equal((await spec.import(req("bulk/import", keys.a, { ...input, organizationId: b.id }))).status, 400);
        assert.equal((await ma.call("import_csv_data", { entityType: spec.entity, csvContent: spec.csv, organizationId: b.id })).error, true);
      });
    }
    const productRows = await db.query.inventoryItem.findMany({ where: eq(inventoryItem.organizationId, a.id) });
    assert.equal(productRows.find(p => p.sku === "GENERIC-1")!.salePrice, 29);
    assert.equal(productRows.find(p => p.sku === "GENERIC-2")!.salePrice, 2147483750);
    await body(await products.POST(req("bulk/products/import", keys.a, { fileName: "exact.csv", rows: [{ name: "REST exact", sku: "REST-EXACT", unitPriceMinor: "9007199254740991", costPriceMinor: "1250" }] })), 201);
    assert.equal((await good("import_csv_data", { entityType: "products", csvContent: "name,sku,unitPrice,unitPriceMinor\nMCP decimal,MCP-DECIMAL,0.29,29" })).processedRows, 1);
    await unchanged(async () => {
      for (const [entity, handler, row] of [["accounts", accounts.POST, { code: "BAD", name: "Bad", type: "unknown" }], ["contacts", contacts.POST, { name: "Bad", type: "unknown" }]] as const) {
        await body(await handler(req("bulk/import", keys.a, { fileName: "bad.csv", rows: [row] })), 400);
        assert.equal((await ma.call("import_csv_data", { entityType: entity, csvContent: `${Object.keys(row).join(",")}\n${Object.values(row).join(",")}` })).error, true);
      }
    });
    for (const row of [{ name: "Bad", unitPrice: "1.005" }, { name: "Bad", unitPriceMinor: "01" }, { name: "Bad", unitPrice: "0.29", unitPriceMinor: "30" }, { name: "Bad", quantityOnHand: 1 }, { name: "Bad", type: "inventory" }, { name: "Bad", quantityOnHand: "1.5" }, { name: "Bad", foreignId: b.id }]) await unchanged(async () => {
      await body(await products.POST(req("bulk/products/import", keys.a, { fileName: "bad.csv", rows: [row] })), 400);
      const csv = `${Object.keys(row).join(",")}\n${Object.values(row).join(",")}`;
      assert.equal((await ma.call("import_csv_data", { entityType: "products", csvContent: csv })).error, true);
    });
    await unchanged(async () => {
      await body(await products.POST(req("bulk/products/import", keys.a, { fileName: "bad.csv", rows: [{ name: "Bad", currencyCode: "EUR" }] })), 422);
      assert.equal((await ma.call("import_csv_data", { entityType: "products", csvContent: "name,currencyCode\nBad,EUR" })).body.status, 422);
      for (const row of [{ name: "Bad", unitPriceMinor: "9007199254740992" }, { name: "Bad", unitPrice: 2 ** 45 }, { name: "Bad", costPriceMinor: "9007199254740991", quantityOnHand: 2 }]) {
        const r = await body(await products.POST(req("bulk/products/import", keys.a, { fileName: "bad.csv", rows: [row] })), 422); assert.equal(r.code, "LEGACY_NUMERIC_RANGE");
      }
      assert.equal((await ma.call("import_csv_data", { entityType: "products", csvContent: "name,unitPriceMinor\nBad,9007199254740992" })).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("import_csv_data", { entityType: "invoices", csvContent: "name\nBad" })).error, true);
      assert.equal((await ma.call("import_csv_data", { entityType: "products", source: "unsupported", csvContent: "name\nBad" })).error, true);
      assert.equal((await ma.call("import_csv_data", { entityType: "products", csvContent: "name,name\nBad,Bad" })).error, true);
      await body(await products.POST(req("bulk/products/import", keys.a, { fileName: "empty.csv", rows: [] })), 400);
    });
    // Savepoints retain successes after a duplicate row; replays report duplicates.
    const partial = await body(await accounts.POST(req("bulk/accounts/import", keys.a, { fileName: "partial.csv", rows: [
      { code: "8100", name: "First", type: "expense" }, { code: "8100", name: "Duplicate", type: "expense" }, { code: "8101", name: "Last", type: "expense" },
    ] })), 201);
    assert.equal(partial.job.processedRows, 2); assert.equal(partial.job.errorRows, 1); assert.equal(partial.job.status, "completed");
    const replay = await good("import_csv_data", { entityType: "accounts", csvContent: "code,name,type\n8100,First,expense" }); assert.equal(replay.status, "failed");
    // Generic stock must use the established movement, valuation and GL path.
    await body(await products.POST(req("bulk/products/import", keys.a, { fileName: "stock.csv", rows: [{ name: "Opening", sku: "OPENING", costPriceMinor: "29", quantityOnHand: 3 }] })), 201);
    const stock = await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.code, "OPENING") });
    assert.equal(stock!.quantityOnHand, 3); assert.equal(stock!.totalValue, 87);
    const stockProof = await db.execute(sql`select count(*)::text as count, sum(debit_amount)::text as debit, sum(credit_amount)::text as credit from journal_line l join journal_entry e on e.id=l.journal_entry_id where e.source_id=${stock!.id}`);
    assert.deepEqual(stockProof.rows[0], { count: "2", debit: "87", credit: "87" });
    // Final import audit is part of the job transaction, including successful rows.
    await db.execute(sql.raw("create function reject_generic_audit() returns trigger language plpgsql as $$ begin if NEW.action='import' then raise exception 'fixture audit rejection'; end if; return NEW; end $$"));
    await db.execute(sql.raw("create trigger reject_generic_audit before insert on audit_log for each row execute function reject_generic_audit()"));
    await unchanged(async () => { await body(await contacts.POST(req("bulk/contacts/import", keys.a, { fileName: "rollback.csv", rows: [{ name: "Must roll back" }] })), 500); });
    await db.execute(sql.raw("drop trigger reject_generic_audit on audit_log"));
    const jobPage = await body(await jobs(req("bulk/import-jobs?limit=2&offset=1")));
    assert.deepEqual(jobPage.jobs, (await good("list_import_jobs", { limit: 2, offset: 1 })).jobs);
    assert.equal((await mb.call("list_import_jobs")).body.jobs.length, 0);
    await unchanged(async () => {
      for (const query of ["limit=1e2", "limit=0", "limit=2&limit=3", "organizationId=foreign", "offset=-1"]) await body(await jobs(req(`bulk/import-jobs?${query}`)), 400);
      assert.equal((await no.call("list_import_jobs")).body.status, 403);
      assert.equal((await no.call("get_import_template", { source: "custom", entityType: "products" })).body.status, 403);
    });
    // Seed historical signed amounts and different saved currencies without inferring scales.
    const [local, foreign] = await db.insert(contact).values([{ organizationId: a.id, name: "Local document contact" }, { organizationId: b.id, name: "FOREIGN_SECRET" }]).returning();
    const [account, foreignAccount] = await db.insert(chartAccount).values([{ organizationId: a.id, code: "9000", name: "Export account", type: "expense" }, { organizationId: b.id, code: "9999", name: "FOREIGN_SECRET", type: "expense" }]).returning();
    const [inv, outside] = await db.insert(invoice).values([{ organizationId: a.id, contactId: local.id, invoiceNumber: "JAN", issueDate: "2024-01-31", dueDate: "2024-02-01", currencyCode: "IRR", total: 1250 },
      { organizationId: a.id, contactId: local.id, invoiceNumber: "FEB", issueDate: "2024-02-01", dueDate: "2024-02-02", total: 500 }]).returning();
    await db.insert(invoiceLine).values({ invoiceId: inv.id, description: 'Line, "one"\ncontinued', quantity: 150, unitPrice: 29, amount: -1250, accountId: account.id });
    const [billRow] = await db.insert(bill).values({ organizationId: a.id, contactId: local.id, billNumber: "JAN", issueDate: "2024-01-31", dueDate: "2024-02-01", currencyCode: "KWD" }).returning();
    await db.insert(billLine).values({ billId: billRow.id, description: "Bill line", quantity: 100, unitPrice: Number.MAX_SAFE_INTEGER, amount: -1, accountId: account.id });
    const [entry] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 900, date: "2024-01-31", description: "Export journal" }).returning();
    await db.insert(journalLine).values({ journalEntryId: entry.id, accountId: account.id, debitAmount: -29, creditAmount: 0, currencyCode: "JPY" });
    const [bank, foreignBank, deletedBank] = await db.insert(bankAccount).values([{ organizationId: a.id, accountName: "Local bank", currencyCode: "IRR" }, { organizationId: b.id, accountName: "FOREIGN_SECRET" }, { organizationId: a.id, accountName: "DELETED_SECRET", deletedAt: new Date() }]).returning();
    const [txn] = await db.insert(bankTransaction).values([{ bankAccountId: bank.id, date: "2024-01-31", description: "Signed bank", amount: -Number.MAX_SAFE_INTEGER },
      { bankAccountId: foreignBank.id, date: "2024-01-31", description: "FOREIGN_SECRET", amount: 100 }, { bankAccountId: deletedBank.id, date: "2024-01-31", description: "DELETED_SECRET", amount: 100 }]).returning();
    const exports = [{ entity: "accounts", get: exportAccounts }, { entity: "contacts", get: exportContacts }, { entity: "products", get: exportProducts },
      { entity: "invoices", get: exportInvoices }, { entity: "bills", get: exportBills }, { entity: "entries", get: exportEntries }, { entity: "bank-transactions", get: exportBank }];
    const csvs: Record<string, string> = {};
    await unchanged(async () => {
      for (const spec of exports) {
        const transactional = ["invoices", "bills", "entries", "bank-transactions"].includes(spec.entity);
        const query = transactional ? "?startDate=2024-01-01&endDate=2024-01-31" : "";
        const response = await spec.get(req(`export/${spec.entity}${query}`)); assert.equal(response.status, 200);
        const csv = await response.text(); csvs[`${spec.entity}.csv`] = csv;
        const m = await good("export_csv_data", { entityType: spec.entity, ...(transactional ? { dateFrom: "2024-01-01", dateTo: "2024-01-31" } : {}) });
        assert.equal(m.csv, csv); assert.equal(m.rowCount, parseCSV(csv).rows.length);
        assert.doesNotMatch(csv, /FOREIGN_SECRET|DELETED_SECRET|FEB/);
        assert.equal((await spec.get(req("export/data", keys.denied))).status, 403);
        assert.equal((await spec.get(req("export/data", "dk_invalid"))).status, 401);
        assert.equal((await no.call("export_csv_data", { entityType: spec.entity })).body.status, 403);
        assert.equal((await ma.call("export_csv_data", { entityType: spec.entity, organizationId: b.id })).error, true);
        for (const query of ["startDate=2024-02-30", "startDate=2024-02-01&endDate=2024-01-01", "startDate=2024-01-01&startDate=2024-01-02", "unknown=1"]) assert.equal((await spec.get(req(`export/data?${query}`))).status, 400);
      }
      const invRows = parseCSV(csvs["invoices.csv"]).rows; assert.equal(invRows[0].lineAmount, "-12.50"); assert.equal(invRows[0].lineAmountMinor, "-1250"); assert.equal(invRows[0].lineQty, "1.50"); assert.equal(invRows[0].currencyCode, "IRR");
      const productExport = parseCSV(csvs["products.csv"]).rows;
      assert.equal(productExport.find(p => p.sku === "REST-EXACT")!.unitPrice, "90071992547409.91");
      assert.equal(productExport.find(p => p.sku === "MCP-DECIMAL")!.unitPriceMinor, "29");
      assert.equal(parseCSV(csvs["bills.csv"]).rows[0].lineUnitPrice, "90071992547409.91");
      assert.equal(parseCSV(csvs["entries.csv"]).rows[0].debit, "-0.29");
      assert.equal(parseCSV(csvs["bank-transactions.csv"]).rows[0].amount, "-90071992547409.91");
      assert.equal((await exportProducts(req("export/products?startDate=2024-01-01"))).status, 400);
      assert.equal((await ma.call("export_csv_data", { entityType: "products", dateFrom: "2024-01-01" })).body.status, 400);
      const reversed = await ma.call("export_csv_data", { entityType: "entries", dateFrom: "2024-02-01", dateTo: "2024-01-01" });
      assert.equal(reversed.error, true); assert.equal(reversed.body.error, "Validation error");
      const zip = await exportAll(req("export/all?startDate=2024-01-01&endDate=2024-01-31")); assert.equal(zip.status, 200);
      const files = zipFiles(new Uint8Array(await zip.arrayBuffer())); assert.deepEqual(files, csvs);
      const zipped = await good("export_all_csv_data", { startDate: "2024-01-01", endDate: "2024-01-31" }); assert.equal(zipped.fileCount, 7); assert.deepEqual(zipFiles(Buffer.from(zipped.data, "base64")), files);
      assert.equal((await exportAll(req("export/all", keys.denied))).status, 403); assert.equal((await no.call("export_all_csv_data")).body.status, 403);
      assert.doesNotMatch((await mb.call("export_csv_data", { entityType: "products" })).body.csv, /GENERIC|OPENING|MCP product/);
      const fallback = await exportInvoices(req("export/invoices?startDate=2024-02-01")); assert.equal(parseCSV(await fallback.text()).rows[0].lineAmountMinor, "500");
    });
    // Foreign labels fail visibly rather than traverse a cross-tenant relation.
    await db.update(invoice).set({ contactId: foreign.id }).where(eq(invoice.id, inv.id));
    await unchanged(async () => { assert.equal((await exportInvoices(req("export/invoices"))).status, 422); assert.equal((await ma.call("export_csv_data", { entityType: "invoices" })).body.status, 422); });
    await db.update(invoice).set({ contactId: local.id }).where(eq(invoice.id, inv.id));
    await db.update(journalLine).set({ accountId: foreignAccount.id }).where(eq(journalLine.journalEntryId, entry.id));
    await unchanged(async () => { assert.equal((await exportEntries(req("export/entries"))).status, 422); assert.equal((await ma.call("export_csv_data", { entityType: "entries" })).body.status, 422); });
    await db.update(journalLine).set({ accountId: account.id }).where(eq(journalLine.journalEntryId, entry.id));
    await db.update(invoiceLine).set({ accountId: foreignAccount.id }).where(eq(invoiceLine.invoiceId, inv.id));
    await unchanged(async () => { assert.equal((await exportInvoices(req("export/invoices"))).status, 422); assert.equal((await ma.call("export_csv_data", { entityType: "invoices" })).body.status, 422); });
    await db.update(invoiceLine).set({ accountId: account.id }).where(eq(invoiceLine.invoiceId, inv.id));
    await db.execute(sql`update bank_transaction set amount='9007199254740992'::bigint where id=${txn.id}`);
    await unchanged(async () => {
      assert.equal((await body(await exportBank(req("export/bank-transactions")), 422)).code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await ma.call("export_csv_data", { entityType: "bank-transactions" })).body.code, "LEGACY_NUMERIC_RANGE");
      assert.equal((await body(await exportAll(req("export/all")), 422)).code, "LEGACY_NUMERIC_RANGE");
    });
    assert.ok(outside.id);
    console.log("Generic import/export contracts verified");
  } finally { await ma.close(); await mb.close(); await no.close(); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
