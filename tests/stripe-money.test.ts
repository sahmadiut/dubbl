import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStripePaymentsCsv, parseStripePayoutsCsv } from "../lib/integrations/stripe/csv-parser";
import { checkoutAmount, csvMinor, stripeMinor, validateStripeObject } from "../lib/integrations/stripe/money";
import { webhookBody } from "../lib/webhooks/payload";

test("Stripe CSV exact decimals and agreeing minor columns retain currency units", () => {
  assert.equal(csvMinor("0.29", "29", "USD"), 29);
  assert.equal(csvMinor("1250", "1250", "JPY"), 1250);
  assert.equal(csvMinor("90071992547409.91", undefined, "USD"), Number.MAX_SAFE_INTEGER);
  const rows = parseStripePaymentsCsv("id,Amount,Amount Minor,Fee,Fee Minor,Net,Currency\nch_a,10.23,1023,0.29,29,9.94,usd");
  assert.deepEqual([rows[0].amount, rows[0].fee, rows[0].net], [1023, 29, 994]);
  assert.equal(parseStripePayoutsCsv("id,Amount Minor,Currency\npo_a,1250,jpy")[0].amount, 1250);
});

test("Stripe rejects precision, unsupported scales, malformed input and alias disagreement", () => {
  for (const value of [NaN, Infinity, 1.1, -0, -1, Number.MAX_SAFE_INTEGER + 1, "12"]) assert.throws(() => stripeMinor(value));
  for (const [major, minor] of [["0.001", undefined], ["1e3", undefined], ["$1.00", undefined], ["1.00", "101"], [undefined, "01"], [undefined, "9007199254740992"]]) {
    assert.throws(() => csvMinor(major, minor, "USD"));
  }
  for (const currency of ["IRR", "ISK", "UGX", "MGA", "KWD", "XXX"]) assert.throws(() => checkoutAmount(1250, currency));
  for (const amount of [0, -1, 100000000]) assert.throws(() => checkoutAmount(amount, "USD"));
  assert.equal(checkoutAmount(99999999, "USD"), 99999999);
  assert.throws(() => parseStripePaymentsCsv('id,Amount,Currency\nch_a,"1.00,usd'));
  assert.throws(() => parseStripePayoutsCsv("id,Amount,Currency\npo_a,10.01,huf"));
  assert.throws(() => validateStripeObject({ currency: "usd", lines: { data: [{ amount: 1.1 }] } }));
  assert.doesNotThrow(() => validateStripeObject({ currency: "usd", amount: 1250, metadata: { amount: "arbitrary", currency: "custom" } }));
  assert.doesNotThrow(() => validateStripeObject({ object: "balance_transaction", currency: "usd", amount: -1250, fee: -29, net: -1221, fee_details: [{ amount: -29 }] }));
  assert.throws(() => validateStripeObject({ currency: "usd", unit_amount_decimal: "1.5", unit_amount: null }));
});

test("Opaque webhook JSON keeps names/units and canonicalizes initial and jsonb retry bytes", () => {
  const payload = { z: { amount: 1250n, currency: "JPY", amountMinor: "1250" }, a: [1, "9007199254740992"] };
  const body = webhookBody(payload);
  assert.equal(body, webhookBody(JSON.parse(body)));
  assert.deepEqual(JSON.parse(body), { a: [1, "9007199254740992"], z: { amount: 1250, amountMinor: "1250", currency: "JPY" } });
  for (const value of [9007199254740992n, NaN, Infinity, 9007199254740992]) assert.throws(() => webhookBody({ amount: value }));
});
