import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  payrollEmployee,
  payrollRun,
  payrollItem,
  payslip,
  auditLog,
  member,
  taxFormGeneration,
  taxForm,
  contractor,
  contractorPayment,
} from "@/lib/db/schema";
import { eq, and, sql, gte, lte, lt } from "drizzle-orm";
import { notDeleted } from "@/lib/db/soft-delete";
import { requireRole } from "@/lib/api/require-role";
import { wrapTool } from "@/lib/mcp/errors";
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

  // Tax remittances are registered in payroll-payments.ts.
}
