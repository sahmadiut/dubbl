import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { bankDocumentMatchSchema, bankInvoiceMatchSchema, bankDocumentSplitSchema, bankDocumentAllocations } from "../lib/api/bank-document-match-wire";
import { creditAmount } from "../lib/api/credit-wire";

test("bank matching accepts explicit minor aliases and rejects ambiguous targets/overrides", () => {
  const invoiceId = randomUUID();
  for (const amount of [{ amount: 1250 }, { amountMinor: "1250" }, { amount: 1250, amountMinor: "1250" }]) {
    assert.equal(creditAmount(bankDocumentMatchSchema.parse({ invoiceId, ...amount })), 1250);
    assert.equal(creditAmount(bankInvoiceMatchSchema.parse({ invoiceId, ...amount })), 1250);
  }
  assert.throws(() => creditAmount(bankDocumentMatchSchema.parse({ invoiceId, amount: 1250, amountMinor: "1251" })));
  for (const patch of [{ amount: 12.5 }, { amountMinor: "01" }, { amountMinor: "-0" }, { amountMinor: "1e3" }, { amountMinor: "۱۲۵۰" }, { date: "2026-02-30" },
    { matchType: "bill" }, { paymentId: randomUUID() }, { extra: 1 }]) assert.throws(() => bankDocumentMatchSchema.parse({ invoiceId, amount: 1250, ...patch }));
  for (const patch of [{ amount: 1 }, { amountMinor: "1" }, { date: "2026-10-04" }]) assert.throws(() => bankDocumentMatchSchema.parse({ paymentId: randomUUID(), ...patch }));
  assert.throws(() => bankDocumentMatchSchema.parse({ matchType: "existing_journal" }));
  assert.throws(() => creditAmount(bankDocumentMatchSchema.parse({ invoiceId, amountMinor: "9007199254740992" })));
  assert.equal(creditAmount(bankDocumentMatchSchema.parse({ invoiceId, amountMinor: String(Number.MAX_SAFE_INTEGER) })), Number.MAX_SAFE_INTEGER);
});

test("document allocation sums stay exact and duplicates/overflow cannot mutate", () => {
  const allocation = { documentType: "invoice" as const, documentId: randomUUID(), amountMinor: "1250" };
  const parse = (allocations: unknown[]) => bankDocumentAllocations(bankDocumentSplitSchema.parse({ allocations }));
  assert.equal(parse([allocation, { ...allocation, documentId: randomUUID(), amount: 750, amountMinor: "750" }]).amount, 2000);
  assert.throws(() => parse([allocation, allocation]));
  assert.throws(() => parse([{ ...allocation, amountMinor: String(Number.MAX_SAFE_INTEGER) }, { ...allocation, documentId: randomUUID(), amountMinor: "1" }]));
  assert.throws(() => parse([{ ...allocation, amountMinor: "0" }]));
  assert.throws(() => parse([{ ...allocation, amount: 1251 }]));
  assert.throws(() => parse([{ ...allocation, unknown: 1 }]));
});
