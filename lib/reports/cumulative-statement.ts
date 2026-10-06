import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { aggregateAsAtExact } from "./gl-query";
import { cumulativeReportSchema, reportDecimal, reportMinor } from "./statement-wire";
import type { Statement } from "./statement-export";

type ReportKind = "trial-balance" | "balance-sheet";
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);

/** Shared REST/MCP read service: comparisons and earnings use one repeatable-read snapshot. */
export async function getCumulativeStatement(ctx: AuthContext, kind: ReportKind, input: unknown) {
  requireRole(ctx, "view:data");
  const params = cumulativeReportSchema.parse(input);
  const asAt = params.asAt ?? new Date().toISOString().slice(0, 10);
  const compareDates = [...new Set(params.compareDates ?? [])].filter(date => date !== asAt);
  const dates = [asAt, ...compareDates];
  const comparative = compareDates.length > 0;
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    const currency = org.defaultCurrency ?? "USD";
    try { if (currencyMetadata(currency).code !== currency) throw new Error(); }
    catch { throw new WireCompatibilityError("Unsupported organization report currency"); }
    const perDate = await Promise.all(dates.map(date => aggregateAsAtExact(ctx.organizationId, date, {
      database: tx, includeEmptyAccounts: true,
    })));
    const indexed = perDate.map(accounts => new Map(accounts.map(account => [account.accountId, account.balance])));
    const rows = perDate[0].map(account => ({
      accountId: account.accountId, code: account.code, name: account.name, type: account.type,
      balances: indexed.map(accounts => accounts.get(account.accountId) ?? 0n),
    }));
    const envelope = { asAt, currencyCode: currency, ...(comparative ? { dates, compareDates } : {}) };
    const columnAmounts = (values: bigint[]) => comparative
      ? { amounts: values.map(reportMinor) } : { amount: reportMinor(values[0]) };
    const statementBase = {
      title: kind === "trial-balance" ? "Trial Balance" : "Balance Sheet",
      periodLabel: `As at ${asAt}`, currency,
      ...(comparative ? { columns: dates.map(date => `As at ${date}`) } : {}),
    };
    if (kind === "trial-balance") {
      // Preserve the existing natural-sign split. Accounting correction remains PAR-008/QA-001.
      const split = (balance: bigint) => {
        const debit = balance > 0n ? balance : 0n, credit = balance < 0n ? -balance : 0n;
        return { debitBalance: reportDecimal(debit), debitBalanceMinor: debit.toString(),
          creditBalance: reportDecimal(credit), creditBalanceMinor: credit.toString(),
          balance: reportDecimal(balance), balanceMinor: balance.toString() };
      };
      const accounts = rows.map(row => ({ accountId: row.accountId, code: row.code, name: row.name, type: row.type,
        ...split(row.balances[0]), ...(comparative ? { balances: row.balances.map(split) } : {}) }));
      // Export-only totals are guarded when exports are requested, not when JSON clients read rows.
      const statement = (): Statement => {
        const totals = dates.map((_, i) => reportMinor(sum(rows.map(row => row.balances[i]))));
        return { ...statementBase, sections: [{ label: "Accounts",
          rows: rows.map(row => ({ code: row.code, name: row.name, ...columnAmounts(row.balances), depth: 0 })),
          ...(comparative ? { subtotals: totals } : { subtotal: totals[0] }),
        }] };
      };
      return { data: { ...envelope, accounts }, statement };
    }
    const earnings = perDate.map(accounts => sum(accounts.filter(account => ["revenue", "expense"].includes(account.type))
      .map(account => account.type === "revenue" ? account.balance : -account.balance)));
    const sections = (["asset", "liability", "equity"] as const).map(type => {
      const accounts = rows.filter(row => row.type === type);
      if (type === "equity" && earnings.some(value => value !== 0n)) accounts.push({
        accountId: "current-year-earnings", code: "", name: "Current Year Earnings", type, balances: earnings,
      });
      const totals = dates.map((_, i) => sum(accounts.map(account => account.balances[i])));
      return { type, accounts, totals };
    });
    const jsonSection = (section: typeof sections[number]) => ({ type: section.type,
      accounts: section.accounts.map(account => ({ accountId: account.accountId, code: account.code, name: account.name,
        balance: reportDecimal(account.balances[0]), balanceMinor: account.balances[0].toString(),
        ...(comparative ? { balances: account.balances.map(reportDecimal), balancesMinor: account.balances.map(String) } : {}),
      })), total: reportDecimal(section.totals[0]), totalMinor: section.totals[0].toString(),
      ...(comparative ? { totals: section.totals.map(reportDecimal), totalsMinor: section.totals.map(String) } : {}),
    });
    const statement = (): Statement => ({ ...statementBase, sections: sections.map(section => ({
      label: section.type === "asset" ? "Assets" : section.type === "liability" ? "Liabilities" : "Equity",
      rows: section.accounts.map(account => ({ code: account.code, name: account.name, ...columnAmounts(account.balances), depth: 1 })),
      ...(comparative ? { subtotals: section.totals.map(reportMinor) } : { subtotal: reportMinor(section.totals[0]) }),
    })) });
    return { data: { ...envelope, assets: jsonSection(sections[0]), liabilities: jsonSection(sections[1]), equity: jsonSection(sections[2]) }, statement };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
