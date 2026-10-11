// Only runs against the wrapper's randomly named, migrated disposable database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, subscription, apiKey, contact, chartAccount } from "../../lib/db/schema";
import { POST as createBill, GET as listBills } from "../../app/api/v1/bills/route";
import { GET as getBill } from "../../app/api/v1/bills/[id]/route";
import { POST as receiveBill } from "../../app/api/v1/bills/[id]/receive/route";
import { POST as createOrder } from "../../app/api/v1/purchase-orders/route";
import { GET as getOrder } from "../../app/api/v1/purchase-orders/[id]/route";
import { POST as sendOrder } from "../../app/api/v1/purchase-orders/[id]/send/route";
import { POST as convertOrder } from "../../app/api/v1/purchase-orders/[id]/convert/route";
import { POST as createRequisition } from "../../app/api/v1/purchase-requisitions/route";
import { PUT as submitRequisition } from "../../app/api/v1/purchase-requisitions/[id]/route";
import { POST as approveRequisition } from "../../app/api/v1/purchase-requisitions/[id]/approve/route";
import { POST as convertRequisition } from "../../app/api/v1/purchase-requisitions/[id]/convert/route";
import { POST as receiveGoods } from "../../app/api/v1/goods-receipts/route";
import { GET as getReceipt } from "../../app/api/v1/goods-receipts/[id]/route";
import { POST as receiptBill } from "../../app/api/v1/goods-receipts/[id]/create-bill/route";
import { POST as createRecurring } from "../../app/api/v1/recurring/route";
import { POST as createDebit } from "../../app/api/v1/debit-notes/route";
import { POST as applyDebit } from "../../app/api/v1/debit-notes/[id]/apply/route";
import { POST as voidDebit } from "../../app/api/v1/debit-notes/[id]/void/route";
import { registerBillTools } from "../../lib/mcp/tools/bills";
import { registerDebitNoteTools } from "../../lib/mcp/tools/debit-notes";
import { registerPurchaseOrderTools } from "../../lib/mcp/tools/purchase-orders";
import { registerPurchaseRequisitionTools } from "../../lib/mcp/tools/purchase-requisitions";
import { registerGoodsReceiptTools } from "../../lib/mcp/tools/goods-receipts";
import { registerRecurringTemplateTools } from "../../lib/mcp/tools/recurring-templates";
import { processRecurringPayableTemplate } from "../../lib/api/recurring-payable";
import { billLineInputs, billEditorPreview } from "../../lib/money/bill-editor";
import { billUiDocument, billUiList, billUiDecimal, billUiSupplierCreditLines, billUiMoney } from "../../lib/money/bill-ui";
import { procurementEditorLines, procurementDocument, procurementReceiveLines, procurementReceipt } from "../../lib/money/procurement-ui";
import { recurringBillEditorPayload, recurringBillEditorPreview, recurringBillUiDocument } from "../../lib/money/recurring-bill-ui";
import { debitNoteUiDocument, debitNoteUiBill, debitNoteUiBillEligible, debitNoteUiApplication } from "../../lib/money/debit-note-ui";

type DebitWire = Record<string, unknown> & { contactId: string; currencyCode: string; status: string; amountRemaining: number;
  lines: (Record<string, unknown> & { quantity: number })[] };
type BillWire = Record<string, unknown> & { id: string; contactId: string; currencyCode: string; status: string };

async function run() {
  const [owner] = await db.insert(users).values({ email: "combined-payable-ui@example.test" }).returning();
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const [org] = await db.insert(organization).values({ name: `Combined payable ${currencyCode}`, slug: `combined-payable-${currencyCode}`, defaultCurrency: currencyCode }).returning();
    await db.insert(member).values({ organizationId: org.id, userId: owner.id, role: "owner" });
    await db.insert(subscription).values({ organizationId: org.id, plan: "pro" });
    const key = `dk_combined_payable_${currencyCode}`;
    await db.insert(apiKey).values({ organizationId: org.id, createdBy: owner.id, name: "UI fixture", keyPrefix: "dk_combined",
      keyHash: createHash("sha256").update(key).digest("hex") });
    const [supplier] = await db.insert(contact).values({ organizationId: org.id, name: "Supplier", type: "supplier", currencyCode }).returning();
    const [expense] = await db.insert(chartAccount).values([
      { organizationId: org.id, code: "5000", name: "Expense", type: "expense", currencyCode },
      { organizationId: org.id, code: "2100", name: "AP", type: "liability", currencyCode },
    ]).returning();
    const ctx = { organizationId: org.id, userId: owner.id, role: "owner" as const };
    const server = new McpServer({ name: "Combined payable UI", version: "1" });
    registerBillTools(server, ctx); registerDebitNoteTools(server, ctx); registerPurchaseOrderTools(server, ctx);
    registerPurchaseRequisitionTools(server, ctx);
    registerGoodsReceiptTools(server, ctx); registerRecurringTemplateTools(server, ctx);
    const client = new Client({ name: "Parent integration fixture", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
    const req = (method: string, body?: unknown) => new Request("http://fixture.test/api/v1/bills?limit=100", {
      method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const rest = async (response: Promise<Response>) => { const result = await response, body = await result.json(); assert.ok(result.ok, JSON.stringify(body)); return body; };
    const mcp = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const line = (price: string, quantity = "1") => ({ description: "Work", unitPrice: price, quantity, accountId: expense.id, taxRateId: "" });
    const header = { contactId: supplier.id, currencyCode, issueDate: "2026-10-11" };
    try {
      for (const transport of ["rest", "mcp"] as const) {
        // Bill creation -> saved bill -> supplier-credit copy -> allocation -> unwind.
        // Each origin is read through BOTH transports and SQL, with no price rescaling.
        const settleAndCredit = async (id: string, expected: bigint, expectedPrice: bigint, quantity: number, expectedCredit = expected) => {
          const raw = (await rest(getBill(req("GET"), params(id)))).bill;
          const saved = billUiDocument(raw);
          const linked = billUiDocument((await mcp("get_bill", { billId: id })).bill);
          assert.equal(saved.total, expected); assert.equal(linked.total, expected);
          assert.equal(saved.currencyCode, currencyCode); assert.equal(saved.lines![0].unitPrice, expectedPrice);
          assert.equal(saved.lines![0].quantity, quantity);
          const stored = (await db.execute(sql`select b.total::text, b.currency_code, l.unit_price::text, l.amount::text, l.quantity
            from bill b join bill_line l on l.bill_id=b.id where b.id=${id} order by l.sort_order`)).rows;
          assert.equal(stored[0].total, String(expected)); assert.equal(stored[0].currency_code, currencyCode);
          assert.equal(stored[0].unit_price, String(expectedPrice)); assert.equal(stored[0].quantity, quantity);
          assert.equal(stored.reduce((sum, row) => sum + BigInt(row.amount as string), 0n), expected);
          const creditInput = { ...header, billId: id, lines: billUiSupplierCreditLines(saved.lines!, currencyCode) };
          const created = transport === "rest" ? await rest(createDebit(req("POST", creditInput))) : await mcp("create_debit_note", creditInput);
          const noteId = created.debitNote.id;
          const note = debitNoteUiDocument((await mcp("get_debit_note", { debitNoteId: noteId })).debitNote);
          assert.equal(note.total, expectedCredit); assert.equal(note.lines[0].unitPrice, expectedPrice);
          // Recognition is separate from creating the draft, including generated bills.
          if (transport === "rest") await rest(receiveBill(req("POST"), params(id)));
          else await mcp("receive_bill", { billId: id });
          await mcp("send_debit_note", { debitNoteId: noteId });
          const sent = debitNoteUiDocument((await mcp("get_debit_note", { debitNoteId: noteId })).debitNote as DebitWire);
          const target = debitNoteUiBill((await rest(getBill(req("GET"), params(id)))).bill as BillWire);
          assert.ok(debitNoteUiBillEligible(sent, target));
          assert.throws(() => debitNoteUiApplication(billUiDecimal(expected + 1n, currencyCode), sent, target));
          const amount = debitNoteUiApplication(billUiDecimal(expected, currencyCode), sent, target);
          if (transport === "rest") await rest(applyDebit(req("POST", amount), params(noteId)));
          else await mcp("apply_debit_note", { debitNoteId: noteId, ...amount });
          assert.equal(billUiDocument((await rest(getBill(req("GET"), params(id)))).bill).amountDue, 0n);
          assert.equal(debitNoteUiDocument((await mcp("get_debit_note", { debitNoteId: noteId })).debitNote).amountRemaining, expectedCredit - expected);
          const allocated = (await db.execute(sql`select amount::text from payment_allocation where document_id=${noteId}`)).rows;
          assert.deepEqual(allocated, [{ amount: String(expected) }]);
          if (transport === "rest") await rest(voidDebit(req("POST"), params(noteId)));
          else await mcp("void_debit_note", { debitNoteId: noteId });
          assert.equal(billUiDocument((await mcp("get_bill", { billId: id })).bill).amountDue, expected);
          assert.equal(debitNoteUiDocument((await mcp("get_debit_note", { debitNoteId: noteId })).debitNote).amountRemaining, 0n);
          const listed = (await rest(listBills(req("GET")))).data.map(billUiList);
          assert.equal(listed.find((row: { id: string }) => row.id === id).amountDue, expected);
        };

        const billLines = [line(billUiDecimal(1250n, currencyCode), "1.25")];
        const preview = billEditorPreview(billLines, currencyCode, []); assert.equal(preview.error, null);
        assert.equal(preview.total, 1563n);
        const billInput = { ...header, dueDate: "2026-11-11", lines: billLineInputs(billLines) };
        const ordinary = transport === "rest" ? await rest(createBill(req("POST", billInput))) : await mcp("create_bill", billInput);
        await settleAndCredit(ordinary.bill.id, 1563n, 1250n, 125);
        if (currencyCode === "USD") {
          // The copy action copies SAVED price, not the original sub-minor input.
          // Extended 0.005 * 3 saves amount 2 but unit price 1; copying 0.01 * 3
          // creates a 3-unit credit. Allocation must still stop at the 2-unit bill.
          const tieLines = [line("0.005", "3")];
          assert.equal(billEditorPreview(tieLines, currencyCode, []).total, 2n);
          const tieInput = { ...header, dueDate: "2026-11-11", lines: billLineInputs(tieLines) };
          const tie = transport === "rest" ? await rest(createBill(req("POST", tieInput))) : await mcp("create_bill", tieInput);
          await settleAndCredit(tie.bill.id, 2n, 1n, 300, 3n);
        }

        // Two half-unit lines must round independently, through receipt and bill recognition.
        const halfLines = [line(billUiDecimal(1n, currencyCode), "0.5"), line(billUiDecimal(1n, currencyCode), "0.5")];
        const poInput = { ...header, lines: procurementEditorLines(halfLines, "purchaseOrder") };
        const po = transport === "rest" ? await rest(createOrder(req("POST", poInput))) : await mcp("create_purchase_order", poInput);
        if (transport === "rest") await rest(sendOrder(req("POST"), params(po.purchaseOrder.id)));
        else await mcp("send_purchase_order", { purchaseOrderId: po.purchaseOrder.id });
        const order = procurementDocument((await rest(getOrder(req("GET"), params(po.purchaseOrder.id)))).purchaseOrder);
        const receiveInput = { purchaseOrderId: po.purchaseOrder.id, date: "2026-10-11",
          lines: procurementReceiveLines(order.lines as { id: string; quantity: number; quantityReceived: number }[]) };
        const receipt = transport === "rest" ? await rest(receiveGoods(req("POST", receiveInput))) : await mcp("receive_goods_receipt", receiveInput);
        assert.equal(procurementReceipt((await rest(getReceipt(req("GET"), params(receipt.goodsReceipt.id)))).goodsReceipt).total, 2n);
        const converted = transport === "rest" ? await rest(receiptBill(req("POST"), params(receipt.goodsReceipt.id)))
          : await mcp("create_bill_from_goods_receipt", { goodsReceiptId: receipt.goodsReceipt.id });
        await settleAndCredit(converted.bill.id, 2n, 1n, 50);
        const tallies = (await db.execute(sql`select quantity_received, quantity_billed from purchase_order_line where purchase_order_id=${po.purchaseOrder.id}`)).rows;
        assert.ok(tallies.every(row => row.quantity_received === 50 && row.quantity_billed === 50));

        // Requisition -> PO -> direct bill uses the same saved-bill/credit adapters.
        const requisitionInput = { contactId: supplier.id, currencyCode, requestDate: "2026-10-11",
          lines: procurementEditorLines(billLines, "requisition") };
        const requisition = transport === "rest" ? await rest(createRequisition(req("POST", requisitionInput)))
          : await mcp("create_purchase_requisition", requisitionInput);
        const requisitionId = requisition.requisition.id;
        if (transport === "rest") {
          await rest(submitRequisition(req("PUT", { status: "submitted" }), params(requisitionId)));
          await rest(approveRequisition(req("POST"), params(requisitionId)));
        } else {
          await mcp("submit_purchase_requisition", { requisitionId });
          await mcp("approve_purchase_requisition", { requisitionId });
        }
        const requisitionOrder = transport === "rest" ? await rest(convertRequisition(req("POST"), params(requisitionId)))
          : await mcp("convert_purchase_requisition", { requisitionId });
        await mcp("send_purchase_order", { purchaseOrderId: requisitionOrder.purchaseOrder.id });
        const directBill = transport === "rest" ? await rest(convertOrder(req("POST"), params(requisitionOrder.purchaseOrder.id)))
          : await mcp("convert_po_to_bill", { purchaseOrderId: requisitionOrder.purchaseOrder.id });
        await settleAndCredit(directBill.bill.id, 1563n, 1250n, 125);

        // Recurring payables deliberately use price * 100 for EVERY currency.
        const recurringLines = [line("12.50", "1.25")];
        const recurringPreview = recurringBillEditorPreview(recurringLines, currencyCode, []);
        assert.equal(recurringPreview.total, 1563n); assert.equal(recurringPreview.lines[0].priceMinor, 1250n);
        const recurringInput = recurringBillEditorPayload({ name: "Parent integration", contactId: supplier.id, currencyCode,
          frequency: "monthly", startDate: "2026-10-11", endDate: "2026-10-11", maxOccurrences: "1", reference: `combined-${transport}` }, recurringLines);
        const recurring = transport === "rest" ? await rest(createRecurring(req("POST", recurringInput))) : await mcp("create_recurring_template", recurringInput);
        const template = recurringBillUiDocument((await mcp("get_recurring_template", { templateId: recurring.template.id })).template);
        assert.equal(template.lines[0].unitPrice, 1250n);
        assert.equal(billUiMoney(template.lines[0].unitPrice, currencyCode), billUiMoney(1250n, currencyCode));
        assert.equal(await processRecurringPayableTemplate(org.id, recurring.template.id, "2026-10-11"), 1);
        const generated = (await db.execute(sql`select id, status from bill where organization_id=${org.id} and reference=${recurringInput.reference}`)).rows;
        assert.equal(generated.length, 1); assert.equal(generated[0].status, "draft");
        await settleAndCredit(generated[0].id as string, 1563n, 1250n, 125);
        assert.equal(await processRecurringPayableTemplate(org.id, recurring.template.id, "2026-10-11"), 0);
      }
    } finally { await client.close(); await server.close(); }
  }
  console.log("Combined payable UI REST MCP SQL verified");
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
