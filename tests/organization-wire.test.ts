import assert from "node:assert/strict";
import { test } from "node:test";
import { organizationDto, mileageRateDto, parseMileageRate, organizationUpdateSchema, validateOrganizationBusinessType } from "../lib/api/organization-wire";
import { WireCompatibilityError, stringifyWire } from "../lib/money/wire";

test("organization money retains scales, nulls, numeric compatibility and exact aliases", () => {
  for (const defaultCurrency of ["USD", "JPY", "KWD", "IRR"]) {
    const row = organizationDto({ defaultCurrency, mileageRate: 1250, billApprovalThreshold: 3000000000, interestRate: 500 });
    assert.equal(row.mileageRate, 1250); assert.equal(row.mileageRateMinor, "1250");
    assert.equal(row.billApprovalThresholdMinor, "3000000000"); assert.equal(row.interestRate, 500);
    assert.ok(!("interestRateMinor" in row)); assert.deepEqual(JSON.parse(stringifyWire(row)), row);
    const empty = organizationDto({ defaultCurrency, mileageRate: null, billApprovalThreshold: null });
    assert.equal(empty.mileageRateMinor, null); assert.equal(empty.billApprovalThresholdMinor, null);
    assert.deepEqual(mileageRateDto(empty), { mileageRate: 67, mileageRateMinor: "67", currencyCode: defaultCurrency });
  }
  const safe = organizationDto({ defaultCurrency: "USD", mileageRate: 9007199254740991n, billApprovalThreshold: 0n });
  assert.equal(safe.mileageRate, Number.MAX_SAFE_INTEGER); assert.equal(safe.billApprovalThresholdMinor, "0");
});
test("mileage aliases reject malformed or unsupported input without coercion", () => {
  for (const amount of [0, 67, 1250, 3000000000, Number.MAX_SAFE_INTEGER]) {
    assert.equal(parseMileageRate({ mileageRate: amount }), amount);
    assert.equal(parseMileageRate({ mileageRateMinor: String(amount) }), amount);
    assert.equal(parseMileageRate({ mileageRate: amount, mileageRateMinor: String(amount) }), amount);
  }
  for (const value of [-1, -0, 0.5, Infinity, NaN, 9007199254740992, "67", null, true])
    assert.throws(() => parseMileageRate({ mileageRate: value }));
  for (const value of ["-1", "-0", "01", " 67", "67 ", "1e3", "0.67", "۶۷", "+67", "9223372036854775808", "9".repeat(10000), 67, null])
    assert.throws(() => parseMileageRate({ mileageRateMinor: value }));
  assert.throws(() => parseMileageRate({ mileageRateMinor: "9007199254740992" }), WireCompatibilityError);
  for (const value of [{}, { mileageRate: 67, mileageRateMinor: "68" }, { mileageRate: 67, organizationId: "foreign" }, [], null])
    assert.throws(() => parseMileageRate(value));
});
test("unsafe or malformed saved organization money fails visibly", () => {
  for (const key of ["mileageRate", "billApprovalThreshold"])
    for (const value of [-1, -0, 0.1, 9007199254740992, 9007199254740992n, "67", undefined])
      assert.throws(() => organizationDto({ defaultCurrency: "USD", mileageRate: 67, billApprovalThreshold: null, [key]: value }), WireCompatibilityError);
  for (const defaultCurrency of ["ZZZ", "usd", " USD"])
    assert.throws(() => organizationDto({ defaultCurrency, mileageRate: 67, billApprovalThreshold: null }), WireCompatibilityError);
});
test("organization controls are partial, described and keep currency policy", () => {
  assert.deepEqual(organizationUpdateSchema.parse({ name: "Name" }), { name: "Name" });
  for (const value of [0, 1.5, 13, "1", null]) assert.throws(() => organizationUpdateSchema.parse({ fiscalYearStartMonth: value }));
  for (const input of [{ mileageRateMinor: "67" }, { billApprovalThreshold: 67 }, { organizationId: "foreign" }, { defaultCurrency: "IRR" }])
    assert.throws(() => organizationUpdateSchema.parse(input));
  validateOrganizationBusinessType({ country: "US", countryCode: "US", businessType: "LLC" });
  assert.throws(() => validateOrganizationBusinessType({ country: "US", countryCode: "US", businessType: "INVALID" }));
});
