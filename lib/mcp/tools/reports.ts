import { getKpiAnalytics } from "@/lib/reports/kpi-analytics";
import { expenseAnalyticsSchema, executiveSummarySchema, executiveExportSchema, monthlyTrendsSchema, contactProfitabilitySchema } from "@/lib/reports/kpi-analytics-wire";
import { getTrackingReport, getReportPack, getFinancialRatios } from "@/lib/reports/compound";
import { trackingSchema, packSchema, ratioSchema, trackingExportSchema } from "@/lib/reports/compound-wire";
import { getCashFlow } from "@/lib/reports/cash-flow-service";
import { cashFlowSchema, cashFlowExportSchema } from "@/lib/reports/cash-flow-wire";
import { getGeneralLedger, getAccountTransactions } from "@/lib/reports/ledger-detail";
import { generalLedgerSchema, accountTransactionsSchema } from "@/lib/reports/ledger-detail-wire";
import { getProfitLoss, getIncomeStatement, getPnlComparison } from "@/lib/reports/period-statement";
import { profitLossSchema, incomeStatementSchema, pnlComparisonSchema } from "@/lib/reports/period-statement-wire";
import { getDocumentAnalytics } from "@/lib/reports/document-analytics";
import { documentAnalyticsSchema } from "@/lib/reports/document-analytics-wire";
import { getPaymentPerformance } from "@/lib/reports/payment-performance";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  chartAccount,
  journalLine,
  journalEntry,
  organization,
} from "@/lib/db/schema";
import { eq, and, sql, isNull, gte, lte, inArray } from "drizzle-orm";
import { getCumulativeStatement } from "@/lib/reports/cumulative-statement";
import { getAgingReport } from "@/lib/reports/aging";
import { agingSchema } from "@/lib/reports/aging-wire";
import { cumulativeReportSchema } from "@/lib/reports/statement-wire";
import { wrapTool } from "@/lib/mcp/errors";
import { requireRole } from "@/lib/api/require-role";
import type { AuthContext } from "@/lib/api/auth-context";
import type { Statement } from "@/lib/reports/statement-export";
export function registerReportTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("payment_performance", {
    description: "Read paid invoice/bill performance for an inclusive Gregorian issue-date period (current UTC year through today by default). Returns receivables/payables by contact, integer days, counts, whole percent onTimeRate, count-weighted rounded contact-day summaries, numeric integer cents and exact totalCollectedMinor/totalPaidMinor strings, plus currencyCode; safe +/-9007199254740991. Optional currencyCode selects a single document currency; mixed currencies reject without FX conversion or rescaling. Uses stored paidAt date, requires view:data; no input amounts.",
    inputSchema: documentAnalyticsSchema,
  }, params => wrapTool(ctx, () => getPaymentPerformance(ctx, params)));

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

  server.registerTool("cash_flow_statement", {
    description: "Read posted non-deleted organization-base cash flow for an inclusive Gregorian period (UTC current year/today defaults). Indirect by default; direct retains the cash-income heuristic, not payment tracing. Returns legacy flat/structured numeric integer cents, exact Minor strings, currencyCode and cash reconciliation; safe +/-9007199254740991. Optional accrual/cash basis; no input amounts or FX; requires view:data.",
    inputSchema: cashFlowSchema,
  }, params => wrapTool(ctx, async () => (await getCashFlow(ctx, params)).data));
  server.registerTool("export_cash_flow_statement", {
    description: "Export the same scoped cash-flow statement as PDF or XLSX. Returns base64 file, filename, MIME type and encoding. Inputs are inclusive Gregorian dates, indirect/direct method and accrual/cash basis; direct retains the cash-income heuristic. Stored integer cents are displayed using organization currency scale, without FX. Safe numeric amounts and exact Excel precision required; requires view:data.",
    inputSchema: cashFlowExportSchema,
  }, params => wrapTool(ctx, async () => {
    const { format, ...input } = params;
    const result = await getCashFlow(ctx, input);
    const { toPdf, toXlsx } = await import("@/lib/reports/statement-export");
    const buffer = await (format === "pdf" ? toPdf(result.statement()) : toXlsx(result.statement()));
    return { filename: `cash-flow-${result.data.startDate}-${result.data.endDate}.${params.format}`,
      mimeType: params.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      encoding: "base64", content: buffer.toString("base64") };
  }));

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

  server.registerTool("tracking_category_report", {
    description: "Compare posted non-deleted organization-base GL activity by owned cost center or project (legacy project alias supported), inclusive Gregorian dates, pnl/balances mode and cash/accrual basis. Returns labeled columns, account drill-down IDs, numeric integer cents and aligned Minor strings for amounts/totals/net income; safe +/-9007199254740991. Defaults to current UTC year through today; requires view:data; no FX or amount inputs.",
    inputSchema: trackingSchema,
  }, params => wrapTool(ctx, async () => (await getTrackingReport(ctx, params)).data));
  server.registerTool("report_pack", {
    description: "Read four financial statements for inclusive Gregorian dates and cash/accrual basis (current UTC year through today by default). Cumulative balance sheet includes unclosed earnings; P&L uses period income; trial balance includes all account types; cash summary includes bank/cash balances. Returns statements with numeric integer cents and matching scalar/array Minor strings, currency/currencyCode; safe +/-9007199254740991. Requires view:data; no FX or amount inputs.",
    inputSchema: packSchema,
  }, params => wrapTool(ctx, async () => (await getReportPack(ctx, params)).data));
  server.registerTool("financial_ratios", {
    description: "Read financial ratios for inclusive Gregorian dates (current UTC year through today by default). GL balances are cumulative through endDate, income uses the period, outstanding documents use their current snapshot and must be in organization currency. Returns numeric cent balances with Minor strings, numeric ratios and matching ratiosExact decimal strings (null for zero divisor). Ratio/margin precision is two places, DSO/DPO integer days using max(1, end-start). Gross margin retains the net-income heuristic. Requires view:data; no FX or amount inputs; money safe +/-9007199254740991.",
    inputSchema: ratioSchema,
  }, params => wrapTool(ctx, () => getFinancialRatios(ctx, params)));
  server.registerTool("export_report_pack", {
    description: "Export report_pack as a four-sheet XLSX workbook. Gregorian dates and cash/accrual basis as report_pack; amounts display with organization currency scale. Returns base64 data, filename, MIME type and encoding; requires view:data and exact Excel numeric-cell compatibility.",
    inputSchema: packSchema,
  }, params => wrapTool(ctx, async () => {
    const result = await getReportPack(ctx, params);
    const { toWorkbookXlsx } = await import("@/lib/reports/statements-workbook");
    const buffer = await toWorkbookXlsx(result.statements);
    return { data: buffer.toString("base64"), encoding: "base64", filename: "report-pack.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }));
  server.registerTool("export_tracking_category_report", {
    description: "Export tracking_category_report as PDF or XLSX with organization currency display scale. Gregorian dates, dimension, mode and basis match the read tool. Returns base64 data, encoding, filename and MIME type; requires view:data and exact Excel compatibility for XLSX.",
    inputSchema: trackingExportSchema,
  }, params => wrapTool(ctx, async () => {
    const { format, ...input } = params;
    const result = await getTrackingReport(ctx, input);
    const { toPdf, toXlsx } = await import("@/lib/reports/statement-export");
    const buffer = format === "pdf" ? await toPdf(result.statement()) : await toXlsx(result.statement());
    return { data: buffer.toString("base64"), encoding: "base64", filename: `tracking-category.${format}`,
      mimeType: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }));

  for (const [name, kind, schema, description] of [
    ["expense_analytics", "expense-analytics", expenseAnalyticsSchema, "Returns ranked expense categories, distinct transaction counts, percentage shares, monthlyTrend, totalExpenses and rounded monthlyAverage. Posted non-deleted organization-base ledger, accrual basis; inclusive Gregorian startDate/endDate default to UTC year-to-date."],
    ["monthly_trends", "monthly-trends", monthlyTrendsSchema, "Returns zero-filled UTC calendar months with revenue, expenses and netIncome plus sparklines and matching Minor string arrays. Integer months 1-24 including the current month (default 6); posted non-deleted organization-base ledger on accrual basis, including scheduled activity through current month-end."],
    ["executive_summary", "executive-summary", executiveSummarySchema, "Returns seven KPIs with current/prior/delta and matching Minor strings, deltaPercent (null for zero prior), period and equally long immediately preceding priorPeriod. Inclusive Gregorian dates default to UTC year-to-date; cash/accrual basis. Outstanding AR/AP uses current document amountDue for documents issued by cutoff, not historical settlement reconstruction, and requires organization currency."],
    ["contact_profitability", "profitability", contactProfitabilitySchema, "Returns invoice-driven contacts ranked by profit, revenue/costs/profit and matching Minor strings, margins, invoice/bill counts and root totals. Inclusive Gregorian issue dates default to UTC year-to-date; excludes draft/void/deleted documents. Optional currencyCode selects one document currency; mixed currencies reject. Bill-only contacts are excluded from entries/totals; foreign/deleted contact labels are Unknown."],
  ] as const) {
    server.registerTool(name, {
      description: `${description} All money is numeric integer cents with additive exact Minor strings within +/-9007199254740991; currencyCode identifies units. No amount inputs, FX or rescaling. Requires view:data; organization-scoped direct DB read snapshot.`,
      inputSchema: schema,
    }, (params: unknown) => wrapTool(ctx, async () => (await getKpiAnalytics(ctx, kind, params)).data));
  }
  server.registerTool("export_executive_summary", {
    description: "Export executive_summary as PDF/XLSX using the same Gregorian dates and basis. Requires view:data. Amounts display with organization currency scale; returns base64 data, encoding, filename and MIME type. XLSX rejects lossy numeric cells. Outstanding balances use current document snapshot; no FX.",
    inputSchema: executiveExportSchema,
  }, params => wrapTool(ctx, async () => {
    const { format, ...input } = params;
    const result = await getKpiAnalytics(ctx, "executive-summary", input);
    if (!("statement" in result) || !result.statement) throw new Error("Missing executive statement");
    const { toPdf, toXlsx } = await import("@/lib/reports/statement-export");
    const buffer = format === "pdf" ? await toPdf(result.statement) : await toXlsx(result.statement);
    return { data: buffer.toString("base64"), encoding: "base64", filename: `executive-summary.${format}`,
      mimeType: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }));

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
