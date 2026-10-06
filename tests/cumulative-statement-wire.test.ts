import assert from "node:assert/strict";
import { test } from "node:test";
import { cumulativeReportQuery, cumulativeReportSchema, reportDecimal, reportMinor, reportStoredMinor } from "../lib/reports/statement-wire";
import { statementCellNumber, statementMoneyText } from "../lib/reports/statement-money";
import { WireCompatibilityError } from "../lib/money/wire";
import { toXlsx, toPdf, type Statement } from "../lib/reports/statement-export";
import { toWorkbookXlsx } from "../lib/reports/statements-workbook";

test("statement cents preserve fixed two-place JSON and safe signed edges", () => {
  for (const [minor, decimal] of [[0n, "0.00"], [1n, "0.01"], [-1n, "-0.01"], [1250n, "12.50"],
    [9007199254740991n, "90071992547409.91"], [-9007199254740991n, "-90071992547409.91"]] as const) {
    assert.equal(reportDecimal(minor), decimal); assert.equal(BigInt(reportMinor(minor)), minor);
  }
  for (const amount of [9007199254740992n, -9007199254740992n, 2n ** 70n]) {
    assert.throws(() => reportMinor(amount), WireCompatibilityError);
    assert.throws(() => reportDecimal(amount), WireCompatibilityError);
  }
  for (const amount of [NaN, Infinity, 0.1, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => reportStoredMinor(amount), WireCompatibilityError);
});

test("cumulative report real Gregorian dates, aliases and query bounds", () => {
  const parse = (query: string) => cumulativeReportQuery(new Request(`http://fixture.test/${query}`));
  assert.deepEqual(parse("?asOf=2024-02-29&compareDate=2024-01-01,2023-12-31&compareDate=2024-01-01&format=XLSX"), {
    input: { asAt: "2024-02-29", compareDates: ["2024-01-01", "2023-12-31", "2024-01-01"] }, format: "xlsx",
  });
  for (const date of ["0001-01-01", "9999-12-31", "2024-02-29"]) cumulativeReportSchema.parse({ asAt: date });
  for (const query of ["?asAt=2023-02-29", "?asAt=2024-02-30", "?asAt=2024-13-01", "?asAt=0000-01-01", "?asAt=", "?compareDate=",
    "?asAt=2024-01-01&asAt=2024-01-01", "?asAt=2024-01-01&asOf=2024-01-02", "?asOf=bad", "?format=csv", "?amountMinor=1"]) assert.throws(() => parse(query));
  assert.throws(() => cumulativeReportSchema.parse({ compareDates: Array(13).fill("2024-01-01") }));
});

test("export money retains existing currency scales and rejects lossy numeric cells", () => {
  for (const [currency, numeric] of [["USD", 12.5], ["IRR", 1250], ["JPY", 1250], ["KWD", 1.25]] as const) {
    assert.equal(statementCellNumber(1250, currency), numeric);
    assert.equal(statementCellNumber(-1250, currency), -numeric);
  }
  assert.equal(statementMoneyText(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
  assert.equal(statementMoneyText(-1, "USD"), "-$0.01");
  assert.equal(statementMoneyText(Number.MAX_SAFE_INTEGER, "KWD"), "KWD 9,007,199,254,740.991");
  assert.equal(statementCellNumber(9007199254740000, "USD"), 90071992547400);
  for (const currency of ["USD", "IRR", "JPY", "KWD"]) assert.throws(() => statementCellNumber(Number.MAX_SAFE_INTEGER, currency), WireCompatibilityError);
  assert.throws(() => statementMoneyText(1, "XXX"), WireCompatibilityError);
});

test("actual statement and multi-sheet exports preserve numeric cents and text safety", async () => {
  const statement: Statement = { title: "Trial Balance", periodLabel: "As at 2024-01-01", currency: "USD", columns: ["Current", "Prior"],
    sections: [{ label: "Accounts", rows: [{ code: "=1+1", name: "@secret", amounts: [1250, -1], depth: 0 }], subtotals: [1250, -1] }] };
  const ExcelJS = (await import("exceljs")).default;
  for (const buffer of [await toXlsx(statement), await toWorkbookXlsx([statement])]) {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as never);
    const row = workbook.worksheets[0].getRow(5);
    assert.equal(row.getCell(1).value, "'=1+1"); assert.equal(row.getCell(2).value, "'@secret");
    assert.equal(row.getCell(3).value, 12.5); assert.equal(row.getCell(4).value, -0.01);
  }
  const unsafe: Statement = { ...statement, sections: [{ label: "Unsafe", rows: [{ name: "Edge", amounts: [Number.MAX_SAFE_INTEGER], depth: 0 }] }] };
  await assert.rejects(toXlsx(unsafe), WireCompatibilityError); await assert.rejects(toWorkbookXlsx([unsafe]), WireCompatibilityError);
  const pdf = await toPdf(unsafe); assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});
