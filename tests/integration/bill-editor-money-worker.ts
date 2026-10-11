import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, contact, chartAccount, taxRate, billLine } from "../../lib/db/schema";
import { POST as createBill } from "../../app/api/v1/bills/route";
import { GET as getBill } from "../../app/api/v1/bills/[id]/route";
import { GET as getContact } from "../../app/api/v1/contacts/[id]/route";
import { GET as getOrganization } from "../../app/api/v1/organization/route";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import { billEditorPreview, billEditorCurrency } from "../../lib/money/bill-editor";

async function run() {
  const [org] = await db.insert(organization).values({ name: "Bill UI", slug: "bill-ui", defaultCurrency: "KWD" }).returning();
  const [user] = await db.insert(users).values({ email: "bill-ui@example.test" }).returning();
  await db.insert(member).values({ organizationId: org.id, userId: user.id, role: "owner" });
  const key = "dk_bill_ui_fixture";
  await db.insert(apiKey).values({ organizationId: org.id, createdBy: user.id, name: "UI fixture",
    keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_bill" });
  const [supplier, inherited] = await db.insert(contact).values([
    { organizationId: org.id, name: "Supplier JPY", type: "supplier", currencyCode: "JPY" },
    { organizationId: org.id, name: "Supplier org", type: "supplier", currencyCode: null },
  ]).returning();
  const [account] = await db.insert(chartAccount).values({ organizationId: org.id, name: "Expense", code: "500", type: "expense" }).returning();
  const [standard, reverse] = await db.insert(taxRate).values([
    { organizationId: org.id, name: "10%", rate: 1000 },
    { organizationId: org.id, name: "20% RC", rate: 2000, kind: "reverse_charge" },
  ]).returning();
  const rates = [standard, reverse];
  const row = (unitPrice: string, quantity = "1", taxRateId = "") => ({ description: "Supplier item", unitPrice, quantity, accountId: account.id, taxRateId });
  const server = new McpServer({ name: "Bill UI fixture", version: "1" });
  registerBillTools(server, { organizationId: org.id, userId: user.id, role: "owner" });
  const client = new Client({ name: "UI fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  const request = (body?: unknown) => new Request("http://fixture.test/api/v1/bills", {
    method: body ? "POST" : "GET", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-organization-id": org.id },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function ok(response: Response) {
    const body = await response.json(); assert.ok(response.ok, JSON.stringify(body)); return body;
  }
  async function mcp(payload: Record<string, unknown>) {
    const result = await client.callTool({ name: "create_bill", arguments: payload });
    assert.equal(result.isError, undefined, JSON.stringify(result.content));
    return JSON.parse((result.content as { text: string }[])[0].text);
  }
  try {
    const orgData = await ok(await getOrganization(request()));
    for (const [contactRow, expectedCode, price, expected] of [
      [supplier, "JPY", "1250", "1250"], [inherited, "KWD", "1.251", "1251"],
    ] as const) {
      const supplierData = await ok(await getContact(request(), { params: Promise.resolve({ id: contactRow.id }) }));
      const code = billEditorCurrency(null, supplierData.contact.currencyCode, orgData.organization.defaultCurrency);
      assert.equal(code, expectedCode);
      const preview = billEditorPreview([row(price)], code, rates);
      const saved = await ok(await createBill(request({ contactId: contactRow.id, issueDate: "2026-10-11", dueDate: "2026-11-11", lines: preview.inputs })));
      assert.equal(saved.bill.currencyCode, code); assert.equal(saved.bill.totalMinor, expected);
    }
    for (const [currencyCode, lines, expected] of [
      ["USD", [row("90071992547409.91")], "9007199254740991"],
      ["JPY", [row("1250")], "1250"], ["IRR", [row("1250")], "1250"], ["KWD", [row("1.251")], "1251"],
      ["USD", [row("0.005", "3")], "2"], ["USD", [row("-0.005", "3")], "-1"],
      ["USD", [row("0.10", "1", standard.id), row("0.20", "1", standard.id)], "33"],
      ["USD", [row("40000000000000.01"), row("0.02")], "4000000000000003"],
      ["USD", [row("1.005", "1.25", standard.id)], "139"],
      ["USD", [row("100", "1", reverse.id), row("10", "1", standard.id)], "13100"],
      ["USD", [row("5", "0"), row("", "")], "0"],
    ] as const) {
      const preview = billEditorPreview(lines, currencyCode, rates);
      assert.equal(preview.error, null); assert.equal(String(preview.total), expected);
      const payload = { contactId: supplier.id, issueDate: "2026-10-11", dueDate: "2026-11-11", currencyCode,
        reference: "UI exact", notes: "Preserve controls", lines: preview.inputs };
      const rest = await ok(await createBill(request(payload)));
      const viaMcp = await mcp(payload);
      for (const saved of [rest.bill, viaMcp.bill]) {
        assert.equal(saved.currencyCode, currencyCode); assert.equal(saved.totalMinor, expected);
        assert.equal(saved.subtotalMinor, String(preview.subtotal)); assert.equal(saved.taxTotalMinor, String(preview.taxTotal));
        assert.equal(saved.amountDueMinor, String(preview.amountDue));
        const read = await ok(await getBill(request(), { params: Promise.resolve({ id: saved.id }) }));
        assert.equal(read.bill.totalMinor, expected); assert.equal(read.bill.amountDueMinor, String(preview.amountDue));
        const raw = await db.select({ price: sql<string>`${billLine.unitPrice}::text`, amount: sql<string>`${billLine.amount}::text`,
          tax: sql<string>`${billLine.taxAmount}::text`, quantity: billLine.quantity, accountId: billLine.accountId, taxId: billLine.taxRateId })
          .from(billLine).where(eq(billLine.billId, saved.id)).orderBy(billLine.sortOrder);
        assert.equal(raw.reduce((sum, line) => sum + BigInt(line.amount), 0n), preview.subtotal);
        assert.equal(raw.reduce((sum, line) => sum + BigInt(line.tax), 0n), preview.taxTotal);
        raw.forEach((line, i) => {
          assert.equal(line.price, String(preview.lines[i].priceMinor));
          assert.equal(line.accountId, account.id); assert.equal(line.taxId, lines[i].taxRateId || null);
        });
        if (lines[0].quantity === "1.25") assert.equal(raw[0].quantity, 125);
        if (lines[0].quantity === "0") assert.equal(raw[0].quantity, 0);
      }
    }
    const payload = { contactId: supplier.id, issueDate: "2026-10-11", dueDate: "2026-11-11", currencyCode: "JPY",
      billNumber: "UI-duplicate", lines: billEditorPreview([row("1250")], "JPY", rates).inputs };
    await ok(await createBill(request(payload)));
    const warning = await createBill(request(payload)); assert.equal(warning.status, 409);
    assert.equal((await warning.json()).warning, "duplicate_bill");
    const confirmed = await ok(await createBill(request({ ...payload, confirmDuplicate: true })));
    assert.equal(confirmed.bill.totalMinor, "1250");
    const approved = await mcp({ ...payload, billNumber: "UI-approval", submitForApproval: true });
    assert.equal(approved.bill.status, "pending_approval"); assert.equal(approved.bill.totalMinor, "1250");
    await db.update(organization).set({ duplicateBillStrategy: "block" }).where(eq(organization.id, org.id));
    assert.equal((await createBill(request({ ...payload, confirmDuplicate: true }))).status, 409);
    await db.update(organization).set({ duplicateBillStrategy: "hold" }).where(eq(organization.id, org.id));
    const held = await ok(await createBill(request({ ...payload, confirmDuplicate: true })));
    assert.equal(held.held, true); assert.equal(held.bill.status, "pending_approval");
    assert.equal(held.bill.amountDueMinor, "1250");
    console.log("Bill editor stored totals verified");
  } finally { await client.close(); await server.close(); }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
