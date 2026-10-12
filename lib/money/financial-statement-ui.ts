import { z } from "zod";
import { currencyMetadata, money, toMajorDecimal } from "./exact";
import { coreStoredMinor } from "./core-presentation";
import { journalRestMinor } from "./journal-display";
import { bankMoneyDisplay } from "./bank-display";
import { reportDecimal } from "../reports/statement-wire";

const currency = z.string().refine(value => {
  try { return currencyMetadata(value).code === value; } catch { return false; }
}, "A canonical report currency is required");
const exact = z.string().regex(/^(0|-?[1-9]\d*)$/);
const decimal = z.string().regex(/^-?(?:0|[1-9]\d*)\.\d{2}$/);
const numeric = z.number().refine(value => Number.isSafeInteger(value) && !Object.is(value, -0));

/** Statement decimal aliases retain fixed-two units, even for JPY/KWD/IRR. */
export function statementDecimalMinor(value: string, alias: string) {
  decimal.parse(value); exact.parse(alias);
  const amount = journalRestMinor(value, alias);
  if (reportDecimal(amount) !== value) throw new RangeError("Noncanonical statement decimal");
  return amount;
}
const split = z.object({
  debitBalance: decimal, debitBalanceMinor: exact,
  creditBalance: decimal, creditBalanceMinor: exact,
  balance: decimal, balanceMinor: exact,
}).transform(row => {
  const debitBalance = statementDecimalMinor(row.debitBalance, row.debitBalanceMinor);
  const creditBalance = statementDecimalMinor(row.creditBalance, row.creditBalanceMinor);
  const balance = statementDecimalMinor(row.balance, row.balanceMinor);
  if (debitBalance < 0n || creditBalance < 0n || debitBalance - creditBalance !== balance || (debitBalance > 0n && creditBalance > 0n)) {
    throw new RangeError("Statement split amounts disagree");
  }
  return { ...row, debitBalance, creditBalance, balance };
});
const identity = { accountId: z.string(), code: z.string(), name: z.string() };
const trialAccount = z.object({ ...identity, type: z.string(),
  debitBalance: decimal, debitBalanceMinor: exact, creditBalance: decimal, creditBalanceMinor: exact,
  balance: decimal, balanceMinor: exact, balances: z.array(split).optional(),
}).transform(row => ({ ...row, ...split.parse(row) }));
const dates = { asAt: z.string(), dates: z.array(z.string()).min(1).optional(), compareDates: z.array(z.string()).optional() };

export function trialBalanceUi(value: unknown) {
  const data = z.object({ ...dates, currencyCode: currency, accounts: z.array(trialAccount) }).parse(value);
  const columns = statementDates(data);
  for (const row of data.accounts) {
    if (columns.length > 1 && !row.balances) throw new RangeError("Missing trial comparison amounts");
    if (row.balances && (row.balances.length !== columns.length ||
      row.balances[0].balance !== row.balance || row.balances[0].debitBalance !== row.debitBalance || row.balances[0].creditBalance !== row.creditBalance)) {
      throw new RangeError("Trial comparison amounts disagree");
    }
  }
  return data;
}
export type TrialBalanceUi = ReturnType<typeof trialBalanceUi>;

const decimalAccount = z.object({ ...identity, balance: decimal, balanceMinor: exact,
  balances: z.array(decimal).optional(), balancesMinor: z.array(exact).optional(),
}).transform(row => {
  const balance = statementDecimalMinor(row.balance, row.balanceMinor);
  if (Boolean(row.balances) !== Boolean(row.balancesMinor) || row.balances?.length !== row.balancesMinor?.length) {
    throw new RangeError("Statement comparison aliases are required");
  }
  const balances = row.balances?.map((amount, i) => statementDecimalMinor(amount, row.balancesMinor![i]));
  if (balances && balances[0] !== balance) throw new RangeError("Primary statement amount disagrees");
  return { ...row, balance, balances };
});
const balanceSection = z.object({ type: z.string(), accounts: z.array(decimalAccount),
  total: decimal, totalMinor: exact, totals: z.array(decimal).optional(), totalsMinor: z.array(exact).optional(),
}).transform(row => {
  const total = statementDecimalMinor(row.total, row.totalMinor);
  if (Boolean(row.totals) !== Boolean(row.totalsMinor) || row.totals?.length !== row.totalsMinor?.length) {
    throw new RangeError("Statement comparison total aliases are required");
  }
  const totals = row.totals?.map((amount, i) => statementDecimalMinor(amount, row.totalsMinor![i]));
  if (totals && totals[0] !== total) throw new RangeError("Primary statement total disagrees");
  return { ...row, total, totals };
});
export function balanceSheetUi(value: unknown) {
  const data = z.object({ ...dates, currencyCode: currency, assets: balanceSection, liabilities: balanceSection, equity: balanceSection }).parse(value);
  const columns = statementDates(data);
  for (const [key, type] of [["assets", "asset"], ["liabilities", "liability"], ["equity", "equity"]] as const) {
    const section = data[key];
    if (section.type !== type) throw new RangeError("Statement section type disagrees");
    if ((columns.length > 1 && !section.totals) || (section.totals && section.totals.length !== columns.length)) throw new RangeError("Missing statement comparison totals");
    for (const row of section.accounts) {
      if ((columns.length > 1 && !row.balances) || (row.balances && row.balances.length !== columns.length)) throw new RangeError("Missing statement comparison amounts");
    }
    columns.forEach((_, i) => {
      if (section.accounts.reduce((sum, row) => sum + (row.balances?.[i] ?? row.balance), 0n) !== (section.totals?.[i] ?? section.total)) {
        throw new RangeError("Statement section total disagrees");
      }
    });
  }
  return data;
}
export type BalanceSheetUi = ReturnType<typeof balanceSheetUi>;

const incomeSection = z.object({ accounts: z.array(z.object({ code: z.string(), name: z.string(), balance: decimal, balanceMinor: exact })
  .transform(row => ({ ...row, balance: statementDecimalMinor(row.balance, row.balanceMinor) }))), total: decimal, totalMinor: exact })
  .transform(row => {
    const total = statementDecimalMinor(row.total, row.totalMinor);
    if (row.accounts.reduce((sum, account) => sum + account.balance, 0n) !== total) throw new RangeError("Income section total disagrees");
    return { ...row, total };
  });
export function incomeStatementUi(value: unknown) {
  const data = z.object({ currencyCode: currency, revenue: incomeSection, expenses: incomeSection, netIncome: decimal, netIncomeMinor: exact }).parse(value);
  const netIncome = statementDecimalMinor(data.netIncome, data.netIncomeMinor);
  if (data.revenue.total - data.expenses.total !== netIncome) throw new RangeError("Income statement net total disagrees");
  return { ...data, netIncome };
}
export type IncomeStatementUi = ReturnType<typeof incomeStatementUi>;

const numericAccount = z.object({ accountId: z.string(), accountName: z.string(), accountCode: z.string().optional(), balance: numeric, balanceMinor: exact })
  .transform(row => ({ ...row, balance: coreStoredMinor(row.balance, row.balanceMinor) }));
const numericPeriod = z.object({ startDate: z.string(), endDate: z.string(), revenue: z.array(numericAccount), expenses: z.array(numericAccount),
  totalRevenue: numeric, totalRevenueMinor: exact, totalExpenses: numeric, totalExpensesMinor: exact, netIncome: numeric, netIncomeMinor: exact,
}).transform(row => {
  const totalRevenue = coreStoredMinor(row.totalRevenue, row.totalRevenueMinor), totalExpenses = coreStoredMinor(row.totalExpenses, row.totalExpensesMinor);
  const netIncome = coreStoredMinor(row.netIncome, row.netIncomeMinor);
  if (row.revenue.reduce((sum, account) => sum + account.balance, 0n) !== totalRevenue ||
    row.expenses.reduce((sum, account) => sum + account.balance, 0n) !== totalExpenses || totalRevenue - totalExpenses !== netIncome) {
    throw new RangeError("Period statement totals disagree");
  }
  return { ...row, totalRevenue, totalExpenses, netIncome };
});
export function profitLossUi(value: unknown) {
  const header = z.object({ currencyCode: currency, basis: z.enum(["cash", "accrual"]), comparison: numericPeriod.optional() }).parse(value);
  return { ...numericPeriod.parse(value), ...header };
}
export type ProfitLossUi = ReturnType<typeof profitLossUi>;
const comparisonPeriod = z.object({ label: z.string(), revenueChange: numeric, revenueChangeMinor: exact, revenueChangePct: z.number(),
  expensesChange: numeric, expensesChangeMinor: exact, expensesChangePct: z.number(), netIncomeChange: numeric, netIncomeChangeMinor: exact, netIncomeChangePct: z.number() });
export function pnlComparisonUi(value: unknown) {
  const data = z.object({ currencyCode: currency, compareType: z.enum(["monthly", "quarterly", "yearly"]), periods: z.array(z.unknown()) }).parse(value);
  const periods = data.periods.map(value => {
    const changes = comparisonPeriod.parse(value);
    return { ...numericPeriod.parse(value), ...changes,
      revenueChange: coreStoredMinor(changes.revenueChange, changes.revenueChangeMinor),
      expensesChange: coreStoredMinor(changes.expensesChange, changes.expensesChangeMinor),
      netIncomeChange: coreStoredMinor(changes.netIncomeChange, changes.netIncomeChangeMinor) };
  });
  periods.forEach((current, i) => {
    const previous = periods[i - 1];
    for (const [total, change] of [["totalRevenue", "revenueChange"], ["totalExpenses", "expensesChange"], ["netIncome", "netIncomeChange"]] as const) {
      if (current[change] !== (previous ? current[total] - previous[total] : 0n)) throw new RangeError("Period statement changes disagree");
    }
  });
  return { ...data, periods };
}
export type PnlComparisonUi = ReturnType<typeof pnlComparisonUi>;

export function statementDates(data: { asAt: string; dates?: string[]; compareDates?: string[] }) {
  const columns = data.dates ?? [data.asAt];
  if (columns[0] !== data.asAt || new Set(columns).size !== columns.length ||
    (data.compareDates && (data.compareDates.length !== columns.length - 1 || data.compareDates.some((date, i) => date !== columns[i + 1])))) {
    throw new RangeError("Statement comparison dates disagree");
  }
  return columns;
}
export function trialBalanceTotals(data: TrialBalanceUi) {
  return statementDates(data).map((_, i) => data.accounts.reduce((sum, row) => {
    const split = row.balances?.[i] ?? row;
    return { debit: sum.debit + split.debitBalance, credit: sum.credit + split.creditBalance };
  }, { debit: 0n, credit: 0n }));
}
export async function financialStatementJson<T>(response: Response, parse: (body: unknown) => T): Promise<T> {
  if (!response.ok) throw new Error("Unable to load this financial report. Please try again.");
  try { return parse(await response.json()); }
  catch { throw new Error("Saved report amounts are invalid. Please reload or contact your administrator."); }
}
export const statementUiMoney = bankMoneyDisplay;
/** Only chart geometry is approximate; tooltips retain these original integers. */
export function statementChartPoint(period: PnlComparisonUi["periods"][number], currencyCode: string) {
  return { name: period.label, revenue: Number(toMajorDecimal(money(period.totalRevenue, currencyCode))),
    expenses: Number(toMajorDecimal(money(period.totalExpenses, currencyCode))), revenueExact: period.totalRevenue, expensesExact: period.totalExpenses };
}
/** UTC calendar cutoffs, current date followed by each immediately preceding month end. */
export function statementComparisonDates(today: string, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 12 || !/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new RangeError("Invalid statement comparison window");
  return Array.from({ length: count }, (_, i) => {
    if (!i) return today;
    const date = new Date(0);
    date.setUTCFullYear(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - i, 0);
    return date.toISOString().slice(0, 10);
  });
}
export function statementComparisonPeriods(data: BalanceSheetUi) {
  return statementDates(data).map((asOf, i) => {
    const section = (value: BalanceSheetUi["assets"]) => ({ ...value, total: value.totals?.[i] ?? value.total,
      accounts: value.accounts.map(row => ({ ...row, balance: row.balances?.[i] ?? row.balance })) });
    return { asOf, label: i === 0 ? "Current" : new Date(`${asOf}T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      currencyCode: data.currencyCode, assets: section(data.assets), liabilities: section(data.liabilities), equity: section(data.equity) };
  }).reverse();
}
