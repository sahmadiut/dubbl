import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  payrollEmployee,
  payrollRun,
  payrollItem,
  payrollSettings,
  payslip,
  taxFormGeneration,
  taxForm,
  payrollTaxPayment,
  contractor,
  contractorPayment,
  chartAccount,
  journalEntry,
  journalLine,
  member,
  auditLog,
} from "@/lib/db/schema";
import { eq, and, sql, gte, lte, lt } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
import {
  getNextEntryNumber,
  findAccountByCode,
  ensureAccountByCode,
} from "@/lib/api/journal-automation";
import type { AuthContext } from "@/lib/api/auth-context";

export function registerPayrollTools(server: McpServer, ctx: AuthContext) {
  // Run/lifecycle operations are registered in payroll-runs.ts.
  server.tool(
    "generate_payslips",
    "Generate payslips for every item in a COMPLETED payroll run, computing each employee's year-to-date gross/net/tax (in integer cents) across all completed runs up to this period. Call after process_payroll_run. Returns the number of payslips generated.",
    {
      payRunId: z.string().describe("UUID of the completed payroll run to generate payslips for"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:payroll");

        const run = await db.query.payrollRun.findFirst({
          where: and(
            eq(payrollRun.id, params.payRunId),
            eq(payrollRun.organizationId, ctx.organizationId),
            notDeleted(payrollRun.deletedAt)
          ),
          with: { items: true },
        });
        if (!run) throw new Error("Payroll run not found");
        if (run.status !== "completed") throw new Error("Can only generate payslips for completed runs");

        const payslips: (typeof payslip.$inferInsert)[] = [];
        for (const item of run.items) {
          const [ytd] = await db
            .select({
              ytdGross: sql<number>`coalesce(sum(${payrollItem.grossAmount}), 0)`.mapWith(Number),
              ytdNet: sql<number>`coalesce(sum(${payrollItem.netAmount}), 0)`.mapWith(Number),
              ytdTax: sql<number>`coalesce(sum(${payrollItem.taxAmount}), 0)`.mapWith(Number),
            })
            .from(payrollItem)
            .innerJoin(payrollRun, eq(payrollItem.payrollRunId, payrollRun.id))
            .where(
              and(
                eq(payrollItem.employeeId, item.employeeId),
                eq(payrollRun.status, "completed"),
                eq(payrollRun.organizationId, ctx.organizationId),
                lte(payrollRun.payPeriodEnd, run.payPeriodEnd)
              )
            );

          payslips.push({
            payrollRunId: run.id,
            employeeId: item.employeeId,
            payrollItemId: item.id,
            grossAmount: item.grossAmount,
            netAmount: item.netAmount,
            taxAmount: item.taxAmount,
            deductionsBreakdown: [],
            ytdGross: ytd?.ytdGross || 0,
            ytdNet: ytd?.ytdNet || 0,
            ytdTax: ytd?.ytdTax || 0,
          });
        }

        if (payslips.length > 0) await db.insert(payslip).values(payslips);

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "generate_payslips",
          entityType: "payroll_run",
          entityId: run.id,
          changes: { count: payslips.length },
        });

        return { count: payslips.length };
      })
  );

  server.tool(
    "list_payslips",
    "List generated payslips for a payroll run. Each payslip carries grossAmount, netAmount, taxAmount and year-to-date totals (ytdGross/ytdNet/ytdTax), all in integer cents. Use generate_payslips first if a completed run has none.",
    {
      payRunId: z.string().describe("UUID of the payroll run to list payslips for"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:payroll");

        const run = await db.query.payrollRun.findFirst({
          where: and(
            eq(payrollRun.id, params.payRunId),
            eq(payrollRun.organizationId, ctx.organizationId),
            notDeleted(payrollRun.deletedAt)
          ),
        });
        if (!run) throw new Error("Payroll run not found");

        const rows = await db.query.payslip.findMany({
          where: eq(payslip.payrollRunId, params.payRunId),
          with: { employee: true },
        });

        return {
          payslips: rows.map((p) => ({
            id: p.id,
            employeeId: p.employeeId,
            employeeName: p.employee?.name ?? null,
            payrollItemId: p.payrollItemId,
            status: p.status,
            grossAmount: p.grossAmount,
            netAmount: p.netAmount,
            taxAmount: p.taxAmount,
            ytdGross: p.ytdGross,
            ytdNet: p.ytdNet,
            ytdTax: p.ytdTax,
            generatedAt: p.generatedAt,
          })),
        };
      })
  );

  // ─── Tax Forms ────────────────────────────────────────────────────────
  server.tool(
    "generate_tax_forms",
    "Generate year-end tax forms for a tax year. formType 'w2' produces one W-2 per employee from completed payroll runs (wages/tax in integer cents). formType '1099_nec' produces a 1099-NEC for each contractor paid at least $600 (60000 cents) of 'paid' payments in the year. Creates a tax-form-generation batch plus the individual forms. Returns the generation record and the count of forms generated.",
    {
      taxYear: z.number().int().min(2020).max(2099).describe("Tax year (e.g. 2026)"),
      formType: z
        .enum(["1099_nec", "1099_misc", "w2"])
        .describe("Form type. 'w2' for employees, '1099_nec' for contractors."),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:payroll");

        const mem = await db.query.member.findFirst({
          where: and(
            eq(member.organizationId, ctx.organizationId),
            eq(member.userId, ctx.userId)
          ),
        });

        const [generation] = await db
          .insert(taxFormGeneration)
          .values({
            organizationId: ctx.organizationId,
            taxYear: params.taxYear,
            formType: params.formType,
            status: "draft",
            createdBy: mem?.id || null,
          })
          .returning();

        const yearStart = `${params.taxYear}-01-01`;
        const yearEnd = `${params.taxYear + 1}-01-01`;
        const forms: (typeof taxForm.$inferSelect)[] = [];

        if (params.formType === "1099_nec") {
          const contractorTotals = await db
            .select({
              contractorId: contractorPayment.contractorId,
              totalAmount: sql<number>`COALESCE(SUM(${contractorPayment.amount}), 0)`.mapWith(Number),
            })
            .from(contractorPayment)
            .innerJoin(contractor, eq(contractorPayment.contractorId, contractor.id))
            .where(
              and(
                eq(contractor.organizationId, ctx.organizationId),
                eq(contractorPayment.status, "paid"),
                gte(contractorPayment.paidAt, new Date(yearStart)),
                lt(contractorPayment.paidAt, new Date(yearEnd))
              )
            )
            .groupBy(contractorPayment.contractorId);

          for (const ct of contractorTotals) {
            if (ct.totalAmount < 60000) continue;
            const c = await db.query.contractor.findFirst({ where: eq(contractor.id, ct.contractorId) });
            if (!c) continue;
            const [form] = await db
              .insert(taxForm)
              .values({
                generationId: generation.id,
                recipientType: "contractor",
                recipientId: c.id,
                recipientName: c.name,
                recipientTaxId: c.taxId,
                formType: "1099_nec",
                taxYear: params.taxYear,
                formData: {
                  box1_nonemployee_compensation: ct.totalAmount,
                  recipient_company: c.company,
                  recipient_email: c.email,
                },
                status: "generated",
              })
              .returning();
            forms.push(form);
          }
        } else if (params.formType === "w2") {
          const employeeTotals = await db
            .select({
              employeeId: payrollItem.employeeId,
              totalGross: sql<number>`COALESCE(SUM(${payrollItem.grossAmount}), 0)`.mapWith(Number),
              totalTax: sql<number>`COALESCE(SUM(${payrollItem.taxAmount}), 0)`.mapWith(Number),
              totalNet: sql<number>`COALESCE(SUM(${payrollItem.netAmount}), 0)`.mapWith(Number),
            })
            .from(payrollItem)
            .innerJoin(payrollRun, eq(payrollItem.payrollRunId, payrollRun.id))
            .where(
              and(
                eq(payrollRun.organizationId, ctx.organizationId),
                eq(payrollRun.status, "completed"),
                gte(payrollRun.payPeriodStart, yearStart),
                lt(payrollRun.payPeriodEnd, yearEnd)
              )
            )
            .groupBy(payrollItem.employeeId);

          for (const et of employeeTotals) {
            const emp = await db.query.payrollEmployee.findFirst({
              where: eq(payrollEmployee.id, et.employeeId),
            });
            if (!emp) continue;
            const [form] = await db
              .insert(taxForm)
              .values({
                generationId: generation.id,
                recipientType: "employee",
                recipientId: emp.id,
                recipientName: emp.name,
                recipientTaxId: null,
                formType: "w2",
                taxYear: params.taxYear,
                formData: {
                  box1_wages: et.totalGross,
                  box2_federal_tax: et.totalTax,
                  box3_ss_wages: et.totalGross,
                  box4_ss_tax: Math.round(et.totalGross * 0.062),
                  box5_medicare_wages: et.totalGross,
                  box6_medicare_tax: Math.round(et.totalGross * 0.0145),
                  employee_email: emp.email,
                  employee_number: emp.employeeNumber,
                },
                status: "generated",
              })
              .returning();
            forms.push(form);
          }
        }

        await db
          .update(taxFormGeneration)
          .set({ status: "generated", generatedAt: new Date() })
          .where(eq(taxFormGeneration.id, generation.id));

        return {
          generation: { ...generation, status: "generated" },
          formsGenerated: forms.length,
        };
      })
  );

  // ─── Tax Remittance ───────────────────────────────────────────────
  server.tool(
    "record_payroll_tax_remittance",
    "Record a remittance of withheld + employer payroll taxes to a tax authority for a period, posting a balanced journal entry that DEBITS the payroll-tax liability account (e.g. income-tax-payable 2220 for income tax, payroll-taxes-payable 2235 for FICA/FUTA/SUTA) and CREDITS the bank account, then marks the remittance 'paid'. 'amount' is the total cash remitted in integer cents. Provide the bankAccountId (a chart-of-accounts account id). Returns the remittance record and the posted journalEntryId.",
    {
      periodStart: z.string().min(1).describe("Start of the period this remittance covers (YYYY-MM-DD)"),
      periodEnd: z.string().min(1).describe("End of the period this remittance covers (YYYY-MM-DD)"),
      amount: z.number().int().min(1).describe("Total cash remitted, in integer cents"),
      bankAccountId: z.string().describe("UUID of the chart-of-accounts bank/cash account the remittance is paid from"),
      taxKind: z
        .string()
        .optional()
        .describe("What this covers, e.g. '941' (FIT+FICA), '940' (FUTA), 'state_income'. Determines the liability account debited."),
      jurisdictionLevel: z
        .enum(["federal", "state", "local"])
        .optional()
        .default("federal")
        .describe("Tax jurisdiction level"),
      jurisdiction: z.string().optional().describe("Jurisdiction code (e.g. 'CA', 'NY'); omit for federal"),
      reference: z.string().optional().describe("Confirmation / EFTPS number"),
      notes: z.string().optional().describe("Optional notes"),
      date: z.string().optional().describe("Posting/payment date (YYYY-MM-DD); defaults to periodEnd"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "manage:payroll");

        const bank = await db.query.chartAccount.findFirst({
          where: and(
            eq(chartAccount.id, params.bankAccountId),
            eq(chartAccount.organizationId, ctx.organizationId),
            notDeleted(chartAccount.deletedAt)
          ),
        });
        if (!bank) throw new Error("Bank account not found");

        // Decide which liability account to debit based on what the remittance
        // covers. Income-tax style → 2220; FICA / unemployment style → 2235.
        const kind = (params.taxKind ?? "").toLowerCase();
        const isPayrollTax =
          kind.includes("fica") ||
          kind.includes("social") ||
          kind.includes("medicare") ||
          kind.includes("futa") ||
          kind.includes("suta") ||
          kind.includes("940") ||
          kind.includes("unemployment");
        const liabilityCode = isPayrollTax ? "2235" : "2220";

        // Connect the payroll liability account on demand — an org that hasn't
        // run a payroll yet won't have it — so a remittance never dead-ends. The
        // REST sibling (payroll/tax-payments) does the same; names match the chart.
        const PAYROLL_LIABILITY_NAMES: Record<string, string> = {
          "2220": "Income Tax Payable",
          "2235": "Payroll Taxes Payable",
          "2245": "Pension & Benefits Payable",
        };
        const remittanceSettings = await db.query.payrollSettings.findFirst({
          where: eq(payrollSettings.organizationId, ctx.organizationId),
        });
        const baseCurrency = remittanceSettings?.defaultCurrency ?? "USD";
        const liabilityAccount =
          (await findAccountByCode(ctx.organizationId, liabilityCode)) ??
          (await ensureAccountByCode(
            ctx.organizationId,
            {
              code: liabilityCode,
              name: PAYROLL_LIABILITY_NAMES[liabilityCode] ?? `Account ${liabilityCode}`,
              type: "liability",
              subType: "current",
            },
            baseCurrency
          ));
        if (!liabilityAccount) {
          throw new Error(`Could not resolve payroll liability account ${liabilityCode}`);
        }

        const postingDate = params.date || params.periodEnd;

        const mem = await db.query.member.findFirst({
          where: and(
            eq(member.organizationId, ctx.organizationId),
            eq(member.userId, ctx.userId)
          ),
        });

        const result = await db.transaction(async (tx) => {
          const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
          const [entry] = await tx
            .insert(journalEntry)
            .values({
              organizationId: ctx.organizationId,
              entryNumber,
              date: postingDate,
              description: `Payroll tax remittance${params.taxKind ? ` (${params.taxKind})` : ""} ${params.periodStart} to ${params.periodEnd}`,
              reference: params.reference || null,
              status: "posted",
              sourceType: "payroll_tax_payment",
              postedAt: new Date(),
              createdBy: ctx.userId,
            })
            .returning();

          await tx.insert(journalLine).values([
            {
              journalEntryId: entry.id,
              accountId: liabilityAccount.id,
              description: "Payroll tax liability settled",
              debitAmount: params.amount,
              creditAmount: 0,
            },
            {
              journalEntryId: entry.id,
              accountId: bank.id,
              description: "Payroll tax remittance",
              debitAmount: 0,
              creditAmount: params.amount,
            },
          ]);

          const [payment] = await tx
            .insert(payrollTaxPayment)
            .values({
              organizationId: ctx.organizationId,
              periodStart: params.periodStart,
              periodEnd: params.periodEnd,
              jurisdictionLevel: params.jurisdictionLevel,
              jurisdiction: params.jurisdiction || null,
              taxKind: params.taxKind || null,
              amount: params.amount,
              currency: bank.currencyCode,
              bankAccountId: bank.id,
              reference: params.reference || null,
              notes: params.notes || null,
              status: "paid",
              paidAt: new Date(),
              journalEntryId: entry.id,
              createdBy: mem?.id || null,
            })
            .returning();

          return { payment, journalEntryId: entry.id };
        });

        await db.insert(auditLog).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "record_payroll_tax_remittance",
          entityType: "payroll_tax_payment",
          entityId: result.payment.id,
          changes: { amount: params.amount, journalEntryId: result.journalEntryId },
        });

        return { payment: result.payment, journalEntryId: result.journalEntryId };
      })
  );
}
