import assert from "node:assert/strict";
import { test } from "node:test";
import { importMajor, importExactMajor, importAmount, profileSchema } from "../lib/api/bank-import-wire";
import { parseBankStatement } from "../lib/banking/importer";

test("exact bank major conversion keeps signs, scales, grouping and safe cent edges", () => {
  for (const [text, code, minor] of [["12.50", "USD", 1250], ["1250", "JPY", 1250], ["1.250", "KWD", 1250], ["1250", "IRR", 1250], ["(1,234.56)", "USD", -123456], ["1.234,56", "EUR", 123456], ["90071992547409.91", "USD", Number.MAX_SAFE_INTEGER], ["-90071992547409.91", "USD", -Number.MAX_SAFE_INTEGER]] as const)
    assert.equal(importMajor(text, code), minor);
  assert.equal(importAmount("12.50", "1250", "USD"), 1250);
  assert.equal(importExactMajor("12.50", "USD"), 1250);
  assert.throws(() => importExactMajor("12,50", "USD"));
  assert.equal(importAmount(undefined, "-1250", "USD"), -1250);
  for (const text of ["", "junk", "1e3", "12.50oops", "1,23,456", "1.001", "--1", "(-1)", "NaN", "90071992547409.92", "EUR 12.50"])
    assert.throws(() => importMajor(text, "USD"), text);
  assert.throws(() => importMajor(90071992547409.9, "USD"));
  assert.throws(() => importAmount("12.50", "1251", "USD"));
  for (const alias of ["+1250", "01250", "-0", "1e3", "9223372036854775808"]) assert.throws(() => importAmount(undefined, alias, "USD"));
});
test("CSV exact aliases, split signs and explicit parser profiles", () => {
  const csv = (content: string) => parseBankStatement({ content, format: "csv" });
  assert.equal(csv("date,description,amountMinor,balanceMinor\n2026-10-04,Deposit,1250,5000000000").transactions[0].amount, 1250);
  assert.equal(csv("date,description,amount,amountMinor\n2026-10-04,Deposit,12.50,1250").transactions[0].amount, 1250);
  assert.throws(() => csv("date,description,amount,amountMinor\n2026-10-04,Deposit,12.50,1251"));
  assert.equal(csv("date,amount\n04-Oct-2026,12.50").transactions[0].date, "2026-10-04");
  assert.equal(csv("date,description,debit,credit\n2026-10-04,Out,12.50,2.50").transactions[0].amount, -1000);
  const profile = profileSchema.parse({ dateFormat: "DD/MM/YYYY", decimalSeparator: ",", thousandSeparator: ".", csvDelimiter: ";", debitIsNegative: false });
  const parsed = parseBankStatement({ content: "date;description;debit;credit\n04/10/2026;Out;12,50;2,50", format: "csv" }, "USD", profile);
  assert.equal(parseBankStatement({ content: "date;amount;amountExact;amountMinor\n04/10/2026;12,50;12.50;1250", format: "csv" }, "USD", profile).transactions[0].amount, 1250);
  assert.equal(parsed.transactions[0].date, "2026-10-04"); assert.equal(parsed.transactions[0].amount, 1000);
  for (const content of ["date,amount\n2026-02-30,12.50", "date,amount\n,12.50", "date,amount\n2026-10-04,junk", "date,amount\n2026-10-04,1,234.56", 'date,amount\n2026-10-04,"12.50']) assert.throws(() => csv(content));
  assert.throws(() => profileSchema.parse({ decimalSeparator: ".", thousandSeparator: "." }));
});
test("all statement formats retain their own monetary syntax and directions", () => {
  const ofx = "<OFX><CURDEF>USD\n<ACCTID>1\n<DTSTART>20261004000000\n<DTEND>20261004000000\n<BALAMT>-12.50\n<STMTTRN><DTPOSTED>20261004000000\n<TRNAMT>-12.50\n<FITID>1\n</STMTTRN></OFX>";
  const camt = '<Document><Ccy>USD</Ccy><Bal><Cd>OPBD</Cd><Amt Ccy="USD">12.50</Amt><CdtDbtInd>DBIT</CdtDbtInd></Bal><Ntry><Amt Ccy="USD">12.50</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-10-04</Dt></BookgDt></Ntry></Document>';
  const mt = ":20:1\n:25:bank\n:60F:D261004USD12,50\n:61:261004D12,50NTRFref\n:62F:D261004USD25,00";
  for (const format of ["ofx", "qfx", "qbo"] as const) { const p = parseBankStatement({ content: ofx, format }); assert.equal(p.transactions[0].amount, -1250); assert.equal(p.closingBalance, -1250); }
  for (const format of ["camt052", "camt053", "camt054"] as const) { const p = parseBankStatement({ content: camt, format }); assert.equal(p.transactions[0].amount, -1250); assert.equal(p.openingBalance, -1250); }
  for (const format of ["mt940", "mt942"] as const) { const p = parseBankStatement({ content: mt, format }); assert.equal(p.transactions[0].amount, -1250); assert.equal(p.openingBalance, -1250); assert.equal(p.closingBalance, -2500); }
  assert.equal(parseBankStatement({ content: "!Type:Bank\nD10/04/2026\nT-12.50\nPFixture\n^", format: "qif" }).transactions[0].amount, -1250);
  assert.equal(parseBankStatement({ content: "date\tdescription\tamount\n2026-10-04\tDeposit\t12.50", format: "tsv" }).transactions[0].amount, 1250);
  const bai = "02,sender,receiver,1,261004,0000,USD/\n03,bank,USD/\n16,475,00001250,,ref,,Out/";
  assert.equal(parseBankStatement({ content: bai, format: "bai2" }).transactions[0].amount, -1250);
  assert.throws(() => parseBankStatement({ content: ofx.replace("USD", "EUR"), format: "ofx" }));
  assert.throws(() => parseBankStatement({ content: camt.replace('Ccy="USD"', 'Ccy="EUR"'), format: "camt053" }));
  assert.throws(() => parseBankStatement({ content: "03,bank,USD/\n16,475,1250,,ref,,Out/", format: "bai2" }));
});
