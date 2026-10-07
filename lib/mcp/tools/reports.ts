import { getGeneralLedger, getAccountTransactions } from "@/lib/reports/ledger-detail";
import { generalLedgerSchema, accountTransactionsSchema } from "@/lib/reports/ledger-detail-wire";
import { getProfitLoss, getIncomeStatement, getPnlComparison } from "@/lib/reports/period-statement";
import { profitLossSchema, incomeStatementSchema, pnlComparisonSchema } from "@/lib/reports/period-statement-wire";
import { getDocumentAnalytics } from "@/lib/reports/document-analytics";
import { documentAnalyticsSchema } from "@/lib/reports/document-analytics-wire";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  chartAccount,
  journalLine,
  journalEntry,
  invoice,
  costCenter,
  project,
  bill,
  organization,
} from "@/lib/db/schema";
import { eq, and, sql, isNull, ne, gte, lte, inArray } from "drizzle-orm";
import { getCumulativeStatement } from "@/lib/reports/cumulative-statement";
import { getAgingReport } from "@/lib/reports/aging";
import { agingSchema } from "@/lib/reports/aging-wire";
import { cumulativeReportSchema } from "@/lib/reports/statement-wire";
import { wrapTool } from "@/lib/mcp/errors";
import { requireRole } from "@/lib/api/require-role";
import type { AuthContext } from "@/lib/api/auth-context";
import type { Statement } from "@/lib/reports/statement-export";
import {
  aggregateAsAt,
  aggregateByDateRange,
  aggregateByDimension,
  type AccountAggregate,
  type Dimension,
  type DimensionGroup,
  type ReportBasis,
} from "@/lib/reports/gl-query";

/** Normalize a basis string to the gl-query ReportBasis ('accrual' default). */
function parseBasis(value: string | undefined): ReportBasis {
  return value === "cash" ? "cash" : "accrual";
}

export function registerReportTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("general_ledger", {
    description: "Read posted non-deleted organization-base ledger for an inclusive Gregorian period, owned account and optional owned dimension. Returns account summaries or paginated entries, numeric integer cents and exact Minor strings, opening/period/running/closing balances and currencyCode; safe +/-9007199254740991. Period runningBalance/balance exclude opening history; ledgerBalance/closingLedgerBalance include it. Defaults to current UTC year, today and 50 lines; requires view:data; no FX or input amounts.",
    inputSchema: generalLedgerSchema,
  }, params => wrapTool(ctx, async () => (await getGeneralLedger(ctx, params)).data));
  server.registerTool("account_transactions", {
    description: "Read every posted non-deleted line for an owned account and inclusive Gregorian period (current UTC year through today by default). Returns account metadata, transactions, numeric integer cents and exact Minor strings, period runningBalance/closingBalance, openingBalance and ledgerBalance/closingLedgerBalance including prior history, plus currencyCode; safe +/-9007199254740991. Requires view:data; no FX or input amounts.",
    inputSchema: accountTransactionsSchema,
  }, params => wrapTool(ctx, () => getAccountTransactions(ctx, params)));

  for (const [name, kind, label] of [
    ["trial_balance", "trial-balance", "Trial balance"],
    ["balance_sheet", "balance-sheet", "Balance sheet"],
  ] as const) {
    server.tool(name,
      `${label} from posted, non-deleted organization-base GL through inclusive Gregorian asAt (UTC today by default). Optional compareDates add cumulative columns. Legacy fixed two-place decimal strings retain their units; additive Minor strings contain exact signed integer cents within +/-9007199254740991. Returns accounts/sections and currencyCode. No input amounts or FX; requires view:data. Trial balance retains the existing natural-sign presentation.`,
      cumulativeReportSchema.shape,
      params => wrapTool(ctx, async () => (await getCumulativeStatement(ctx, kind, params)).data),
    );
  }

  server.registerTool("profit_and_loss", {
    description: "Read posted non-deleted base GL revenue/expenses for an inclusive Gregorian period, cash/accrual basis and owned dimension. Returns numeric integer cents, additive Minor strings, totals, optional comparison and currencyCode; safe +/-9007199254740991. Defaults to current UTC year through today; requires view:data; no FX or input amounts.",
    inputSchema: profitLossSchema,
  }, params => wrapTool(ctx, async () => (await getProfitLoss(ctx, params)).data));
  server.registerTool("income_statement", {
    description: "Read revenue/expense accounts including empty accounts for optional inclusive Gregorian from/to. Returns fixed two-place decimal strings and exact integer-cent Minor strings, sections, netIncome and currencyCode; safe +/-9007199254740991. Omitted bounds mean all history; posted non-deleted scoped GL only; requires view:data; no FX or input amounts.",
    inputSchema: incomeStatementSchema,
  }, params => wrapTool(ctx, () => getIncomeStatement(ctx, params)));
  server.registerTool("pnl_comparison", {
    description: "Compare 1-12 full calendar months/quarters/years through the UTC asAt period. Returns numeric integer cents and exact Minor strings for accounts, totals and consecutive changes, two-place numeric percentage changes and currencyCode; safe +/-9007199254740991. Posted non-deleted scoped GL only; requires view:data; no FX or input amounts.",
    inputSchema: pnlComparisonSchema,
  }, params => wrapTool(ctx, () => getPnlComparison(ctx, params)));

  server.registerTool("aged_receivables", {
    description: "Read outstanding invoices grouped into aging buckets with counts, numeric integer cents and amountDueMinor/totalMinor/grandTotalMinor strings (safe +/-9007199254740991). Optional asAt reconstructs a historical open balance from scoped allocations; omit for current stored balances. Optional currencyCode filters document currency; mixed currencies reject without FX conversion. Requires view:data.",
    inputSchema: agingSchema,
  }, params => wrapTool(ctx, async () => (await getAgingReport(ctx, "receivables", params)).data));

  server.registerTool("aged_payables", {
    description: "Read outstanding bills grouped into aging buckets with counts, numeric integer cents and amountDueMinor/totalMinor/grandTotalMinor strings (safe +/-9007199254740991). Optional asAt reconstructs a historical open balance from scoped allocations; omit for current stored balances. Optional currencyCode filters document currency; mixed currencies reject without FX conversion. Requires view:data.",
    inputSchema: agingSchema,
  }, params => wrapTool(ctx, async () => (await getAgingReport(ctx, "payables", params)).data));

  server.tool(
    "stripe_fee_report",
    "Generate a Stripe fee report grouped by month. Shows total fees, fee refunds, net fees, and transaction count per month. Amounts in integer cents.",
    {
      startDate: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD, default 90 days ago)"),
      endDate: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD, default today)"),
      integrationId: z
        .string()
        .optional()
        .describe("UUID of a specific Stripe integration to filter by"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const endDate = params.endDate ?? new Date().toISOString().slice(0, 10);
        const startDate = params.startDate ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const conditions = [
          eq(journalEntry.organizationId, ctx.organizationId),
          eq(journalEntry.status, "posted"),
          isNull(journalEntry.deletedAt),
          gte(journalEntry.date, startDate),
          lte(journalEntry.date, endDate),
          inArray(journalEntry.sourceType, ["stripe_fee", "stripe_fee_refund"]),
        ];

        if (params.integrationId) {
          // Filter by reference to get entries from this integration only
          // Entries are linked via stripeEntityMap, but we can use sourceType filter for simplicity
        }

        const entries = await db
          .select({
            month: sql<string>`to_char(${journalEntry.date}::date, 'YYYY-MM')`.as("month"),
            sourceType: journalEntry.sourceType,
            totalDebit: sql<number>`coalesce(sum(${journalLine.debitAmount}), 0)`,
            totalCredit: sql<number>`coalesce(sum(${journalLine.creditAmount}), 0)`,
            count: sql<number>`count(distinct ${journalEntry.id})`.mapWith(Number),
          })
          .from(journalEntry)
          .innerJoin(journalLine, eq(journalLine.journalEntryId, journalEntry.id))
          .where(and(...conditions))
          .groupBy(sql`to_char(${journalEntry.date}::date, 'YYYY-MM')`, journalEntry.sourceType)
          .orderBy(sql`to_char(${journalEntry.date}::date, 'YYYY-MM')`);

        // Group by month
        const monthMap = new Map<string, { totalFees: number; totalRefunds: number; transactionCount: number }>();

        for (const row of entries) {
          const existing = monthMap.get(row.month) ?? { totalFees: 0, totalRefunds: 0, transactionCount: 0 };

          if (row.sourceType === "stripe_fee") {
            existing.totalFees += Number(row.totalDebit);
            existing.transactionCount += row.count;
          } else if (row.sourceType === "stripe_fee_refund") {
            existing.totalRefunds += Number(row.totalCredit);
            existing.transactionCount += row.count;
          }

          monthMap.set(row.month, existing);
        }

        const periods = Array.from(monthMap.entries()).map(([month, data]) => ({
          month,
          totalFees: data.totalFees,
          totalRefunds: data.totalRefunds,
          netFees: data.totalFees - data.totalRefunds,
          transactionCount: data.transactionCount,
        }));

        const totals = periods.reduce(
          (acc, p) => ({
            totalFees: acc.totalFees + p.totalFees,
            totalRefunds: acc.totalRefunds + p.totalRefunds,
            netFees: acc.netFees + p.netFees,
            transactionCount: acc.transactionCount + p.transactionCount,
          }),
          { totalFees: 0, totalRefunds: 0, netFees: 0, transactionCount: 0 }
        );

        return { startDate, endDate, periods, totals };
      })
  );

  server.tool(
    "cash_flow_statement",
    "Generate a cash flow statement using the indirect method. Shows operating, investing, and financing activities with opening/closing cash balances. Amounts in integer cents.",
    {
      startDate: z
        .string()
        .describe("Start date (YYYY-MM-DD)"),
      endDate: z
        .string()
        .describe("End date (YYYY-MM-DD)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const { startDate, endDate } = params;

        // Helper to get account balance delta in a period
        async function getBalanceDelta(
          accountTypes: string[],
          subTypes?: string[]
        ): Promise<{ accountId: string; code: string; name: string; delta: number }[]> {
          const conditions = [
            eq(journalEntry.organizationId, ctx.organizationId),
            eq(journalEntry.status, "posted"),
            isNull(journalEntry.deletedAt),
            gte(journalEntry.date, startDate),
            lte(journalEntry.date, endDate),
            sql`${chartAccount.type} IN (${sql.join(accountTypes.map(t => sql`${t}`), sql`, `)})`,
          ];

          if (subTypes && subTypes.length > 0) {
            conditions.push(
              sql`${chartAccount.subType} IN (${sql.join(subTypes.map(s => sql`${s}`), sql`, `)})`
            );
          }

          const rows = await db
            .select({
              accountId: chartAccount.id,
              code: chartAccount.code,
              name: chartAccount.name,
              type: chartAccount.type,
              debit: sql<number>`coalesce(sum(${journalLine.debitAmount}), 0)`,
              credit: sql<number>`coalesce(sum(${journalLine.creditAmount}), 0)`,
            })
            .from(journalLine)
            .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
            .innerJoin(chartAccount, eq(journalLine.accountId, chartAccount.id))
            .where(and(...conditions))
            .groupBy(chartAccount.id, chartAccount.code, chartAccount.name, chartAccount.type);

          return rows.map((r) => {
            const isDebitNormal = ["asset", "expense"].includes(r.type);
            const delta = isDebitNormal
              ? Number(r.debit) - Number(r.credit)
              : Number(r.credit) - Number(r.debit);
            return { accountId: r.accountId, code: r.code, name: r.name, delta };
          });
        }

        // Get net income (revenue - expenses)
        const revenueAccounts = await getBalanceDelta(["revenue"]);
        const expenseAccounts = await getBalanceDelta(["expense"]);
        const totalRevenue = revenueAccounts.reduce((s, a) => s + a.delta, 0);
        const totalExpenses = expenseAccounts.reduce((s, a) => s + a.delta, 0);
        const netIncome = totalRevenue - totalExpenses;

        // Depreciation add-back
        const [depResult] = await db
          .select({
            total: sql<number>`coalesce(sum(${journalLine.debitAmount}), 0)`,
          })
          .from(journalLine)
          .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
          .where(
            and(
              eq(journalEntry.organizationId, ctx.organizationId),
              eq(journalEntry.status, "posted"),
              isNull(journalEntry.deletedAt),
              eq(journalEntry.sourceType, "depreciation"),
              gte(journalEntry.date, startDate),
              lte(journalEntry.date, endDate)
            )
          );
        const depreciation = Number(depResult?.total ?? 0);

        // Working capital changes (current assets and current liabilities)
        const arChanges = await getBalanceDelta(["asset"], ["accounts_receivable"]);
        const apChanges = await getBalanceDelta(["liability"], ["accounts_payable", "current_liability"]);
        const inventoryChanges = await getBalanceDelta(["asset"], ["inventory"]);

        const arDelta = arChanges.reduce((s, a) => s + a.delta, 0);
        const apDelta = apChanges.reduce((s, a) => s + a.delta, 0);
        const inventoryDelta = inventoryChanges.reduce((s, a) => s + a.delta, 0);

        const operatingActivities = {
          netIncome,
          depreciation,
          workingCapitalChanges: {
            accountsReceivable: -arDelta, // Increase in AR reduces cash
            accountsPayable: apDelta, // Increase in AP increases cash
            inventory: -inventoryDelta, // Increase in inventory reduces cash
          },
          total: netIncome + depreciation - arDelta + apDelta - inventoryDelta,
        };

        // Investing activities: fixed asset changes
        const fixedAssetChanges = await getBalanceDelta(["asset"], ["fixed_asset", "property_plant_equipment"]);
        const investingTotal = -fixedAssetChanges.reduce((s, a) => s + a.delta, 0);

        const investingActivities = {
          items: fixedAssetChanges.map((a) => ({
            name: a.name,
            amount: -a.delta, // Asset increase = cash outflow
          })),
          total: investingTotal,
        };

        // Financing activities: loan payments + equity changes
        const [loanResult] = await db
          .select({
            total: sql<number>`coalesce(sum(${journalLine.creditAmount}) - sum(${journalLine.debitAmount}), 0)`,
          })
          .from(journalLine)
          .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
          .where(
            and(
              eq(journalEntry.organizationId, ctx.organizationId),
              eq(journalEntry.status, "posted"),
              isNull(journalEntry.deletedAt),
              eq(journalEntry.sourceType, "loan_payment"),
              gte(journalEntry.date, startDate),
              lte(journalEntry.date, endDate)
            )
          );

        const equityChanges = await getBalanceDelta(["equity"]);
        const equityDelta = equityChanges.reduce((s, a) => s + a.delta, 0);
        const loanPayments = Number(loanResult?.total ?? 0);

        const financingActivities = {
          loanPayments,
          equityChanges: equityDelta,
          total: loanPayments + equityDelta,
        };

        // Cash balances
        const cashSubTypes = ["cash", "bank"];

        // Opening cash balance (all cash account entries before startDate)
        const [openingResult] = await db
          .select({
            debit: sql<number>`coalesce(sum(${journalLine.debitAmount}), 0)`,
            credit: sql<number>`coalesce(sum(${journalLine.creditAmount}), 0)`,
          })
          .from(journalLine)
          .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
          .innerJoin(chartAccount, eq(journalLine.accountId, chartAccount.id))
          .where(
            and(
              eq(journalEntry.organizationId, ctx.organizationId),
              eq(journalEntry.status, "posted"),
              isNull(journalEntry.deletedAt),
              sql`${journalEntry.date} < ${startDate}`,
              eq(chartAccount.type, "asset"),
              sql`${chartAccount.subType} IN (${sql.join(cashSubTypes.map(s => sql`${s}`), sql`, `)})`
            )
          );

        const openingCash = Number(openingResult?.debit ?? 0) - Number(openingResult?.credit ?? 0);
        const netCashChange = operatingActivities.total + investingActivities.total + financingActivities.total;
        const closingCash = openingCash + netCashChange;

        return {
          startDate,
          endDate,
          openingCashBalance: openingCash,
          operatingActivities,
          investingActivities,
          financingActivities,
          netCashChange,
          closingCashBalance: closingCash,
        };
      })
  );

  server.tool(
    "export_financial_statement",
    "Render a financial statement as a downloadable PDF or XLSX (Excel) file. Returns the file base64-encoded along with its filename and MIME type. Ledger reports include posted journal data; aging reports include non-draft/non-void documents. Monetary figures are computed in integer cents and scaled by the file renderer. General ledger exports use the same exact scoped service with all qualifying lines and complete period subtotals. For date-ranged statements (profit_and_loss, general_ledger) provide 'from' and 'to'. Balance_sheet and trial_balance are point-in-time and ignore those dates. Aged_receivables and aged_payables ignore from/to and accept optional asAt/currencyCode, using the same exact totals as their JSON tools.",
    {
      asAt: agingSchema.shape.asAt.describe("Aging export only: historical cutoff YYYY-MM-DD; omit for current stored balances"),
      currencyCode: agingSchema.shape.currencyCode.describe("Aging export only: single document currency filter, no FX conversion"),
      statement: z
        .enum([
          "balance_sheet",
          "profit_and_loss",
          "trial_balance",
          "general_ledger",
          "aged_receivables",
          "aged_payables",
        ])
        .describe("Which financial statement to export"),
      format: z
        .enum(["pdf", "xlsx"])
        .describe("Output file format: 'pdf' or 'xlsx' (Excel)"),
      from: z
        .string()
        .optional()
        .describe(
          "Start date YYYY-MM-DD for date-ranged statements (defaults to Jan 1 of current year)"
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End date YYYY-MM-DD for date-ranged statements (defaults to today)"
        ),
    },
    (params) =>
      wrapTool(ctx, async () => {
        if (!["aged_receivables", "aged_payables"].includes(params.statement) && (params.asAt !== undefined || params.currencyCode !== undefined)) {
          throw new z.ZodError([{ code: "custom", path: [], message: "asAt/currencyCode apply only to aging exports" }]);
        }
        if (["profit_and_loss", "general_ledger"].includes(params.statement)) requireRole(ctx, "view:data");
        const startDate = params.from ?? `${["profit_and_loss", "general_ledger"].includes(params.statement) ? new Date().getUTCFullYear() : new Date().getFullYear()}-01-01`;
        const endDate = params.to ?? new Date().toISOString().slice(0, 10);
        const asAt = new Date().toISOString().slice(0, 10);

        const org = await db.query.organization.findFirst({
          where: eq(organization.id, ctx.organizationId),
          columns: { defaultCurrency: true },
        });
        const currency = org?.defaultCurrency || "USD";

        let statement: Statement;
        let baseName: string;

        if (params.statement === "balance_sheet") {
          const accounts = await db
            .select({
              code: chartAccount.code,
              name: chartAccount.name,
              type: chartAccount.type,
              debitTotal: sql<number>`coalesce(sum(${journalLine.debitAmount}), 0)`,
              creditTotal: sql<number>`coalesce(sum(${journalLine.creditAmount}), 0)`,
            })
            .from(chartAccount)
            .leftJoin(journalLine, eq(journalLine.accountId, chartAccount.id))
            .leftJoin(
              journalEntry,
              and(
                eq(journalLine.journalEntryId, journalEntry.id),
                eq(journalEntry.status, "posted")
              )
            )
            .where(
              and(
                eq(chartAccount.organizationId, ctx.organizationId),
                sql`${chartAccount.type} in ('asset', 'liability', 'equity')`
              )
            )
            .groupBy(chartAccount.code, chartAccount.name, chartAccount.type)
            .orderBy(chartAccount.code);

          const buildSection = (type: string, label: string) => {
            const isDebitNormal = type === "asset";
            const filtered = accounts.filter((a) => a.type === type);
            let totalCents = 0;
            const rows = filtered.map((a) => {
              const debit = Number(a.debitTotal);
              const credit = Number(a.creditTotal);
              const balanceCents = isDebitNormal ? debit - credit : credit - debit;
              totalCents += balanceCents;
              return { code: a.code, name: a.name, amount: balanceCents, depth: 1 };
            });
            return { label, rows, subtotal: totalCents };
          };

          statement = {
            title: "Balance Sheet",
            periodLabel: `As at ${asAt}`,
            currency,
            sections: [
              buildSection("asset", "Assets"),
              buildSection("liability", "Liabilities"),
              buildSection("equity", "Equity"),
            ],
          };
          baseName = `balance-sheet-${asAt}`;
        } else if (params.statement === "trial_balance") {
          const accounts = await db
            .select({
              code: chartAccount.code,
              name: chartAccount.name,
              type: chartAccount.type,
              debitTotal: sql<number>`coalesce(sum(${journalLine.debitAmount}), 0)`,
              creditTotal: sql<number>`coalesce(sum(${journalLine.creditAmount}), 0)`,
            })
            .from(chartAccount)
            .leftJoin(journalLine, eq(journalLine.accountId, chartAccount.id))
            .leftJoin(
              journalEntry,
              and(
                eq(journalLine.journalEntryId, journalEntry.id),
                eq(journalEntry.status, "posted")
              )
            )
            .where(eq(chartAccount.organizationId, ctx.organizationId))
            .groupBy(chartAccount.code, chartAccount.name, chartAccount.type)
            .orderBy(chartAccount.code);

          let totalCents = 0;
          const rows = accounts.map((a) => {
            const debit = Number(a.debitTotal);
            const credit = Number(a.creditTotal);
            const isDebitNormal = ["asset", "expense"].includes(a.type);
            const balanceCents = isDebitNormal ? debit - credit : credit - debit;
            totalCents += balanceCents;
            return { code: a.code, name: a.name, amount: balanceCents, depth: 0 };
          });

          statement = {
            title: "Trial Balance",
            periodLabel: `As at ${asAt}`,
            currency,
            sections: [{ label: "Accounts", rows, subtotal: totalCents }],
          };
          baseName = `trial-balance-${asAt}`;
        } else if (params.statement === "profit_and_loss") {
          statement = (await getProfitLoss(ctx, { startDate, endDate })).statement();
          baseName = `profit-and-loss-${startDate}-${endDate}`;
        } else if (params.statement === "general_ledger") {
          statement = (await getGeneralLedger(ctx, { startDate, endDate }, { allLines: true })).statement();
          baseName = `general-ledger-${startDate}-${endDate}`;
        } else {
          const kind = params.statement === "aged_receivables" ? "receivables" : "payables";
          const report = await getAgingReport(ctx, kind, { asAt: params.asAt, currencyCode: params.currencyCode });
          statement = report.statement;
          baseName = `aged-${kind}-${report.data.asAt}`;
        }

        const { toPdf, toXlsx } = await import("@/lib/reports/statement-export");
        let buffer: Buffer;
        let mimeType: string;
        let filename: string;
        if (params.format === "pdf") {
          buffer = await toPdf(statement);
          mimeType = "application/pdf";
          filename = `${baseName}.pdf`;
        } else {
          buffer = await toXlsx(statement);
          mimeType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename = `${baseName}.xlsx`;
        }

        return {
          statement: params.statement,
          format: params.format,
          filename,
          mimeType,
          encoding: "base64",
          data: buffer.toString("base64"),
        };
      })
  );

  server.tool(
    "tracking_category_report",
    "Compare activity across a tracking dimension (cost center or project) over a date range, laying out one amount column per dimension value. mode='pnl' (default) returns revenue & expense sections plus per-column net income; mode='balances' returns every account type. Amounts are integer cents (natural-signed). Each row includes accountId for drill-down into general-ledger with the same costCenterId/projectId filter. The `columns` array describes each amount column; its `dimensionValue` is the id to pass to other reports (null = unassigned).",
    {
      dimension: z
        .enum(["costCenterId", "projectId"])
        .optional()
        .describe(
          "Tracking dimension to compare across columns. Defaults to 'costCenterId'."
        ),
      mode: z
        .enum(["pnl", "balances"])
        .optional()
        .describe(
          "'pnl' (default): revenue/expense sections + net income per column. 'balances': all account types with natural-sign balances per column."
        ),
      basis: z
        .enum(["accrual", "cash"])
        .optional()
        .describe(
          "Reporting basis: 'accrual' (default) or 'cash' (cash/payment-realized movement only)."
        ),
      startDate: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD, defaults to Jan 1 of current year)"),
      endDate: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD, defaults to today)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const startDate =
          params.startDate ?? `${new Date().getFullYear()}-01-01`;
        const endDate = params.endDate ?? new Date().toISOString().slice(0, 10);
        const dimension: Dimension = params.dimension ?? "costCenterId";
        const mode = params.mode === "balances" ? "balances" : "pnl";
        const basis = parseBasis(params.basis);

        const accountTypes: AccountAggregate["type"][] =
          mode === "pnl"
            ? ["revenue", "expense"]
            : ["asset", "liability", "equity", "revenue", "expense"];

        const groups: DimensionGroup[] = await aggregateByDimension(
          ctx.organizationId,
          { startDate, endDate },
          dimension,
          { basis, accountTypes }
        );

        // Resolve dimension-value ids -> human labels (cost center "CODE Name",
        // project "Name"). Only values present in the data are looked up.
        const UNASSIGNED_KEY = "__none__";
        const ids = groups
          .map((g) => g.dimensionValue)
          .filter((v): v is string => v !== null);
        const labels = new Map<string, string>();
        if (ids.length > 0) {
          const unique = new Set(ids);
          if (dimension === "costCenterId") {
            const rows = await db
              .select({
                id: costCenter.id,
                code: costCenter.code,
                name: costCenter.name,
              })
              .from(costCenter)
              .where(eq(costCenter.organizationId, ctx.organizationId));
            for (const r of rows) {
              if (unique.has(r.id)) {
                labels.set(r.id, r.code ? `${r.code} ${r.name}` : r.name);
              }
            }
          } else {
            const rows = await db
              .select({ id: project.id, name: project.name })
              .from(project)
              .where(eq(project.organizationId, ctx.organizationId));
            for (const r of rows) {
              if (unique.has(r.id)) labels.set(r.id, r.name);
            }
          }
        }

        const realKeys = groups
          .filter((g) => g.dimensionValue !== null)
          .map((g) => g.dimensionValue as string)
          .sort((a, b) =>
            (labels.get(a) || a).localeCompare(labels.get(b) || b)
          );
        const hasUnassigned = groups.some((g) => g.dimensionValue === null);
        const columnKeys = [
          ...realKeys,
          ...(hasUnassigned ? [UNASSIGNED_KEY] : []),
        ];
        const columnLabels = columnKeys.map((key) =>
          key === UNASSIGNED_KEY ? "Unassigned" : labels.get(key) || key
        );

        const byColumn = new Map<string, Map<string, AccountAggregate>>();
        for (const g of groups) {
          const key =
            g.dimensionValue === null ? UNASSIGNED_KEY : g.dimensionValue;
          const acctMap =
            byColumn.get(key) || new Map<string, AccountAggregate>();
          for (const a of g.accounts) acctMap.set(a.accountId, a);
          byColumn.set(key, acctMap);
        }

        const accountMeta = new Map<
          string,
          {
            accountId: string;
            code: string;
            name: string;
            type: AccountAggregate["type"];
          }
        >();
        for (const g of groups) {
          for (const a of g.accounts) {
            if (!accountMeta.has(a.accountId)) {
              accountMeta.set(a.accountId, {
                accountId: a.accountId,
                code: a.code,
                name: a.name,
                type: a.type,
              });
            }
          }
        }
        const orderedAccounts = Array.from(accountMeta.values()).sort((a, b) =>
          a.code.localeCompare(b.code)
        );

        const balanceFor = (accountId: string, columnKey: string): number =>
          byColumn.get(columnKey)?.get(accountId)?.balance ?? 0;

        interface AccountRow {
          accountId: string;
          accountCode: string;
          accountName: string;
          accountType: AccountAggregate["type"];
          amounts: number[];
          total: number;
        }
        const buildRows = (types: AccountAggregate["type"][]): AccountRow[] =>
          orderedAccounts
            .filter((a) => types.includes(a.type))
            .map((a) => {
              const amounts = columnKeys.map((k) =>
                balanceFor(a.accountId, k)
              );
              return {
                accountId: a.accountId,
                accountCode: a.code,
                accountName: a.name,
                accountType: a.type,
                amounts,
                total: amounts.reduce((s, n) => s + n, 0),
              };
            });
        const sumColumns = (rows: AccountRow[]): number[] =>
          columnKeys.map((_, i) => rows.reduce((s, r) => s + r.amounts[i], 0));

        let sections: Array<{
          label: string;
          accounts: AccountRow[];
          totals: number[];
          total: number;
        }>;
        let netIncome: { byColumn: number[]; total: number } | undefined;

        if (mode === "pnl") {
          const revenueRows = buildRows(["revenue"]);
          const expenseRows = buildRows(["expense"]);
          const revenueTotals = sumColumns(revenueRows);
          const expenseTotals = sumColumns(expenseRows);
          const netByColumn = columnKeys.map(
            (_, i) => revenueTotals[i] - expenseTotals[i]
          );
          netIncome = {
            byColumn: netByColumn,
            total: netByColumn.reduce((s, n) => s + n, 0),
          };
          sections = [
            {
              label: "Revenue",
              accounts: revenueRows,
              totals: revenueTotals,
              total: revenueTotals.reduce((s, n) => s + n, 0),
            },
            {
              label: "Expenses",
              accounts: expenseRows,
              totals: expenseTotals,
              total: expenseTotals.reduce((s, n) => s + n, 0),
            },
          ];
        } else {
          const sectionDefs: Array<{
            label: string;
            types: AccountAggregate["type"][];
          }> = [
            { label: "Assets", types: ["asset"] },
            { label: "Liabilities", types: ["liability"] },
            { label: "Equity", types: ["equity"] },
            { label: "Revenue", types: ["revenue"] },
            { label: "Expenses", types: ["expense"] },
          ];
          sections = sectionDefs.map((def) => {
            const rows = buildRows(def.types);
            const totals = sumColumns(rows);
            return {
              label: def.label,
              accounts: rows,
              totals,
              total: totals.reduce((s, n) => s + n, 0),
            };
          });
        }

        return {
          dimension,
          mode,
          basis,
          startDate,
          endDate,
          columns: columnKeys.map((key, i) => ({
            key,
            label: columnLabels[i],
            dimensionValue: key === UNASSIGNED_KEY ? null : key,
          })),
          sections,
          ...(netIncome ? { netIncome } : {}),
        };
      })
  );

  server.tool(
    "report_pack",
    "Generate a bundled financial report pack for a period: Balance Sheet (cumulative as at endDate), Profit & Loss (period activity), Trial Balance (cumulative as at endDate), and a Cash Flow Summary (opening/closing cash + net change). Returns each statement's structured sections (rows carry amounts in integer cents) so a client can render or export them. Use accrual (default) or cash basis.",
    {
      startDate: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD, defaults to Jan 1 of current year)"),
      endDate: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD, defaults to today)"),
      basis: z
        .enum(["accrual", "cash"])
        .optional()
        .describe(
          "Reporting basis: 'accrual' (default) or 'cash' (cash/payment-realized movement only)."
        ),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const startDate =
          params.startDate ?? `${new Date().getFullYear()}-01-01`;
        const endDate = params.endDate ?? new Date().toISOString().slice(0, 10);
        const basis = parseBasis(params.basis);

        // Opening cash = day before the period start.
        const openingAsAt = new Date(startDate);
        openingAsAt.setDate(openingAsAt.getDate() - 1);
        const openingAsAtStr = openingAsAt.toISOString().slice(0, 10);

        const [pl, balancesAsAt, openingBalances] = await Promise.all([
          aggregateByDateRange(
            ctx.organizationId,
            { startDate, endDate },
            { basis, accountTypes: ["revenue", "expense"] }
          ),
          aggregateAsAt(ctx.organizationId, endDate, {
            basis,
            accountTypes: ["asset", "liability", "equity"],
            includeEmptyAccounts: true,
          }),
          aggregateAsAt(ctx.organizationId, openingAsAtStr, {
            basis,
            accountTypes: ["asset"],
          }),
        ]);

        const org = await db.query.organization.findFirst({
          where: eq(organization.id, ctx.organizationId),
          columns: { defaultCurrency: true },
        });
        const currency = org?.defaultCurrency || "USD";

        const CASH_SUBTYPES = ["bank"];
        const sumCash = (aggs: AccountAggregate[]) =>
          aggs
            .filter((a) => a.subType !== null && CASH_SUBTYPES.includes(a.subType))
            .reduce((s, a) => s + a.balance, 0);
        const rowsForType = (
          aggs: AccountAggregate[],
          type: AccountAggregate["type"]
        ) =>
          aggs
            .filter((a) => a.type === type)
            .map((a) => ({
              code: a.code,
              name: a.name,
              amount: a.balance,
              depth: 1,
            }));

        const totalRevenue = pl
          .filter((a) => a.type === "revenue")
          .reduce((s, a) => s + a.balance, 0);
        const totalExpenses = pl
          .filter((a) => a.type === "expense")
          .reduce((s, a) => s + a.balance, 0);
        const netIncome = totalRevenue - totalExpenses;
        const closingCash = sumCash(balancesAsAt);
        const openingCash = sumCash(openingBalances);

        // Balance Sheet (current earnings carried into equity so it balances).
        const assetRows = rowsForType(balancesAsAt, "asset");
        const liabilityRows = rowsForType(balancesAsAt, "liability");
        const equityRows = rowsForType(balancesAsAt, "equity");
        const totalAssets = assetRows.reduce((s, r) => s + r.amount, 0);
        const totalLiabilities = liabilityRows.reduce((s, r) => s + r.amount, 0);
        const totalEquityAccounts = equityRows.reduce((s, r) => s + r.amount, 0);
        const equityWithEarnings = [
          ...equityRows,
          { code: "", name: "Current Earnings", amount: netIncome, depth: 1 },
        ];
        const totalEquity = totalEquityAccounts + netIncome;

        const balanceSheet: Statement = {
          title: "Balance Sheet",
          periodLabel: `As at ${endDate}`,
          currency,
          sections: [
            { label: "Assets", rows: assetRows, subtotal: totalAssets },
            {
              label: "Liabilities",
              rows: liabilityRows,
              subtotal: totalLiabilities,
            },
            { label: "Equity", rows: equityWithEarnings, subtotal: totalEquity },
          ],
          grandTotal: totalLiabilities + totalEquity,
        };

        const profitAndLoss: Statement = {
          title: "Profit and Loss",
          periodLabel: `${startDate} to ${endDate}`,
          currency,
          sections: [
            {
              label: "Revenue",
              rows: rowsForType(pl, "revenue"),
              subtotal: totalRevenue,
            },
            {
              label: "Expenses",
              rows: rowsForType(pl, "expense"),
              subtotal: totalExpenses,
            },
          ],
          grandTotal: netIncome,
        };

        // Trial Balance: re-derive debit/credit columns from natural-sign balance.
        const tbRows = balancesAsAt
          .filter((a) => a.balance !== 0)
          .map((a) => {
            const debitNormal = a.type === "asset" || a.type === "expense";
            const debit = debitNormal
              ? Math.max(a.balance, 0)
              : Math.max(-a.balance, 0);
            const credit = debitNormal
              ? Math.max(-a.balance, 0)
              : Math.max(a.balance, 0);
            return { code: a.code, name: a.name, debit, credit };
          });
        const tbTotalDebit = tbRows.reduce((s, r) => s + r.debit, 0);
        const tbTotalCredit = tbRows.reduce((s, r) => s + r.credit, 0);
        const trialBalance: Statement = {
          title: "Trial Balance",
          periodLabel: `As at ${endDate}`,
          currency,
          columns: ["Debit", "Credit"],
          sections: [
            {
              label: "Accounts",
              rows: tbRows.map((r) => ({
                code: r.code,
                name: r.name,
                amounts: [r.debit, r.credit],
                depth: 1,
              })),
              subtotals: [tbTotalDebit, tbTotalCredit],
            },
          ],
          grandTotals: [tbTotalDebit, tbTotalCredit],
        };

        const netChange = closingCash - openingCash;
        const cashFlow: Statement = {
          title: "Cash Flow Summary",
          periodLabel: `${startDate} to ${endDate}`,
          currency,
          sections: [
            {
              label: "Cash Movement",
              rows: [
                { name: "Opening cash", amount: openingCash, depth: 1 },
                { name: "Net change in cash", amount: netChange, depth: 1 },
                {
                  name: "Closing cash",
                  amount: closingCash,
                  depth: 1,
                  bold: true,
                },
              ],
            },
            {
              label: "Reconciliation",
              rows: [
                { name: "Net income (period)", amount: netIncome, depth: 1 },
                {
                  name: "Net non-cash & working-capital movement",
                  amount: netChange - netIncome,
                  depth: 1,
                },
              ],
              subtotal: netChange,
            },
          ],
          grandTotal: closingCash,
        };

        return {
          startDate,
          endDate,
          basis,
          currency,
          statements: [balanceSheet, profitAndLoss, trialBalance, cashFlow],
        };
      })
  );

  server.tool(
    "executive_summary",
    "Generate a one-page KPI roll-up for a period, comparing it against the immediately preceding period of equal length. KPIs (all integer cents): Revenue, Gross Profit, Operating Expenses, Net Income, Cash on Hand, Accounts Receivable, Accounts Payable. Each KPI returns current, prior, delta (current−prior), and deltaPercent (null when prior is 0). Use accrual (default) or cash basis.",
    {
      startDate: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD, defaults to Jan 1 of current year)"),
      endDate: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD, defaults to today)"),
      basis: z
        .enum(["accrual", "cash"])
        .optional()
        .describe(
          "Reporting basis: 'accrual' (default) or 'cash' (cash/payment-realized movement only)."
        ),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const startDate =
          params.startDate ?? `${new Date().getFullYear()}-01-01`;
        const endDate = params.endDate ?? new Date().toISOString().slice(0, 10);
        const basis = parseBasis(params.basis);

        const daysBetween = (start: string, end: string): number => {
          const ms = new Date(end).getTime() - new Date(start).getTime();
          return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
        };
        const addDays = (iso: string, days: number): string => {
          const d = new Date(iso);
          d.setDate(d.getDate() + days);
          return d.toISOString().slice(0, 10);
        };

        const periodLen = daysBetween(startDate, endDate);
        const priorEnd = addDays(startDate, -1);
        const priorStart = addDays(priorEnd, -(periodLen - 1));

        const [currentPL, priorPL, currentBS, priorBS] = await Promise.all([
          aggregateByDateRange(
            ctx.organizationId,
            { startDate, endDate },
            { basis, accountTypes: ["revenue", "expense"] }
          ),
          aggregateByDateRange(
            ctx.organizationId,
            { startDate: priorStart, endDate: priorEnd },
            { basis, accountTypes: ["revenue", "expense"] }
          ),
          aggregateAsAt(ctx.organizationId, endDate, {
            basis,
            accountTypes: ["asset"],
          }),
          aggregateAsAt(ctx.organizationId, priorEnd, {
            basis,
            accountTypes: ["asset"],
          }),
        ]);

        const sumByType = (
          aggs: AccountAggregate[],
          type: AccountAggregate["type"]
        ) =>
          aggs.filter((a) => a.type === type).reduce((s, a) => s + a.balance, 0);
        const sumCogs = (aggs: AccountAggregate[]) =>
          aggs
            .filter((a) => a.type === "expense" && a.subType === "cogs")
            .reduce((s, a) => s + a.balance, 0);
        const sumCash = (aggs: AccountAggregate[]) =>
          aggs
            .filter((a) => a.subType === "bank")
            .reduce((s, a) => s + a.balance, 0);

        const revenueCurrent = sumByType(currentPL, "revenue");
        const revenuePrior = sumByType(priorPL, "revenue");
        const expensesCurrent = sumByType(currentPL, "expense");
        const expensesPrior = sumByType(priorPL, "expense");
        const cogsCurrent = sumCogs(currentPL);
        const cogsPrior = sumCogs(priorPL);

        const netIncomeCurrent = revenueCurrent - expensesCurrent;
        const netIncomePrior = revenuePrior - expensesPrior;
        const grossProfitCurrent = revenueCurrent - cogsCurrent;
        const grossProfitPrior = revenuePrior - cogsPrior;
        const cashCurrent = sumCash(currentBS);
        const cashPrior = sumCash(priorBS);

        // Outstanding receivables / payables (open documents at each period end).
        const [openInvoices, openBills] = await Promise.all([
          db.query.invoice.findMany({
            where: and(
              eq(invoice.organizationId, ctx.organizationId),
              isNull(invoice.deletedAt),
              ne(invoice.status, "void"),
              ne(invoice.status, "draft")
            ),
            columns: { issueDate: true, amountDue: true },
          }),
          db.query.bill.findMany({
            where: and(
              eq(bill.organizationId, ctx.organizationId),
              isNull(bill.deletedAt),
              ne(bill.status, "void"),
              ne(bill.status, "draft")
            ),
            columns: { issueDate: true, amountDue: true },
          }),
        ]);
        const arAsOf = (asAt: string) =>
          openInvoices
            .filter((i) => i.issueDate <= asAt)
            .reduce((s, i) => s + i.amountDue, 0);
        const apAsOf = (asAt: string) =>
          openBills
            .filter((b) => b.issueDate <= asAt)
            .reduce((s, b) => s + b.amountDue, 0);

        const makeKpi = (
          key: string,
          label: string,
          current: number,
          prior: number
        ) => {
          const delta = current - prior;
          const deltaPercent =
            prior === 0
              ? null
              : Math.round((delta / Math.abs(prior)) * 10000) / 100;
          return { key, label, current, prior, delta, deltaPercent };
        };

        const kpis = [
          makeKpi("revenue", "Revenue", revenueCurrent, revenuePrior),
          makeKpi(
            "grossProfit",
            "Gross Profit",
            grossProfitCurrent,
            grossProfitPrior
          ),
          makeKpi(
            "expenses",
            "Operating Expenses",
            expensesCurrent,
            expensesPrior
          ),
          makeKpi("netIncome", "Net Income", netIncomeCurrent, netIncomePrior),
          makeKpi("cash", "Cash on Hand", cashCurrent, cashPrior),
          makeKpi(
            "accountsReceivable",
            "Accounts Receivable",
            arAsOf(endDate),
            arAsOf(priorEnd)
          ),
          makeKpi(
            "accountsPayable",
            "Accounts Payable",
            apAsOf(endDate),
            apAsOf(priorEnd)
          ),
        ];

        return {
          period: { startDate, endDate },
          priorPeriod: { startDate: priorStart, endDate: priorEnd },
          basis,
          kpis,
        };
      })
  );

  for (const [name, kind, label] of [
    ["sales_by_customer", "sales-by-customer", "Sales by customer"],
    ["sales_by_item", "sales-by-item", "Sales by item"],
    ["vendor_spend", "vendor-spend", "Vendor spend"],
  ] as const) {
    const outputs = kind === "vendor-spend"
      ? "Returns vendors ordered by spend, bill counts, rounded averages, percentages, root totalSpend and top-five monthlyTrend. Money adds totalSpendMinor, avgBillAmountMinor and monthly totalMinor."
      : `Returns ${kind === "sales-by-item" ? "items, line counts and summed quantity (100 = 1.00 physical unit)" : "customers and distinct invoice counts"}, ordered by net, plus totals. Money adds netMinor, taxMinor and grossMinor.`;
    server.tool(name,
      `${label} over inclusive Gregorian startDate/endDate (UTC year-to-date by default). No amount inputs. Documents exclude draft, void and deleted. ${outputs} Numeric integer cents and matching exact strings stay within +/-9007199254740991. Counts and quantities remain numbers. Optional currencyCode selects one document currency; mixed currencies reject without it. No FX or currency rescaling. Requires view:data; organization-scoped direct DB reads.`,
      documentAnalyticsSchema.shape,
      params => wrapTool(ctx, async () => (await getDocumentAnalytics(ctx, kind, params)).data),
    );
  }
}
