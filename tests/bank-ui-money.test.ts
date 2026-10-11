import assert from "node:assert/strict";
import { test } from "node:test";
import { bankUiAccount, bankUiTransaction, bankUiDocument, bankUiPreview, bankUiReport, bankUiBalance,
  bankUiAmount, bankUiMatchAmount, bankUiTransfer, bankUiSplit, bankUiGroups, bankUiMoney, bankUiDecimal, bankUiTax, bankUiRule } from "../lib/money/bank-ui";

test("bank UI preserves raw units, safe low digits and optional compatible aliases", () => {
  for (const currencyCode of ["USD", "JPY", "IRR", "KWD"]) {
    const saved = bankUiAccount({ currencyCode, balance: 9007199254740991, balanceMinor: "9007199254740991" });
    assert.equal(saved.balance, 9007199254740991n);
    assert.equal(bankUiAccount({ currencyCode, balance: 1250 }).balance, 1250n);
    assert.equal(bankUiBalance(bankUiDecimal(saved.balance, currencyCode), currencyCode), "9007199254740991");
    const row = bankUiTransaction({ currencyCode, amount: -1250, amountMinor: "-1250", balance: null, balanceMinor: null }, currencyCode);
    assert.equal(row.amount, -1250n); assert.equal(row.balance, null);
    const document = bankUiDocument({ currencyCode, total: 1250, amountDue: 1200 }, currencyCode);
    assert.equal(document.amountDue, 1200n);
  }
  for (const extra of [{ balance: NaN }, { balance: -0 }, { balance: 1.2 }, { balance: 9007199254740992 }, { balanceMinor: "01" }, { balanceMinor: "1251" }, { currencyCode: "bad" }, { currencyCode: "usd" }])
    assert.throws(() => bankUiAccount({ currencyCode: "USD", balance: 1250, ...extra }));
  assert.throws(() => bankUiTransaction({ currencyCode: "KWD", amount: 1250 }, "USD"));
  assert.throws(() => bankUiTransaction({ currencyCode: "USD", amount: 1250, balance: null, balanceMinor: "0" }));
});

test("bank input uses selected scales, rejects malformed/range/fractional units and validates match/transfer policy", () => {
  for (const [code, text, expected] of [["USD", "12.50", "1250"], ["JPY", "1250", "1250"], ["IRR", "1250", "1250"], ["KWD", "1.250", "1250"]]) {
    assert.equal(bankUiAmount(text, code).amountMinor, expected);
    assert.equal(bankUiBalance(`-${text}`, code), "-1250");
    assert.equal(bankUiTransfer(text, { id: "a", currencyCode: code }, { id: "b", currencyCode: code }).amountMinor, expected);
    assert.equal(bankUiMatchAmount(text, code, { amount: -1250n }, { currencyCode: code, amountDue: 1250n }).amountMinor, expected);
  }
  for (const text of ["", "1e3", "12x", "1,000", "NaN", "-1", "0", "0.001", "90071992547409.92"])
    assert.throws(() => bankUiAmount(text, "USD"));
  assert.throws(() => bankUiTransfer("1", { id: "a", currencyCode: "USD" }, { id: "b", currencyCode: "KWD" }));
  assert.throws(() => bankUiTransfer("1", { id: "a", currencyCode: "USD" }, { id: "a", currencyCode: "USD" }));
  assert.throws(() => bankUiMatchAmount("12.51", "USD", { amount: 1250n }, { currencyCode: "USD", amountDue: 2000n }));
  assert.throws(() => bankUiMatchAmount("12.49", "USD", { amount: 1250n }, { currencyCode: "USD", amountDue: 2000n }));
  assert.throws(() => bankUiMatchAmount("12.50", "USD", { amount: 1250n }, { currencyCode: "USD", amountDue: 1249n }));
  assert.throws(() => bankUiMatchAmount("1", "USD", { amount: 1250n }, { currencyCode: "JPY", amountDue: 1250n }));
});

test("bank rule thresholds and fixed split aliases retain raw bank minor units", () => {
  const rule = { conditions: [{ field: "amount", op: "between", value: "-9007199254740991,1250" }], splitAllocations: [{ amount: 1250, amountMinor: "1250" }] };
  assert.deepEqual(bankUiRule(rule), rule);
  for (const value of ["bad", "1e3", "01", "9007199254740992", "1250,2500,3000"])
    assert.throws(() => bankUiRule({ ...rule, conditions: [{ field: "amount", op: "between", value }] }));
  assert.throws(() => bankUiRule({ ...rule, splitAllocations: [{ amount: 1250, amountMinor: "1251" }] }));
});

test("split totals and tax previews use bigint; summary groups preserve currency and cancellation", () => {
  const row = (amount: string) => ({ accountId: "expense", amount, taxRateId: "none", memo: "" });
  const split = bankUiSplit([row("45035996273704.95"), row("45035996273704.96")], "USD", -9007199254740991n);
  assert.deepEqual(split.map(r => r.amountMinor), ["4503599627370495", "4503599627370496"]);
  assert.throws(() => bankUiSplit([row("1"), row("bad")], "USD", 100n));
  assert.throws(() => bankUiSplit([row("1")], "USD", 101n));
  assert.throws(() => bankUiSplit([{ ...row("1"), accountId: "" }], "USD", 100n));
  const groups = bankUiGroups([{ balance: 9007199254740991n, currencyCode: "USD" }, { balance: 9007199254740991n, currencyCode: "USD" },
    { balance: 1250n, currencyCode: "KWD" }]);
  assert.deepEqual(groups, [["KWD", 1250n], ["USD", 18014398509481982n]]);
  assert.match(bankUiMoney(groups[1][1], "USD"), /180,143,985,094,819\.82/);
  assert.deepEqual(bankUiTax(4000000000000001n, { rate: 3333, recoverablePercent: 5000 }, false),
    { net: 3000075001875048n, tax: 999924998124953n, recoverable: 499962499062477n, absorbed: 499962499062476n });
});

test("statement previews and reports reject conflicting units, preserve null and distinguish bank/base", () => {
  const preview = { currencyCode: "KWD", openingBalance: null, closingBalance: 1250, closingBalanceMinor: "1250", duplicates: [], transactions: [{ amount: 1250, amountMinor: "1250", balance: 1250 }] };
  assert.equal(bankUiPreview(preview, "KWD").closingBalance, 1250n);
  assert.throws(() => bankUiPreview(preview, "USD"));
  assert.throws(() => bankUiPreview({ ...preview, closingBalanceMinor: "1251" }, "KWD"));
  const empty = { total: 0, totalMinor: "0", transactions: [] };
  const report = { currencyCode: "USD", glCurrencyCode: "USD", statementEndBalance: 1250, glBalance: 1200, difference: 50,
    differenceMinor: "50", isBalanced: false, reconciled: empty, unreconciled: empty };
  assert.equal(bankUiReport(report).difference, 50n);
  assert.throws(() => bankUiReport({ ...report, difference: 51, differenceMinor: "51" }));
  assert.throws(() => bankUiReport({ ...report, glCurrencyCode: "KWD" }));
  assert.equal(bankUiReport({ ...report, glCurrencyCode: "KWD", difference: null, differenceMinor: null }).difference, null);
});
