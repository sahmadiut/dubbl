import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, contact, taxRate, purchaseOrder, purchaseOrderLine, bill } from "../../lib/db/schema";
import { registerPurchaseOrderTools } from "../../lib/mcp/tools/purchase-orders";
import { registerPurchaseRequisitionTools } from "../../lib/mcp/tools/purchase-requisitions";
import { registerGoodsReceiptTools } from "../../lib/mcp/tools/goods-receipts";
import { POST as createOrder, GET as listOrders } from "../../app/api/v1/purchase-orders/route";
import { GET as getOrder, PATCH as editOrder } from "../../app/api/v1/purchase-orders/[id]/route";
import { POST as sendOrder } from "../../app/api/v1/purchase-orders/[id]/send/route";
import { POST as convertOrder } from "../../app/api/v1/purchase-orders/[id]/convert/route";
import { POST as createRequisition } from "../../app/api/v1/purchase-requisitions/route";
import { GET as getRequisition, PUT as submitRequisition } from "../../app/api/v1/purchase-requisitions/[id]/route";
import { POST as approveRequisition } from "../../app/api/v1/purchase-requisitions/[id]/approve/route";
import { POST as convertRequisition } from "../../app/api/v1/purchase-requisitions/[id]/convert/route";
import { POST as receiveGoods, GET as listReceipts } from "../../app/api/v1/goods-receipts/route";
import { GET as getReceipt } from "../../app/api/v1/goods-receipts/[id]/route";
import { POST as billReceipt } from "../../app/api/v1/goods-receipts/[id]/create-bill/route";
import { procurementEditorLines, procurementPreview, procurementDocument, procurementList, procurementReceipt,
  procurementReceiveLines, procurementEditPrice, procurementOverview } from "../../lib/money/procurement-ui";

async function run() {
  const [owner] = await db.insert(users).values({ email: "procurement-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Procurement ${currencyCode}`, slug: `procurement-${currencyCode.toLowerCase()}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    const token = `dk_procurement_ui_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "Fixture", keyPrefix: "dk_proc", keyHash: createHash("sha256").update(token).digest("hex") });
    const [supplier] = await db.insert(contact).values({ organizationId: org.id, name: "Supplier", type: "supplier", currencyCode: "JPY" }).returning();
    const [tax] = await db.insert(taxRate).values({ organizationId: org.id, name: "VAT", rate: 1000 }).returning();
    const server = new McpServer({ name: "Procurement UI fixture", version: "1.0.0" }), client = new Client({ name: "Fixture", version: "1.0.0" });
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    registerPurchaseOrderTools(server, ctx); registerPurchaseRequisitionTools(server, ctx); registerGoodsReceiptTools(server, ctx);
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const mcp = async (name: string, args: Record<string, unknown>) => {
      const response = await client.callTool({ name, arguments: args });
      const text = (response.content as { type: string; text: string }[])[0].text;
      assert.equal(response.isError === true, false, text); return JSON.parse(text);
    };
    const request = (method: string, body?: unknown) => new Request("http://fixture.test/api/v1/procurement", { method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const rest = async (response: Promise<Response>) => { const res = await response, data = await res.json(); assert.ok(res.ok, JSON.stringify(data)); return data; };
    const price = currencyCode === "USD" ? "12.50" : currencyCode === "KWD" ? "1.250" : "1250";
    const uiLines = [{ description: "Service", quantity: "1.25", unitPrice: price, accountId: "", taxRateId: tax.id }];
    try {
      for (const transport of ["rest", "mcp"] as const) {
        const preview = procurementPreview(uiLines, currencyCode, [{ id: tax.id, rate: 1000 }]); assert.equal(preview.error, null);
        const input = { contactId: supplier.id, issueDate: "2026-10-11", deliveryDate: "2026-10-15", reference: "UI", notes: "Fixture", currencyCode,
          lines: procurementEditorLines(uiLines, "purchaseOrder") };
        const created = transport === "rest" ? await rest(createOrder(request("POST", input))) : await mcp("create_purchase_order", input);
        const id = created.purchaseOrder.id;
        const read = (await rest(getOrder(request("GET"), params(id)))).purchaseOrder;
        const adopted = procurementDocument(read);
        assert.equal(adopted.total, preview.total); assert.equal(adopted.lines[0].amount, preview.lines[0].amountMinor);
        const mcRead = (await mcp("get_purchase_order", { purchaseOrderId: id })).purchaseOrder;
        assert.equal(procurementDocument(mcRead).total, adopted.total);
        const exactSql = (await db.execute(sql`select total::text, subtotal::text, tax_total::text from purchase_order where id=${id}`)).rows[0];
        assert.equal(exactSql.total, String(preview.total)); assert.equal(exactSql.tax_total, String(preview.taxTotal));
        const editedLines = [{ ...uiLines[0], unitPrice: procurementEditPrice(adopted.lines[0].unitPrice, currencyCode) }];
        const patch = { lines: procurementEditorLines(editedLines, "purchaseOrderUpdate") };
        const editPreview = procurementPreview(editedLines, currencyCode, [], "purchaseOrderUpdate");
        const edited = transport === "rest" ? await rest(editOrder(request("PATCH", patch), params(id))) : await mcp("update_purchase_order", { purchaseOrderId: id, ...patch });
        assert.equal(BigInt(edited.purchaseOrder.totalMinor), editPreview.total); assert.equal(edited.purchaseOrder.taxTotalMinor, "0");
        if (transport === "rest") await rest(sendOrder(request("POST", {}), params(id))); else await mcp("send_purchase_order", { purchaseOrderId: id });
        const sent = procurementDocument((await rest(getOrder(request("GET"), params(id)))).purchaseOrder);
        const quantities = procurementReceiveLines(sent.lines as { id: string; quantity: number; quantityReceived: number }[]);
        const receiveInput = { purchaseOrderId: id, date: "2026-10-11", lines: quantities };
        const received = transport === "rest" ? await rest(receiveGoods(request("POST", receiveInput))) : await mcp("receive_goods_receipt", receiveInput);
        const receiptId = received.goodsReceipt.id;
        const rawReceipt = (await rest(getReceipt(request("GET"), params(receiptId)))).goodsReceipt;
        const receipt = procurementReceipt(rawReceipt);
        assert.equal(receipt.lines[0].quantityReceived, 125);
        assert.equal(procurementReceipt((await mcp("get_goods_receipt", { goodsReceiptId: receiptId })).goodsReceipt).total, receipt.total);
        const draft = transport === "rest" ? await rest(billReceipt(request("POST"), params(receiptId))) : await mcp("create_bill_from_goods_receipt", { goodsReceiptId: receiptId });
        assert.equal(BigInt(draft.bill.totalMinor), receipt.total); assert.equal(draft.bill.currencyCode, currencyCode);
        const savedBill = (await db.execute(sql`select total::text from bill where id=${draft.bill.id}`)).rows[0]; assert.equal(savedBill.total, String(receipt.total));
        const tallies = (await db.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, id)))[0];
        assert.equal(tallies.quantityReceived, 125); assert.equal(tallies.quantityBilled, 0); // Receipt drafts reserve no billed quantity until recognition.

        const reqPreview = procurementPreview(uiLines, currencyCode, [], "requisition");
        const reqInput = { contactId: supplier.id, requestDate: "2026-10-11", requiredDate: "2026-10-15", currencyCode, lines: procurementEditorLines(uiLines, "requisition") };
        const reqCreated = transport === "rest" ? await rest(createRequisition(request("POST", reqInput))) : await mcp("create_purchase_requisition", reqInput);
        const reqId = reqCreated.requisition.id;
        const reqRead = procurementDocument(await rest(getRequisition(request("GET"), params(reqId)))); assert.equal(reqRead.total, reqPreview.total);
        assert.equal(procurementDocument((await mcp("get_purchase_requisition", { requisitionId: reqId })).requisition).total, reqRead.total);
        if (transport === "rest") { await rest(submitRequisition(request("PUT", { status: "submitted" }), params(reqId))); await rest(approveRequisition(request("POST"), params(reqId))); }
        else { await mcp("submit_purchase_requisition", { requisitionId: reqId }); await mcp("approve_purchase_requisition", { requisitionId: reqId }); }
        const reqConverted = transport === "rest" ? await rest(convertRequisition(request("POST"), params(reqId))) : await mcp("convert_purchase_requisition", { requisitionId: reqId });
        assert.equal(reqConverted.purchaseOrder.currencyCode, currencyCode); assert.equal(BigInt(reqConverted.purchaseOrder.totalMinor), reqRead.total);
        const convertedId = reqConverted.purchaseOrder.id;
        if (transport === "rest") await rest(sendOrder(request("POST", {}), params(convertedId))); else await mcp("send_purchase_order", { purchaseOrderId: convertedId });
        const poBill = transport === "rest" ? await rest(convertOrder(request("POST", {}), params(convertedId))) : await mcp("convert_po_to_bill", { purchaseOrderId: convertedId });
        assert.equal(BigInt(poBill.bill.totalMinor), reqRead.total); assert.equal(poBill.bill.currencyCode, currencyCode);
        const reserved = (await db.select().from(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, convertedId)))[0];
        assert.equal(reserved.quantityBilled, 125); // Direct PO conversion reserves quantities on draft creation.

        const halfPrice = currencyCode === "USD" ? "0.01" : currencyCode === "KWD" ? "0.001" : "1";
        const halfLines = [0, 1].map(i => ({ description: `Half ${i}`, quantity: "0.5", unitPrice: halfPrice, accountId: "", taxRateId: "" }));
        const halfInput = { contactId: supplier.id, issueDate: "2026-10-11", currencyCode, lines: procurementEditorLines(halfLines, "purchaseOrder") };
        const halfOrder = transport === "rest" ? await rest(createOrder(request("POST", halfInput))) : await mcp("create_purchase_order", halfInput);
        assert.equal(halfOrder.purchaseOrder.totalMinor, "2");
        if (transport === "rest") await rest(sendOrder(request("POST", {}), params(halfOrder.purchaseOrder.id))); else await mcp("send_purchase_order", { purchaseOrderId: halfOrder.purchaseOrder.id });
        const halfRead = (await rest(getOrder(request("GET"), params(halfOrder.purchaseOrder.id)))).purchaseOrder;
        const halfReceiptInput = { purchaseOrderId: halfRead.id, date: "2026-10-11", lines: procurementReceiveLines(halfRead.lines) };
        const halfReceipt = transport === "rest" ? await rest(receiveGoods(request("POST", halfReceiptInput))) : await mcp("receive_goods_receipt", halfReceiptInput);
        const halfReceiptRead = (await rest(getReceipt(request("GET"), params(halfReceipt.goodsReceipt.id)))).goodsReceipt;
        assert.equal(procurementReceipt(halfReceiptRead).total, 2n);
        const halfBill = transport === "rest" ? await rest(billReceipt(request("POST"), params(halfReceipt.goodsReceipt.id))) : await mcp("create_bill_from_goods_receipt", { goodsReceiptId: halfReceipt.goodsReceipt.id });
        assert.equal(halfBill.bill.totalMinor, "2");
      }
      const safePrice = currencyCode === "USD" ? "90071992547409.91" : currencyCode === "KWD" ? "9007199254740.991" : "9007199254740991";
      const safe = await rest(createOrder(request("POST", { contactId: supplier.id, issueDate: "2026-10-11", currencyCode,
        lines: procurementEditorLines([{ ...uiLines[0], taxRateId: "", quantity: "1", unitPrice: safePrice }], "purchaseOrder") })));
      assert.equal(safe.purchaseOrder.totalMinor, "9007199254740991");
      assert.equal(procurementDocument((await rest(getOrder(request("GET"), params(safe.purchaseOrder.id)))).purchaseOrder).total, 9007199254740991n);
      const listed = (await rest(listOrders(request("GET")))).data.map(procurementList);
      assert.ok(procurementOverview(listed).some(group => group.currencyCode === currencyCode));
      const receipts = (await rest(listReceipts(request("GET")))).data.map(procurementReceipt); assert.equal(receipts.length, 4);
      // Omitted currency still defaults USD despite the org/supplier settings.
      const defaulted = await rest(createOrder(request("POST", { contactId: supplier.id, issueDate: "2026-10-11", lines: procurementEditorLines([{ ...uiLines[0], taxRateId: "", quantity: "1" }], "purchaseOrder") })));
      assert.equal(defaulted.purchaseOrder.currencyCode, "USD");
      const before = (await db.select().from(purchaseOrder).where(eq(purchaseOrder.organizationId, org.id))).length;
      const invalid = await createOrder(request("POST", { contactId: supplier.id, issueDate: "2026-10-11", lines: [{ description: "Bad", unitPriceExact: "1x" }] })); assert.equal(invalid.status, 400);
      assert.equal((await db.select().from(purchaseOrder).where(eq(purchaseOrder.organizationId, org.id))).length, before);
      assert.ok((await db.select().from(bill).where(eq(bill.organizationId, org.id))).length > 0);
    } finally { await client.close(); await server.close(); }
  }
  process.stdout.write("Procurement UI REST MCP SQL verified\n");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
