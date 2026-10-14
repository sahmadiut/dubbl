import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { generalLedgerUi, ledgerPageUi, appendLedgerPage, cashFlowUi, receivablesUi, payablesUi,
  ledgerAgingJson, reportUiMoney, ledgerExportRows, agingExportRows } from "../lib/money/ledger-aging-ui";
import { generateCSV } from "../lib/import-export/csv-utils";

const large = 9007199254740001n;
const pair = (key: string, value: bigint) => ({ [key]: Number(value), [`${key}Minor`]: value.toString() });
function ledger() {
  return { startDate: "2024-01-01", endDate: "2024-01-31", currencyCode: "KWD", accounts: [{
    accountId: "cash", accountName: "Cash", accountCode: "1000", accountType: "asset", totalEntries: 2,
    ...pair("totalDebit", large), ...pair("totalCredit", 901n), ...pair("balance", large - 901n),
    ...pair("openingBalance", 101n), ...pair("closingLedgerBalance", large - 800n), entries: [{
      date: "2024-01-10", entryNumber: 1, entryId: "first", lineId: "line-one", description: null, reference: null,
      ...pair("debit", large), ...pair("credit", 0n), ...pair("runningBalance", large), ...pair("ledgerBalance", large + 101n),
    }],
  }] };
}
function page() {
  return { ...ledger().accounts[0], ...ledger(), accounts: undefined, offset: 1, limit: 200, entries: [{
    date: "2024-01-20", entryNumber: 2, entryId: "second", lineId: "line-two", description: "Payment", reference: "Ref",
    ...pair("debit", 0n), ...pair("credit", 901n), ...pair("runningBalance", large - 901n), ...pair("ledgerBalance", large - 800n),
  }] };
}
function aging(kind = "invoices") {
  return { asAt: "2024-01-31", currencyCode: "KWD", ...pair("grandTotal", large),
    buckets: ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"].map((label, i) => {
      const items = i ? [] : [{ id: "document", invoiceNumber: "INV-1", billNumber: "BILL-1",
        contactName: "Contact", dueDate: "2024-01-31", daysOverdue: 0, currencyCode: "KWD", ...pair("amountDue", large) }];
      return { label, count: i ? 0 : 1, ...pair("total", i ? 0n : large),
        invoices: kind === "invoices" ? items : undefined, bills: kind === "bills" ? items : undefined };
    }) };

}
function cashFlow() {
  return { startDate: "2024-01-01", endDate: "2024-01-31", currencyCode: "KWD",
    operating: [{ accountName: "Net", accountCode: "", ...pair("amount", large) }],
    investing: [{ accountName: "Equipment", accountCode: "1500", ...pair("amount", -901n) }], financing: [],
    ...pair("totalOperating", large), ...pair("totalInvesting", -901n), ...pair("totalFinancing", 0n), ...pair("netCashFlow", large - 901n) };
}

test("ledger append preserves low digits, natural signs and opening-inclusive balances", () => {
  const data = generalLedgerUi(ledger()), updated = appendLedgerPage(data, "cash", ledgerPageUi(page()));
  assert.equal(updated.accounts[0].entries[1].runningBalance, 9007199254739100n);
  assert.equal(updated.accounts[0].entries[1].ledgerBalance, 9007199254739201n);
  assert.equal(data.accounts[0].entries.length, 1);
  const revenue = ledger(); revenue.accounts[0].accountType = "revenue";
  revenue.accounts[0] = { ...revenue.accounts[0], ...pair("balance", -large + 901n), ...pair("openingBalance", -101n),
    ...pair("closingLedgerBalance", -large + 800n), entries: [{ ...revenue.accounts[0].entries[0],
      ...pair("runningBalance", -large), ...pair("ledgerBalance", -large - 101n) }] };
  assert.equal(generalLedgerUi(revenue).accounts[0].balance, -9007199254739100n);
});
test("ledger pages fail on stale totals/context, repeated lines and discontinuous running balances", () => {
  const data = generalLedgerUi(ledger());
  for (const change of [{ offset: 0 }, { currencyCode: "USD" }, { startDate: "2023-01-01" }, { totalEntries: 3 },
    { dimension: "projectId", dimensionValue: "project" }, pair("totalDebit", large + 1n)]) {
    assert.throws(() => appendLedgerPage(data, "cash", ledgerPageUi({ ...page(), ...change })));
  }
  for (const change of [{ lineId: "line-one" }, pair("runningBalance", 1n), pair("ledgerBalance", 1n), pair("credit", 900n)]) {
    assert.throws(() => appendLedgerPage(data, "cash", ledgerPageUi({ ...page(), entries: [{ ...page().entries[0], ...change }] })));
  }
});
test("numeric/Minor aliases reject missing, noncanonical, unsafe, fractional and negative-zero amounts", () => {
  for (const change of [{ totalDebitMinor: "01" }, { totalDebitMinor: undefined }, { totalDebit: 0.5 },
    { totalDebit: Number.MAX_SAFE_INTEGER + 1 }, { totalCredit: -0 }, { totalDebitMinor: "9007199254740000" }]) {
    const input = ledger(); Object.assign(input.accounts[0], change); assert.throws(() => generalLedgerUi(input));
  }
  const duplicate = ledger(); duplicate.accounts.push(duplicate.accounts[0]); assert.throws(() => generalLedgerUi(duplicate));
});
test("aging validates every document currency, count, identity, alias and bucket/grand total", () => {
  assert.equal(receivablesUi(aging()).grandTotal, large); assert.equal(payablesUi(aging("bills")).grandTotal, large);
  for (const change of [{ currencyCode: "USD" }, { amountDueMinor: "1" }, { invoiceNumber: undefined }]) {
    const input = aging(); Object.assign(input.buckets[0].invoices![0], change); assert.throws(() => receivablesUi(input));
  }
  for (const change of [{ count: 0 }, { invoices: undefined }, pair("total", 1n)]) {
    const input = aging(); Object.assign(input.buckets[0], change); assert.throws(() => receivablesUi(input));
  }
  assert.throws(() => receivablesUi({ ...aging(), ...pair("grandTotal", 1n) }));
  assert.throws(() => receivablesUi({ ...aging(), currencyCode: "kwd" }));
});
test("cash-flow negative outflows and net sums stay exact and fail on inconsistent totals", () => {
  const data = cashFlowUi(cashFlow()); assert.equal(data.netCashFlow, 9007199254739100n); assert.equal(data.investing[0].amount, -901n);
  for (const change of [pair("netCashFlow", 0n), { totalOperatingMinor: "0" }, { operating: [] }, { totalInvesting: -900 }]) {
    assert.throws(() => cashFlowUi({ ...cashFlow(), ...change }));
  }
});
test("display uses explicit currency scale and CSV retains original minor integers", () => {
  for (const [code, pattern] of [["USD", /90,071,992,547,400\.01/], ["JPY", /9,007,199,254,740,001/],
    ["IRR", /9,007,199,254,740,001/], ["KWD", /9,007,199,254,740\.001/]] as const) {
    assert.match(reportUiMoney(large, code), pattern);
  }
  const csv = generateCSV(ledgerExportRows(generalLedgerUi(ledger())), ["currencyCode", "debitMinor", "ledgerBalanceMinor"]);
  assert.match(csv, /KWD,9007199254740001,9007199254740102/);
  assert.match(generateCSV(agingExportRows(receivablesUi(aging())), ["currencyCode", "amountDueMinor"]), /KWD,9007199254740001/);
});
test("failed HTTP and invalid money become load errors rather than empty or zero reports", async () => {
  await assert.rejects(ledgerAgingJson(new Response("{}", { status: 422 }), generalLedgerUi), /Unable to load/);
  await assert.rejects(ledgerAgingJson(new Response("{}"), cashFlowUi), /Saved report amounts are invalid/);
  await assert.rejects(ledgerAgingJson(new Response("invalid"), receivablesUi), /Saved report amounts are invalid/);
});
test("owned pages adopt validated DTOs and use explicit exact export columns", () => {
  for (const name of ["general-ledger", "cash-flow", "aged-receivables", "aged-payables"]) {
    const source = readFileSync(`app/(dashboard)/reports/${name}/page.tsx`, "utf8");
    assert.match(source, /ledgerAgingJson/); assert.match(source, /ErrorState/);
    assert.doesNotMatch(source, /\.json\(\)|parseFloat|Math\.round|from ["']@\/lib\/money["']/);
    if (name !== "cash-flow") { assert.match(source, /Minor/); assert.match(source, /currencyCode/); }
  }
  const ledgerSource = readFileSync("app/(dashboard)/reports/general-ledger/page.tsx", "utf8");
  assert.match(ledgerSource, /version !== requestVersion\.current/); assert.match(ledgerSource, /appendLedgerPage/);
});
