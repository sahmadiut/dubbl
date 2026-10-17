import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "./helpers/presentation";
import { procurementEditorLines, procurementPreview, procurementDocument, procurementList, procurementReceipt,
  procurementMoney, procurementOverview, procurementQuantityText, procurementReceiveLines, procurementEditPrice, procurementFilter } from "../lib/money/procurement-ui";
import { purchaseOrderCreateSchema, purchaseOrderUpdateSchema, purchaseOrderTotals } from "../lib/api/purchase-order-wire";
import { requisitionCreateSchema, requisitionTotals } from "../lib/api/purchase-requisition-wire";
import { goodsReceiptCreateSchema, goodsReceiptQuantity, goodsReceiptAmount } from "../lib/api/goods-receipt-wire";
import { ProcurementMoneyDetails } from "../components/dashboard/procurement-money-details";
import { RequisitionLineEditor } from "../components/dashboard/requisition-line-editor";
import { LineItemsEditor } from "../components/dashboard/line-items-editor";

const line = (unitPrice = "12.50", quantity = "1") => ({ description: "Service", quantity, unitPrice, accountId: "", taxRateId: "" });
const header = (currencyCode = "USD", total = 1250) => ({ currencyCode, subtotal: total, subtotalMinor: String(total), taxTotal: 0,
  taxTotalMinor: "0", total, totalMinor: String(total) });

test("procurement previews match create/edit/requisition policies, currency scales and safe-edge low digits", () => {
  const tax = randomUUID();
  for (const [currency, price, quantity] of [["USD", "0.005", "3"], ["USD", "-0.005", "1"], ["USD", "12.50", "1.25"],
    ["JPY", "1250", "1.25"], ["IRR", "1250", "1"], ["KWD", "1.250", "1"], ["USD", "90071992547409.91", "1"]] as const) {
    for (const kind of ["purchaseOrder", "purchaseOrderUpdate", "requisition"] as const) {
      const lines = [line(price, quantity)];
      const input = procurementEditorLines(lines, kind), preview = procurementPreview(lines, currency, [], kind);
      const totals = kind === "requisition" ? requisitionTotals(input, currency)
        : purchaseOrderTotals(input.map(line => ({ ...line, discountPercent: 0 })), currency, new Map(), kind === "purchaseOrderUpdate");
      assert.equal(preview.error, null); assert.equal(preview.total, BigInt(totals.total));
      assert.equal(preview.lines[0].priceMinor, BigInt(totals.processedLines[0].unitPrice));
      assert.equal(procurementList(header(currency, totals.total)).total, preview.total);
    }
  }
  assert.equal(procurementEditPrice(1250n, "USD"), "12.50");
  assert.equal(procurementEditPrice(1250n, "JPY"), "1250");
  assert.equal(procurementEditPrice(1250n, "KWD"), "1.250");
  const taxed = [{ ...line("10"), taxRateId: tax }];
  assert.equal(procurementPreview(taxed, "USD", [{ id: tax, rate: 1000 }]).total, 1100n);
  for (const kind of ["purchaseOrderUpdate", "requisition"] as const) assert.equal(procurementPreview(taxed, "USD", [], kind).total, 1000n);
  assert.equal(procurementPreview([line("0.005", "3")], "USD", []).total, 2n);
  assert.equal(procurementPreview([line("1", "1.234")], "USD", []).total, 123n);
  assert.equal(procurementEditorLines([line("", "0")], "purchaseOrder")[0].quantity, 0);
  assert.equal(procurementEditorLines([line("", "")], "requisition")[0].quantity, 1);
  for (const schema of [purchaseOrderCreateSchema, requisitionCreateSchema]) assert.equal(schema.parse({ contactId: randomUUID(), issueDate: "2026-10-11", requestDate: "2026-10-11", lines: procurementEditorLines([line()], "purchaseOrder") }).currencyCode, "USD");
  assert.equal(purchaseOrderUpdateSchema.parse({ lines: procurementEditorLines([line()], "purchaseOrderUpdate") }).lines?.[0].unitPriceExact, "12.50");
});

test("procurement invalid decimal, tax, range, alias and saved balance inputs reject", () => {
  for (const price of ["1e3", "1x", "NaN", "90071992547409.92"]) assert.ok(procurementPreview([line(price)], "USD", []).error);
  assert.ok(procurementPreview([line("90071992547409.91", "2")], "USD", []).error);
  assert.ok(procurementPreview([{ ...line(), taxRateId: randomUUID() }], "USD", []).error);
  assert.ok(procurementPreview([line()], null, []).error);
  for (const quantity of ["1x", "NaN", "1e3", "21474836.48"]) assert.throws(() => procurementEditorLines([line("1", quantity)], "requisition"));
  assert.throws(() => procurementEditorLines([{ ...line(), description: " " }], "purchaseOrder"));
  for (const change of [{ totalMinor: "01250" }, { totalMinor: "1251" }, { total: 1.25 }, { total: Number.MAX_SAFE_INTEGER + 1 }, { currencyCode: "BAD" }])
    assert.throws(() => procurementList({ ...header(), ...change }));
  const saved = { ...header(), lines: [{ id: "l", quantity: 125, quantityReceived: 25, quantityBilled: 50, unitPrice: 1000, amount: 1250, taxAmount: 0 }] };
  assert.equal(procurementDocument(saved).total, 1250n);
  assert.throws(() => procurementDocument({ ...saved, total: 1251, totalMinor: "1251" }));
  for (const change of [{ quantity: 1.5 }, { quantityReceived: -1 }, { quantityBilled: 126 }, { unitPriceMinor: "1001" }]) assert.throws(() => procurementDocument({ ...saved, lines: [{ ...saved.lines[0], ...change }] }));
});

test("receipt per-line rounding matches posting/bill amounts; quantity aliases and remaining selections stay physical", () => {
  const receipt = procurementReceipt({ currencyCode: "USD", lines: [
    { quantityReceived: 50, quantityReceivedExact: "0.50", unitCost: 1, unitCostMinor: "1" },
    { quantityReceived: 50, quantityReceivedExact: "0.50", unitCost: 1, unitCostMinor: "1" },
  ] });
  assert.equal(receipt.total, 2n); // Rounding the aggregate instead would incorrectly return 1.
  assert.equal(receipt.lines[0].amount, BigInt(goodsReceiptAmount(50, 1)));
  assert.equal(procurementQuantityText(-125), "-1.25"); assert.equal(procurementQuantityText(125), "1.25");
  const selections = procurementReceiveLines([{ id: randomUUID(), quantity: 125, quantityReceived: 25 }, { id: randomUUID(), quantity: 100, quantityReceived: 100 }]);
  assert.equal(selections.length, 1); assert.equal(selections[0].quantityExact, "1");
  const parsed = goodsReceiptCreateSchema.parse({ purchaseOrderId: randomUUID(), date: "2026-10-11", lines: selections });
  assert.equal(goodsReceiptQuantity(parsed.lines[0], false), 100);
  for (const change of [{ unitCostMinor: "2" }, { unitCost: -1 }, { quantityReceived: 0 }, { quantityReceived: 1.5 }, { quantityReceivedExact: "0.5" }])
    assert.throws(() => procurementReceipt({ currencyCode: "USD", lines: [{ quantityReceived: 50, quantityReceivedExact: "0.50", unitCost: 1, unitCostMinor: "1", ...change }] }));
});

test("procurement overview groups sample currencies, excludes cancellations, preserves sums beyond one safe document", () => {
  const rows = [{ currencyCode: "USD", status: "sent", total: 9007199254740991n }, { currencyCode: "USD", status: "partial", total: 9007199254740991n },
    { currencyCode: "USD", status: "void", total: 1n }, { currencyCode: "JPY", status: "received", total: 1250n }];
  assert.equal(procurementOverview(rows).find(group => group.currencyCode === "USD")?.amount, 18014398509481982n);
  assert.equal(procurementOverview(rows, ["received"])[0].currencyCode, "JPY");
});

test("loaded procurement filters/sorts compare exact amounts and keep currencies separate", () => {
  const rows = [{ id: "late", date: "2026-10-11", createdAt: "2026-10-11T10:00:00Z", contact: { name: "Supplier" }, currencyCode: "USD", total: 9007199254740991n },
    { id: "early", date: "2026-10-10", createdAt: "2026-10-10T10:00:00Z", contact: null, currencyCode: "USD", total: 9007199254740990n },
    { id: "jpy", date: "2026-10-10", createdAt: "2026-10-10T11:00:00Z", contact: null, currencyCode: "JPY", total: 1n }];
  const filters = { search: "", from: "", to: "", sortBy: "total", sortOrder: "asc" as const };
  const apply = (patch: Partial<typeof filters>) => procurementFilter(rows, row => row.id, row => row.date, { ...filters, ...patch }).map(row => row.id);
  assert.deepEqual(apply({}), ["jpy", "early", "late"]);
  assert.deepEqual(apply({ search: "SUPPLIER" }), ["late"]);
  assert.deepEqual(apply({ from: "2026-10-11" }), ["late"]);
  assert.deepEqual(apply({ to: "2026-10-10" }), ["jpy", "early"]);
  assert.deepEqual(apply({ sortBy: "created" }), ["early", "jpy", "late"]);
});

test("rendered procurement prices, taxes, received/billed quantities and receipt totals retain exact English values", () => {
  for (const [currencyCode, price, value] of [["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER], ["JPY", "1250", 1250], ["IRR", "1250", 1250], ["KWD", "1.250", 1250]] as const) {
    const editor = renderToStaticMarkup(createElement(LineItemsEditor, { documentKind: "purchaseOrder", lines: [line(price)], onChange: () => {}, currencyCode, priceFractionDigits: 18 }));
    assert.ok(editor.includes(`Price (${currencyCode})`)); assert.ok(editor.includes(`${price}</span>`));
    const saved = procurementDocument({ ...header(currencyCode, value), lines: [{ id: "line", description: "Work", quantity: 125, quantityReceived: 25, quantityBilled: 50, unitPrice: value, amount: value, taxAmount: 0 }] });
    const markup = renderToStaticMarkup(createElement(ProcurementMoneyDetails, { document: saved }));
    for (const text of ["1.25", "0.25", "0.5", "Received", "Billed", "Subtotal:", "Tax:", "overflow-x-auto", procurementMoney(BigInt(value), currencyCode)]) assert.ok(markup.includes(text));
    const req = renderToStaticMarkup(createElement(RequisitionLineEditor, { lines: [line(price)], onChange: () => {}, currencyCode }));
    assert.match(req, /inputMode="decimal"/); assert.match(req, /Requisitions calculate no tax/); assert.ok(req.includes(procurementMoney(BigInt(value), currencyCode)));
  }
  const receipt = procurementReceipt({ currencyCode: "USD", lines: [{ id: "r", description: "Work", quantityReceived: 50, unitCost: 1 }, { id: "s", description: "Work", quantityReceived: 50, unitCost: 1 }] });
  assert.ok(renderToStaticMarkup(createElement(ProcurementMoneyDetails, { document: receipt, receipt: true })).includes("Total value: $0.02"));
  assert.match(renderToStaticMarkup(createElement(RequisitionLineEditor, { lines: [line("1x")], onChange: () => {}, currencyCode: "USD" })), /role="alert"/);
});
