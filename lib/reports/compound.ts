import { db } from "@/lib/db";
import { organization, costCenter, project, invoice, bill } from "@/lib/db/schema";
import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { WireCompatibilityError } from "@/lib/money/wire";
import { analyticsCurrency } from "./document-analytics-wire";
import { aggregateAsAtExact, aggregateByDimensionExact, type ExactAccountAggregate } from "./gl-query";
import { readExactIncomePeriod } from "./period-statement";
import { cumulativeEarningsExact } from "./cumulative-statement";
import { cashBalanceExact } from "./cash-flow";
import { compoundDates, compoundDual, compoundRatio, packSchema, ratioSchema, trackingSchema } from "./compound-wire";
import type { Statement } from "./statement-export";

type Snapshot = Parameters<Parameters<typeof db.transaction>[0]>[0];
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);
const balances = (rows: ExactAccountAggregate[]) => sum(rows.map(row => row.balance));
async function read<T>(ctx: AuthContext, callback: (tx: Snapshot, currency: string) => Promise<T>) {
  requireRole(ctx, "view:data");
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    return callback(tx, analyticsCurrency(org.defaultCurrency ?? "USD"));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function getTrackingReport(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const params = trackingSchema.parse(input), range = compoundDates(params);
  const dimension = params.dimension === "project" || params.dimension === "projectId" ? "projectId" : "costCenterId";
  const mode = params.mode ?? "pnl", basis = params.basis ?? "accrual";
  return read(ctx, async (tx, currencyCode) => {
    const groups = await aggregateByDimensionExact(ctx.organizationId, range, dimension, { database: tx, basis,
      ...(mode === "pnl" ? { accountTypes: ["revenue", "expense"] } : {}) });
    const labels = new Map<string, string>();
    if (dimension === "costCenterId") {
      for (const row of await tx.select({ id: costCenter.id, code: costCenter.code, name: costCenter.name }).from(costCenter)
        .where(eq(costCenter.organizationId, ctx.organizationId))) labels.set(row.id, row.code ? `${row.code} ${row.name}` : row.name);
    } else {
      for (const row of await tx.select({ id: project.id, name: project.name }).from(project)
        .where(eq(project.organizationId, ctx.organizationId))) labels.set(row.id, row.name);
    }
    // Reject corrupted foreign dimension references instead of returning another tenant's ID.
    if (groups.some(group => group.dimensionValue !== null && !labels.has(group.dimensionValue))) {
      throw new WireCompatibilityError("Unsupported tracking dimension ownership");
    }
    const ordered = [...groups.filter(group => group.dimensionValue !== null).sort((a, b) =>
      labels.get(a.dimensionValue!)!.localeCompare(labels.get(b.dimensionValue!)!) || a.dimensionValue!.localeCompare(b.dimensionValue!)),
    ...groups.filter(group => group.dimensionValue === null)];
    const columns = ordered.map(group => ({ key: group.dimensionValue ?? "__none__",
      label: group.dimensionValue === null ? "Unassigned" : labels.get(group.dimensionValue)!, dimensionValue: group.dimensionValue }));
    const accounts = [...new Map(groups.flatMap(group => group.accounts.map(row => [row.accountId, row] as const))).values()]
      .sort((a, b) => a.code.localeCompare(b.code));
    const indexes = ordered.map(group => new Map(group.accounts.map(row => [row.accountId, row.balance])));
    const defs = mode === "pnl" ? [["Revenue", "revenue"], ["Expenses", "expense"]] as const :
      [["Assets", "asset"], ["Liabilities", "liability"], ["Equity", "equity"], ["Revenue", "revenue"], ["Expenses", "expense"]] as const;
    const sections = defs.map(([label, type]) => {
      const rows = accounts.filter(row => row.type === type).map(row => {
        const amounts = indexes.map(index => index.get(row.accountId) ?? 0n);
        return { accountId: row.accountId, accountCode: row.code, accountName: row.name, accountType: row.type, amounts, total: sum(amounts) };
      });
      const totals = columns.map((_, i) => sum(rows.map(row => row.amounts[i])));
      return { label, accounts: rows, totals, total: sum(totals) };
    });
    const byColumn = mode === "pnl" ? columns.map((_, i) => sections[0].totals[i] - sections[1].totals[i]) : undefined;
    const data = compoundDual({ dimension, mode, basis, ...range, currencyCode, columns, sections,
      ...(byColumn ? { netIncome: { byColumn, total: sum(byColumn) } } : {}) });
    const statement = (): Statement => ({ title: mode === "pnl" ? "Profit and Loss by Tracking Category" : "Account Balances by Tracking Category",
      periodLabel: `${range.startDate} to ${range.endDate}`, currency: currencyCode, columns: columns.map(column => column.label),
      sections: data.sections.map(section => ({ label: section.label, rows: section.accounts.map(row => ({ code: row.accountCode,
        name: row.accountName, amounts: row.amounts, depth: 1 })), subtotals: section.totals })),
      ...(data.netIncome ? { grandTotals: data.netIncome.byColumn } : {}) });
    return { data, statement };
  });
}

export async function getReportPack(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const params = packSchema.parse(input), range = compoundDates(params), basis = params.basis ?? "accrual";
  return read(ctx, async (tx, currency) => {
    const options = { database: tx, basis };
    const asAt = await aggregateAsAtExact(ctx.organizationId, range.endDate, { ...options, includeEmptyAccounts: true });
    const period = await readExactIncomePeriod(tx, ctx.organizationId, range.startDate, range.endDate, { basis });
    const pl = [...period.revenue, ...period.expenses];
    const before = new Date(`${range.startDate}T00:00:00Z`); before.setUTCDate(before.getUTCDate() - 1);
    const opening = range.startDate === "0001-01-01" ? [] : await aggregateAsAtExact(ctx.organizationId, before.toISOString().slice(0, 10), options);
    const filter = (rows: ExactAccountAggregate[], type: ExactAccountAggregate["type"]) => rows.filter(row => row.type === type);
    const rowsFor = (rows: ExactAccountAggregate[], type: ExactAccountAggregate["type"]) => filter(rows, type)
      .map(row => ({ code: row.code, name: row.name, amount: row.balance, depth: 1 }));
    const { totalRevenue: revenue, totalExpenses: expenses, netIncome } = period;
    // Cumulative unclosed earnings belong in the balance sheet; period income belongs in P&L.
    const earnings = cumulativeEarningsExact(asAt);
    const liabilities = balances(filter(asAt, "liability")), equity = balances(filter(asAt, "equity")) + earnings;
    const openingCash = cashBalanceExact(opening), closingCash = cashBalanceExact(asAt), netChange = closingCash - openingCash;
    const tbRows = asAt.filter(row => row.balance !== 0n).map(row => {
      const debitNormal = row.type === "asset" || row.type === "expense";
      const signed = debitNormal ? row.balance : -row.balance;
      return { code: row.code, name: row.name, amounts: [signed > 0n ? signed : 0n, signed < 0n ? -signed : 0n], depth: 1 };
    });
    const tbTotals = [0, 1].map(i => sum(tbRows.map(row => row.amounts[i])));
    const statements = compoundDual([
      { title: "Balance Sheet", periodLabel: `As at ${range.endDate}`, currency, sections: [
        { label: "Assets", rows: rowsFor(asAt, "asset"), subtotal: balances(filter(asAt, "asset")) },
        { label: "Liabilities", rows: rowsFor(asAt, "liability"), subtotal: liabilities },
        { label: "Equity", rows: [...rowsFor(asAt, "equity"), { code: "", name: "Current Earnings", amount: earnings, depth: 1 }], subtotal: equity },
      ], grandTotal: liabilities + equity },
      { title: "Profit and Loss", periodLabel: `${range.startDate} to ${range.endDate}`, currency, sections: [
        { label: "Revenue", rows: rowsFor(pl, "revenue"), subtotal: revenue },
        { label: "Expenses", rows: rowsFor(pl, "expense"), subtotal: expenses },
      ], grandTotal: netIncome },
      { title: "Trial Balance", periodLabel: `As at ${range.endDate}`, currency, columns: ["Debit", "Credit"],
        sections: [{ label: "Accounts", rows: tbRows, subtotals: tbTotals }], grandTotals: tbTotals },
      { title: "Cash Flow Summary", periodLabel: `${range.startDate} to ${range.endDate}`, currency, sections: [
        { label: "Cash Movement", rows: [
          { name: "Opening cash", amount: openingCash, depth: 1 }, { name: "Net change in cash", amount: netChange, depth: 1 },
          { name: "Closing cash", amount: closingCash, depth: 1, bold: true },
        ] },
        { label: "Reconciliation", rows: [{ name: "Net income (period)", amount: netIncome, depth: 1 },
          { name: "Net non-cash & working-capital movement", amount: netChange - netIncome, depth: 1 }], subtotal: netChange },
      ], grandTotal: closingCash },
    ]);
    return { data: { ...range, basis, currency, currencyCode: currency, statements }, statements };
  });
}

export async function getFinancialRatios(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const range = compoundDates(ratioSchema.parse(input));
  return read(ctx, async (tx, currencyCode) => {
    const accounts = await aggregateAsAtExact(ctx.organizationId, range.endDate, { database: tx });
    const period = await readExactIncomePeriod(tx, ctx.organizationId, range.startDate, range.endDate);
    const assets = accounts.filter(row => row.type === "asset"), liabilities = accounts.filter(row => row.type === "liability");
    const totalAssets = balances(assets), currentAssets = balances(assets.filter(row => !/fixed|property|equipment|intangible/.test((row.subType ?? "").toLowerCase())));
    const totalLiabilities = balances(liabilities), currentLiabilities = balances(liabilities.filter(row => !/long|mortgage/.test((row.subType ?? "").toLowerCase())));
    const totalEquity = balances(accounts.filter(row => row.type === "equity"));
    const inventory = balances(assets.filter(row => (row.subType ?? "").toLowerCase().includes("inventory")));
    const { totalRevenue, totalExpenses, netIncome } = period;
    // Outstanding documents are a current snapshot, independent of the historical GL cutoff.
    const outstanding = async (table: typeof invoice | typeof bill) => {
      const rows = await tx.select({ currency: table.currencyCode, due: sql<string>`coalesce(sum(${table.amountDue}),0)::text` }).from(table)
        .where(and(eq(table.organizationId, ctx.organizationId), isNull(table.deletedAt), notInArray(table.status, ["draft", "void", "paid"])))
        .groupBy(table.currencyCode);
      if (rows.some(row => row.currency !== currencyCode)) throw new WireCompatibilityError("Outstanding documents must use organization report currency; no implicit FX");
      return sum(rows.map(row => BigInt(row.due)));
    };
    const receivablesDue = await outstanding(invoice), payablesDue = await outstanding(bill);
    const days = Math.max(1, (Date.parse(`${range.endDate}T00:00:00Z`) - Date.parse(`${range.startDate}T00:00:00Z`)) / 86400000);
    const computed = {
      currentRatio: compoundRatio(currentAssets, currentLiabilities), quickRatio: compoundRatio(currentAssets - inventory, currentLiabilities),
      debtToEquity: compoundRatio(totalLiabilities, totalEquity), grossMargin: compoundRatio(netIncome, totalRevenue, true),
      netMargin: compoundRatio(netIncome, totalRevenue, true), dso: compoundRatio(receivablesDue, totalRevenue, false, days),
      dpo: compoundRatio(payablesDue, totalExpenses, false, days), returnOnAssets: compoundRatio(netIncome, totalAssets, true),
      returnOnEquity: compoundRatio(netIncome, totalEquity, true),
    };
    return { ...range, currencyCode, ratios: Object.fromEntries(Object.entries(computed).map(([key, value]) => [key, value.value])),
      ratiosExact: Object.fromEntries(Object.entries(computed).map(([key, value]) => [key, value.exact])),
      balances: compoundDual({ totalAssets, currentAssets, totalLiabilities, currentLiabilities, totalEquity, inventory,
        totalRevenue, totalExpenses, netIncome, receivablesDue, payablesDue }) };
  });
}
