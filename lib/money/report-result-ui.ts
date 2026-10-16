import { z } from "zod";
import { coreStoredMinor } from "./core-presentation";
import { taxUiCurrency } from "./tax-ui";
import { bankMoneyDisplay } from "./bank-display";
import { sources, customConfigSchema } from "@/lib/reports/custom-wire";
export { financialStatementJson as reportResultJson } from "./financial-statement-ui";
export const reportResultMoney = bankMoneyDisplay;

const currency = z.string().transform(taxUiCurrency);
const numeric = z.number().int().refine(value => Number.isSafeInteger(value) && !Object.is(value, -0));
const exact = z.string().regex(/^(0|-?[1-9]\d*)$/);
const sum = (values: bigint[]) => values.reduce((total, amount) => total + amount, 0n);
function equal(actual: bigint, expected: bigint) {
  if (actual !== expected) throw new RangeError("Report totals disagree");
}
function moneyFields<const K extends string>(...keys: K[]) {
  const shape = Object.fromEntries(keys.flatMap(key => [[key, numeric], [`${key}Minor`, exact]]));
  return z.object(shape).transform(row => Object.fromEntries(keys.map(key =>
    [key, coreStoredMinor(row[key] as number, row[`${key}Minor`] as string)])) as Record<K, bigint>);
}
const period = z.object({ startDate: z.string(), endDate: z.string() });
const vendor = z.object({ contactId: z.string(), name: z.string(), taxIdentifier: z.string().nullable(),
  w9TaxClassification: z.string().nullable(), backupWithholding: z.boolean(), paymentCount: numeric.nonnegative(), reportable: z.boolean() });
export function report1099Ui(value: unknown) {
  const header = z.object({ currencyCode: currency, taxYear: numeric, reportableCount: numeric, vendors: z.array(z.unknown()) }).parse(value);
  const totals = moneyFields("threshold", "reportableTotal", "grandTotal").parse(value);
  const vendors = header.vendors.map(value => ({ ...vendor.parse(value), ...moneyFields("totalPaid").parse(value) }));
  for (const row of vendors) if (row.reportable !== (row.totalPaid >= totals.threshold)) throw new RangeError("1099 threshold disagrees");
  const reportable = vendors.filter(row => row.reportable);
  if (header.reportableCount !== reportable.length) throw new RangeError("1099 count disagrees");
  equal(totals.reportableTotal, sum(reportable.map(row => row.totalPaid)));
  equal(totals.grandTotal, sum(vendors.map(row => row.totalPaid)));
  return { ...header, ...totals, vendors };
}
export type Report1099Ui = ReturnType<typeof report1099Ui>;

export function taxSummaryUi(value: unknown) {
  const header = z.object({ currencyCode: currency, rates: z.array(z.unknown()) }).parse(value);
  const totals = moneyFields("totalOutputTax", "totalInputTax", "netTaxPayable").parse(value);
  const rates = header.rates.map(value => {
    const row = { ...z.object({ taxRateId: z.string(), taxRateName: z.string(), rate: numeric, type: z.string() }).parse(value),
      ...moneyFields("outputTax", "outputNet", "inputTax", "inputNet", "netTax").parse(value) };
    equal(row.netTax, row.outputTax - row.inputTax);
    return row;
  });
  equal(totals.totalOutputTax, sum(rates.map(row => row.outputTax)));
  equal(totals.totalInputTax, sum(rates.map(row => row.inputTax)));
  equal(totals.netTaxPayable, totals.totalOutputTax - totals.totalInputTax);
  return { ...header, ...totals, rates };
}
export type TaxSummaryUi = ReturnType<typeof taxSummaryUi>;
export function vatReturnUi(value: unknown) {
  const header = z.object({ currencyCode: currency, basis: z.enum(["cash", "accrual"]), period, boxes: z.array(z.unknown()).length(9) }).parse(value);
  const boxes = header.boxes.map(value => ({ ...z.object({ box: z.string(), label: z.string() }).parse(value), ...moneyFields("amount").parse(value) }));
  if (boxes.some((row, i) => row.box !== String(i + 1))) throw new RangeError("VAT boxes disagree");
  equal(boxes[2].amount, boxes[0].amount + boxes[1].amount);
  equal(boxes[4].amount, boxes[2].amount - boxes[3].amount);
  return { ...header, boxes };
}
export type VatReturnUi = ReturnType<typeof vatReturnUi>;

function moneyArray(values: number[], aliases: string[], length: number) {
  if (values.length !== length || aliases.length !== length) throw new RangeError("Report columns disagree");
  return values.map((value, i) => coreStoredMinor(value, aliases[i]));
}
export function trackingReportUi(value: unknown) {
  const header = z.object({ currencyCode: currency, mode: z.enum(["pnl", "balances"]),
    columns: z.array(z.object({ key: z.string(), label: z.string(), dimensionValue: z.string().nullable() })), sections: z.array(z.unknown()) }).parse(value);
  const length = header.columns.length;
  if (new Set(header.columns.map(row => row.key)).size !== length) throw new RangeError("Duplicate tracking columns");
  const arrays = z.object({ amounts: z.array(numeric), amountsMinor: z.array(exact) });
  const sections = header.sections.map(value => {
    const section = z.object({ label: z.string(), accounts: z.array(z.unknown()), totals: z.array(numeric), totalsMinor: z.array(exact) }).parse(value);
    const accounts = section.accounts.map(value => {
      const row = z.object({ accountId: z.string(), accountCode: z.string(), accountName: z.string(), accountType: z.string() }).parse(value);
      const array = arrays.parse(value), amounts = moneyArray(array.amounts, array.amountsMinor, length);
      const { total } = moneyFields("total").parse(value);
      equal(total, sum(amounts));
      return { ...row, amounts, total };
    });
    const totals = moneyArray(section.totals, section.totalsMinor, length), { total } = moneyFields("total").parse(value);
    totals.forEach((amount, i) => equal(amount, sum(accounts.map(row => row.amounts[i]))));
    equal(total, sum(totals));
    return { label: section.label, accounts, totals, total };
  });
  let netIncome: { byColumn: bigint[]; total: bigint } | undefined;
  if (header.mode === "pnl") {
    if (sections.length !== 2 || sections[0].label !== "Revenue" || sections[1].label !== "Expenses") throw new RangeError("Tracking sections disagree");
    const net = z.object({ netIncome: z.object({ byColumn: z.array(numeric), byColumnMinor: z.array(exact) }).passthrough() }).parse(value).netIncome;
    const byColumn = moneyArray(net.byColumn, net.byColumnMinor, length), { total } = moneyFields("total").parse(net);
    byColumn.forEach((amount, i) => equal(amount, sections[0].totals[i] - sections[1].totals[i]));
    equal(total, sum(byColumn)); netIncome = { byColumn, total };
  }
  return { ...header, sections, netIncome };
}
export type TrackingReportUi = ReturnType<typeof trackingReportUi>;

const entity = z.object({ orgId: z.string(), label: z.string() });
export function consolidationReportUi(value: unknown) {
  const header = z.object({ presentationCurrency: currency,
    group: z.object({ id: z.string(), name: z.string(), presentationCurrency: currency }),
    members: z.array(z.object({ orgId: z.string(), label: z.string(), orgName: z.string(), functionalCurrency: currency })),
    consolidatedPnL: z.object({ byEntity: z.array(z.unknown()), accounts: z.array(z.unknown()) }).passthrough(),
    consolidatedBalanceSheet: z.object({ byEntity: z.array(z.unknown()), accounts: z.array(z.unknown()) }).passthrough() }).parse(value);
  if (header.group.presentationCurrency !== header.presentationCurrency) throw new RangeError("Presentation currencies disagree");
  const ids = new Set(header.members.map(row => row.orgId));
  if (ids.size !== header.members.length) throw new RangeError("Duplicate consolidation members");
  const accounts = (values: unknown[]) => values.map(value => {
    const row = z.object({ type: z.string(), name: z.string(), code: z.string(), byEntity: z.record(z.string(), numeric), byEntityMinor: z.record(z.string(), exact) }).parse(value);
    const keys = Object.keys(row.byEntity);
    if (keys.length !== Object.keys(row.byEntityMinor).length || keys.some(id => !ids.has(id) || !(id in row.byEntityMinor))) throw new RangeError("Consolidation entities disagree");
    return { ...row, ...moneyFields("total").parse(value),
      byEntity: Object.fromEntries(keys.map(id => [id, coreStoredMinor(row.byEntity[id], row.byEntityMinor[id])])) };
  });
  const pnl = header.consolidatedPnL, bs = header.consolidatedBalanceSheet;
  const consolidatedPnL = { ...moneyFields("totalRevenue", "totalExpenses", "netIncome").parse(pnl), accounts: accounts(pnl.accounts),
    byEntity: pnl.byEntity.map(value => ({ ...entity.parse(value), ...moneyFields("revenue", "expenses", "netIncome").parse(value) })) };
  const consolidatedBalanceSheet = { ...moneyFields("totalAssets", "totalLiabilities", "totalEquity", "balanceCheck").parse(bs), accounts: accounts(bs.accounts),
    byEntity: bs.byEntity.map(value => ({ ...entity.parse(value), ...moneyFields("assets", "liabilities", "equity").parse(value) })) };
  for (const rows of [consolidatedPnL.byEntity, consolidatedBalanceSheet.byEntity]) {
    if (rows.length !== ids.size || new Set(rows.map(row => row.orgId)).size !== ids.size || rows.some(row => !ids.has(row.orgId))) throw new RangeError("Consolidation summary entities disagree");
  }
  const accountTotal = (rows: { type: string; total: bigint }[], type: string) => sum(rows.filter(row => row.type === type).map(row => row.total));
  equal(consolidatedPnL.totalRevenue, accountTotal(consolidatedPnL.accounts, "revenue"));
  equal(consolidatedPnL.totalExpenses, accountTotal(consolidatedPnL.accounts, "expense"));
  equal(consolidatedPnL.netIncome, consolidatedPnL.totalRevenue - consolidatedPnL.totalExpenses);
  for (const row of consolidatedPnL.byEntity) equal(row.netIncome, row.revenue - row.expenses);
  equal(consolidatedBalanceSheet.totalAssets, accountTotal(consolidatedBalanceSheet.accounts, "asset"));
  equal(consolidatedBalanceSheet.totalLiabilities, accountTotal(consolidatedBalanceSheet.accounts, "liability"));
  equal(consolidatedBalanceSheet.totalEquity, accountTotal(consolidatedBalanceSheet.accounts, "equity"));
  equal(consolidatedBalanceSheet.balanceCheck, consolidatedBalanceSheet.totalAssets - consolidatedBalanceSheet.totalLiabilities - consolidatedBalanceSheet.totalEquity - consolidatedPnL.netIncome);
  // Entity columns are before elimination; consolidated account totals are after it.
  return { ...header, consolidatedPnL, consolidatedBalanceSheet };
}
export type ConsolidationReportUi = ReturnType<typeof consolidationReportUi>;

export function consolidationReportExport(report: ConsolidationReportUi, tab: "pnl" | "balance-sheet") {
  const members = report.members.map(member => ({ id: member.orgId, key: `${member.label} (${member.orgId})` }));
  const accounts = tab === "pnl" ? report.consolidatedPnL.accounts : report.consolidatedBalanceSheet.accounts;
  return { columns: ["type", "code", "name", ...members.map(member => member.key), "total", "currencyCode"],
    data: accounts.map((account): Record<string, string> => ({ type: account.type, code: account.code, name: account.name,
      ...Object.fromEntries(members.map(member => [member.key, (account.byEntity[member.id] ?? 0n).toString()])),
      total: account.total.toString(), currencyCode: report.presentationCurrency })) };
}

/** Request hidden carriers/currency even when the visible projection is Minor-only. */
export function customReportUiConfig(config: unknown) {
  const parsed = customConfigSchema.parse(config), columns = new Set(parsed.columns);
  for (const field of sources[parsed.dataSource].money) if (columns.has(field) || columns.has(`${field}Minor`)) {
    columns.add(field); columns.add(`${field}Minor`); columns.add("currencyCode");
  }
  return { ...parsed, columns: [...columns] };
}
export function customReportUi(value: unknown, config: unknown) {
  const parsed = customReportUiConfig(config);
  const result = z.object({ data: z.array(z.record(z.string(), z.unknown())), total: numeric.nonnegative() }).parse(value);
  if (result.total !== result.data.length) throw new RangeError("Custom report count disagrees");
  return result.data.map(row => {
    for (const col of parsed.columns) if (!(col in row)) throw new RangeError("Custom report projection is missing");
    const output = { ...row };
    for (const field of sources[parsed.dataSource].money) if (parsed.columns.includes(field)) {
      taxUiCurrency(row.currencyCode);
      if (row[field] === null && row[`${field}Minor`] === null) { output[field] = null; continue; }
      output[field] = coreStoredMinor(numeric.parse(row[field]), exact.parse(row[`${field}Minor`]));
    }
    return output;
  });
}
export function customReportCell(row: Record<string, unknown>, field: string) {
  const value = row[field];
  // Explicit Minor columns and server CSV exports retain canonical raw minor strings.
  return typeof value === "bigint" ? bankMoneyDisplay(value, taxUiCurrency(row.currencyCode)) : String(value ?? "-");
}
