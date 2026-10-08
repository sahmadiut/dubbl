import assert from "node:assert/strict";
import { test } from "node:test";
import { customConfigSchema, customCsv } from "../lib/reports/custom-wire";

test("custom configs validate canonical exact filters, dates and projection allowlists", () => {
  const config = { dataSource: "invoices", columns: ["totalMinor"], filters: [{ field: "totalMinor", operator: "gte", value: "9007199254740991" }] };
  assert.equal(customConfigSchema.parse(config).filters[0].value, "9007199254740991");
  for (const value of ["9007199254740992", "-9007199254740992", "01", "-0", "1.0", "1e2", " 1", "۱۲۵۰", "+1"])
    assert.equal(customConfigSchema.safeParse({ ...config, filters: [{ ...config.filters[0], value }] }).success, false);
  for (const bad of [{ ...config, groupBy: ["status"] }, { ...config, columns: ["__proto__"] }, { ...config, columns: ["total", "total"] },
    { ...config, columns: ["netAmount"] }, { ...config, filters: [{ field: "status", operator: "gt", value: "1" }] },
    { ...config, dateRange: { from: "2026-02-30", to: "2026-04-01" } }, { ...config, dateRange: { from: "2026-04-01", to: "2026-03-01" } },
    { dataSource: "contacts", columns: ["name"], dateRange: { from: "2026-01-01", to: "2026-01-02" } }])
    assert.equal(customConfigSchema.safeParse(bad).success, false);
});

test("CSV quotes commas, double quotes and newlines without money scaling", () => {
  assert.equal(customCsv(["title", "totalMinor"], [{ title: 'A,"B"\nC', totalMinor: "9007199254740991" }]),
    'title,totalMinor\n"A,""B""\nC",9007199254740991');
});
