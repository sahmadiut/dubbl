import assert from "node:assert/strict";
import { test } from "node:test";
import { interestSchema, writeOffSchema, interestOverride, recoveredAmount, exactInterest, convertInvoiceLegs, lifecycleDto } from "../lib/api/invoice-lifecycle-wire";

test("invoice lifecycle aliases distinguish decimal-major interest and integer-minor recovery", () => {
  for (const [currency, minor] of [["USD", 1250], ["JPY", 13], ["KWD", 12500], ["IRR", 13]] as const) {
    assert.equal(interestOverride(interestSchema.parse({ amount: 12.5, amountExact: "12.50", amountMinor: String(minor) }), currency), minor);
    assert.equal(recoveredAmount(writeOffSchema.parse({ action: "recover", amount: 1250, amountMinor: "1250" }), 1), 1250);
  }
  assert.equal(interestOverride({}, "USD"), undefined);
  assert.equal(interestOverride({ amountMinor: "2147483648" }, "USD"), 2147483648);
  assert.throws(() => interestOverride({ amount: 1, amountExact: "2" }, "USD"));
  assert.throws(() => interestOverride({ amountExact: "12.50", amountMinor: "12" }, "USD"));
  assert.throws(() => interestOverride({ amountMinor: "0" }, "USD"));
  assert.throws(() => interestOverride({ amountMinor: "9007199254740992" }, "USD"));
  assert.throws(() => recoveredAmount(writeOffSchema.parse({ amount: 1, amountMinor: "2" }), 1));
  for (const value of ["01", "1e3", "۱۲", "-0", "1.2"]) assert.equal(interestSchema.safeParse({ amountMinor: value }).success, false);
  assert.equal(interestSchema.safeParse({ amountExact: "1e3" }).success, false);
});

test("invoice simple/daily compound interest uses rational arithmetic, bounded days and one final rounding", () => {
  assert.equal(exactInterest(100000, 500, 365, "simple"), 5000);
  assert.equal(exactInterest(100000, 500, 365, "compound"), 5127);
  assert.equal(exactInterest(3650000, 1, 1, "simple"), 1);
  assert.equal(exactInterest(1825000, 1, 1, "simple"), 1);
  assert.equal(exactInterest(0, 500, 0, "compound"), 0);
  assert.equal(exactInterest(Number.MAX_SAFE_INTEGER, 1, 1, "simple"), 2467725823);
  for (const args of [[-1, 500, 1, "simple"], [1, 0, 1, "simple"], [1, 500, 36501, "compound"],
    [1, 500, 0.5, "simple"], [Number.MAX_SAFE_INTEGER, 10000, 730, "simple"], [Number.MAX_SAFE_INTEGER, 500, 36500, "compound"]] as const)
    assert.throws(() => exactInterest(args[0], args[1], args[2], args[3]));
});

test("invoice FX converts declared minor scales and balances residuals without floating products", () => {
  const input = [{ debitAmount: 2, creditAmount: 0 }, { debitAmount: 0, creditAmount: 1 }, { debitAmount: 0, creditAmount: 1 }];
  const converted = convertInvoiceLegs(input, "EUR", "USD", "1.5");
  assert.deepEqual(converted, [{ debitAmount: 3, creditAmount: 0 }, { debitAmount: 0, creditAmount: 1 }, { debitAmount: 0, creditAmount: 2 }]);
  assert.equal(input[0].debitAmount, 2);
  assert.equal(convertInvoiceLegs([{ debitAmount: 1250, creditAmount: 0 }, { debitAmount: 0, creditAmount: 1250 }], "USD", "JPY", "150")[0].debitAmount, 1875);
  assert.equal(convertInvoiceLegs([{ debitAmount: 1250, creditAmount: 0 }, { debitAmount: 0, creditAmount: 1250 }], "USD", "KWD", "0.3")[0].debitAmount, 3750);
  assert.throws(() => convertInvoiceLegs(input, "EUR", "USD", "0.1234567"));
  assert.throws(() => convertInvoiceLegs([{ debitAmount: Number.MAX_SAFE_INTEGER, creditAmount: Number.MAX_SAFE_INTEGER }], "USD", "USD", "2"));
  assert.throws(() => convertInvoiceLegs([{ debitAmount: 1, creditAmount: 0 }], "USD", "USD", "1"));
  assert.throws(() => lifecycleDto({ subtotal: 0, taxTotal: 0, total: Number.MAX_SAFE_INTEGER, amountPaid: -1, amountDue: 0 }));
});
