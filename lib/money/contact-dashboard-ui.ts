import { z } from "zod";
import { currencyMetadata, money, toMajorDecimal, roundRatio } from "./exact";
import { coreStoredMinor } from "./core-presentation";
import { bankMoneyDisplay } from "./bank-display";
import { journalInputMinor } from "./journal-display";
export { financialStatementJson as displayJson } from "./financial-statement-ui";
export const displayMoney = bankMoneyDisplay;

const currency = z.string().refine(value => {
  try { return currencyMetadata(value).code === value; } catch { return false; }
}, "A canonical currency is required");
const exact = z.string().regex(/^(0|-?[1-9]\d*)$/);
const numeric = z.number().refine(value => Number.isSafeInteger(value) && !Object.is(value, -0));
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const alias = <K extends string>(key: K) => ({ [key]: numeric, [`${key}Minor`]: exact }) as Record<K, typeof numeric> & Record<`${K}Minor`, typeof exact>;
const credit = z.object({ currencyCode: currency.nullable(), creditLimit: numeric.nullable(), creditLimitMinor: exact.nullable() }).passthrough();
/** Contact monetary properties are stored currency minor units; null limits must agree. */
export function contactUi<T>(value: T): Omit<T, "creditLimit" | "currencyCode"> & { creditLimit: bigint | null; currencyCode: string | null } {
  const row = credit.parse(value);
  if ((row.creditLimit === null) !== (row.creditLimitMinor === null)) throw new RangeError("Credit limit aliases disagree");
  const amount = row.creditLimit === null ? null : coreStoredMinor(row.creditLimit, row.creditLimitMinor!);
  if (amount !== null && (amount < 0n || !row.currencyCode)) throw new RangeError("Credit limit needs a currency and nonnegative amount");
  return { ...value, creditLimit: amount, currencyCode: row.currencyCode };
}
export function contactDetailUi<T>(value: T) { return contactUi(value); }
export function contactListUi<T>(value: T) {
  const row = z.object({ ...alias("owesYou"), ...alias("youOwe"), ...alias("overdue") }).parse(value);
  const owesYou = coreStoredMinor(row.owesYou, row.owesYouMinor), youOwe = coreStoredMinor(row.youOwe, row.youOweMinor);
  const overdue = coreStoredMinor(row.overdue, row.overdueMinor), contact = contactUi(value);
  if (!contact.currencyCode) throw new RangeError("Contact balances require their saved currency");
  return { ...contact, owesYou, youOwe, overdue };
}
export function contactCreditDecimal(amount: bigint | null, code: string | null) {
  if (amount === null) return "";
  if (!code) throw new RangeError("Credit limit currency is required");
  return toMajorDecimal(money(amount, code));
}
export function contactCreditInput(text: string, code: string) {
  return { creditLimitMinor: text === "" ? null : journalInputMinor(text, currency.parse(code)).toString() };
}

const activityItem = z.object({ id: z.string(), type: z.enum(["invoice", "quote", "credit_note", "payment", "bill"]),
  number: z.string(), status: z.string(), date: z.string(), createdAt: z.string(), currencyCode: currency, ...alias("amount") })
  .transform(row => ({ ...row, amount: coreStoredMinor(row.amount, row.amountMinor) }));
export function contactActivityUi(value: unknown) {
  return z.object({ activity: z.array(activityItem), nextCursor: z.string().nullable(), hasMore: z.boolean() }).parse(value);
}
export type ContactActivityUi = z.infer<typeof activityItem>;
const transaction = z.object({ date: z.string(), type: z.string(), documentNumber: z.string(), description: z.string(), currencyCode: currency,
  ...alias("debit"), ...alias("credit"), ...alias("balance") }).transform(row => ({ ...row,
  debit: coreStoredMinor(row.debit, row.debitMinor), credit: coreStoredMinor(row.credit, row.creditMinor), balance: coreStoredMinor(row.balance, row.balanceMinor) }));
export function contactStatementUi(value: unknown) {
  const row = z.object({ contact: z.object({ id: z.string(), name: z.string(), email: z.string().nullable(), type: z.string() }),
    startDate: z.string(), endDate: z.string(), currencyCode: currency, transactions: z.array(transaction),
    ...alias("openingBalance"), ...alias("closingBalance"), ...alias("totalDebit"), ...alias("totalCredit") }).parse(value);
  const openingBalance = coreStoredMinor(row.openingBalance, row.openingBalanceMinor), closingBalance = coreStoredMinor(row.closingBalance, row.closingBalanceMinor);
  const totalDebit = coreStoredMinor(row.totalDebit, row.totalDebitMinor), totalCredit = coreStoredMinor(row.totalCredit, row.totalCreditMinor);
  let balance = openingBalance;
  for (const entry of row.transactions) {
    balance += entry.debit - entry.credit;
    if (entry.currencyCode !== row.currencyCode || entry.balance !== balance) throw new RangeError("Statement movement disagrees");
  }
  if (balance !== closingBalance || row.transactions.reduce((sum, entry) => sum + entry.debit, 0n) !== totalDebit ||
    row.transactions.reduce((sum, entry) => sum + entry.credit, 0n) !== totalCredit) throw new RangeError("Statement totals disagree");
  return { ...row, openingBalance, closingBalance, totalDebit, totalCredit };
}
export type ContactStatementUi = ReturnType<typeof contactStatementUi>;

const forecastWeek = z.object({ weekOf: z.string(), entryCount: count, ...alias("inflows"), ...alias("outflows"), ...alias("net"), ...alias("cumulativeNet") })
  .transform(row => ({ ...row, inflows: coreStoredMinor(row.inflows, row.inflowsMinor), outflows: coreStoredMinor(row.outflows, row.outflowsMinor),
    net: coreStoredMinor(row.net, row.netMinor), cumulativeNet: coreStoredMinor(row.cumulativeNet, row.cumulativeNetMinor) }));
export function cashForecastUi(value: unknown) {
  const row = z.object({ currencyCode: currency, forecastPeriod: z.object({ start: z.string(), end: z.string(), weeks: count.min(1).max(52) }),
    ...alias("totalInflows"), ...alias("totalOutflows"), ...alias("netForecast"), weeks: z.array(forecastWeek).min(1) }).parse(value);
  const totalInflows = coreStoredMinor(row.totalInflows, row.totalInflowsMinor), totalOutflows = coreStoredMinor(row.totalOutflows, row.totalOutflowsMinor);
  const netForecast = coreStoredMinor(row.netForecast, row.netForecastMinor);
  let net = 0n;
  row.weeks.forEach((week, i) => {
    net += week.net;
    if (week.inflows < 0n || week.outflows < 0n || week.net !== week.inflows - week.outflows || week.cumulativeNet !== net ||
      (i > 0 && row.weeks[i - 1].weekOf >= week.weekOf)) throw new RangeError("Forecast week disagrees");
  });
  if (row.weeks.reduce((sum, week) => sum + week.inflows, 0n) !== totalInflows || row.weeks.reduce((sum, week) => sum + week.outflows, 0n) !== totalOutflows ||
    totalInflows - totalOutflows !== netForecast || net !== netForecast) throw new RangeError("Forecast totals disagree");
  return { ...row, totalInflows, totalOutflows, netForecast };
}
export type CashForecastUi = ReturnType<typeof cashForecastUi>;
/** Only chart coordinates are approximate; labels and tooltips use the original integers. */
export function forecastChartPoint(week: CashForecastUi["weeks"][number], currencyCode: string) {
  const coordinate = (value: bigint) => Number(toMajorDecimal(money(value, currencyCode)));
  return { name: new Date(`${week.weekOf}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), currencyCode,
    inflows: coordinate(week.inflows), outflows: coordinate(week.outflows), balance: coordinate(week.cumulativeNet),
    inflowsExact: week.inflows, outflowsExact: week.outflows, balanceExact: week.cumulativeNet };
}
const alertTotal = z.object({ count, currencyCode: currency, ...alias("total") })
  .transform(row => ({ ...row, total: coreStoredMinor(row.total, row.totalMinor) }));
export function dashboardAlertsUi(value: unknown) {
  return z.object({ overdueInvoices: alertTotal, overdueBills: alertTotal, uncategorizedTransactions: count,
    accountsNeedingReconciliation: z.array(z.object({ bankAccountName: z.string(), lastReconDate: z.string().nullable() })) }).parse(value);
}
export function dashboardTrendsUi(value: unknown) {
  const row = z.object({ currencyCode: currency,
    revenueSparkline: z.array(numeric), revenueSparklineMinor: z.array(exact),
    expenseSparkline: z.array(numeric), expenseSparklineMinor: z.array(exact),
    netIncomeSparkline: z.array(numeric), netIncomeSparklineMinor: z.array(exact),
  }).parse(value);
  const read = (values: number[], aliases: string[]) => {
    if (values.length !== aliases.length) throw new RangeError("Trend aliases disagree");
    return values.map((value, i) => coreStoredMinor(value, aliases[i]));
  };
  const revenue = read(row.revenueSparkline, row.revenueSparklineMinor), expenses = read(row.expenseSparkline, row.expenseSparklineMinor);
  const netIncome = read(row.netIncomeSparkline, row.netIncomeSparklineMinor);
  if (revenue.length !== expenses.length || revenue.length !== netIncome.length ||
    revenue.some((value, i) => value - expenses[i] !== netIncome[i])) throw new RangeError("Trend net income disagrees");
  const geometry = (values: bigint[]) => values.map(value => Number(toMajorDecimal(money(value, row.currencyCode))));
  return { currencyCode: row.currencyCode, revenue: geometry(revenue), expenses: geometry(expenses), netIncome: geometry(netIncome) };
}
/** Rounded display percentages/geometry only, calculated from exact integers. */
export function displayPercent(part: bigint, total: bigint) {
  if (total <= 0n) return 0;
  const scaled = roundRatio(part * 10000n, total, "half-away-from-zero");
  return Number(scaled) / 100;
}
