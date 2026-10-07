import assert from "node:assert/strict";
import { test } from "node:test";
import { statementPeriod, contactQuery, activitySchema } from "../lib/api/contact-statement-wire";
import { agingMoney } from "../lib/reports/aging-wire";

test("statement Gregorian periods, UTC leap defaults and strict query inputs", () => {
  assert.deepEqual(statementPeriod({}, new Date("2024-02-29T23:00:00Z")), { startDate: "2023-02-28", endDate: "2024-02-29" });
  for (const input of [{ startDate: "2023-02-29" }, { endDate: "" }, { startDate: "2024-02-02", endDate: "2024-02-01" }, { currencyCode: "usd" }, { amountMinor: "1" }])
    assert.throws(() => statementPeriod(input));
  for (const query of ["?startDate=", "?unknown=1", "?endDate=2024-01-01&endDate=2024-01-01", "?currencyCode=XXX"])
    assert.throws(() => contactQuery(new Request(`http://fixture.test/${query}`), "statement"));
});
test("activity strict dates, types, limit and cursor", () => {
  for (const input of [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { cursor: "bad" }, { type: "" }, { type: "invoice,unknown" }, { startDate: "infinity" }, { startDate: "2024-02-02", endDate: "2024-01-01" }])
    assert.equal(activitySchema.safeParse(input).success, false);
  for (const query of ["?limit=30x", "?limit=", "?limit=NaN", "?cursor=", "?type=invoice&type=bill"])
    assert.throws(() => contactQuery(new Request(`http://fixture.test/${query}`), "activity"));
  assert.equal(activitySchema.parse({ type: "invoice,bill", cursor: "2024-01-01T00:00:00Z", limit: 100 }).limit, 100);
});
test("statement dual money preserves safe signed endpoints and rejects overflow", () => {
  for (const value of [0n, -1n, 9007199254740991n, -9007199254740991n]) assert.deepEqual(agingMoney("balance", value), { balance: Number(value), balanceMinor: value.toString() });
  assert.throws(() => agingMoney("balance", 9007199254740992n), { code: "LEGACY_NUMERIC_RANGE" });
});
